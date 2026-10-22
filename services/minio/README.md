# MinIO

S3-compatible storage for candidate documents, HR uploads and generated reports. It runs as its own compose stack on its own network, so the same folder works on a laptop or any VM.

On first start the `minio-init` job creates the bucket, makes it private, turns on encryption at rest and creates a backend user that can only touch this bucket. It is safe to run again.

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | MinIO server plus the one-shot `minio-init` job |
| `init.sh` | Bucket, encryption, policy and app user setup |
| `.env.example` | Template, copy to `.env` and fill in |

## Setup

```bash
cd services/minio
cp .env.example .env
chmod 600 .env

openssl rand -base64 24                        # MINIO_ROOT_PASSWORD
openssl rand -base64 24                        # MINIO_APP_SECRET_KEY
echo "mre-key:$(openssl rand -base64 32)"      # MINIO_KMS_SECRET_KEY

docker compose up -d
docker compose logs minio-init                 # last line should say "MinIO ready"
```

Back up `MINIO_KMS_SECRET_KEY` outside the VM right away. Every object is encrypted with it, so losing it means losing the files.

## Ports

| Mapping | What it is | Default bind |
|---------|-----------|--------------|
| `9100 -> 9000` | S3 API, browsers open presigned links here | `127.0.0.1`, reach it through the HTTPS proxy |
| `9101 -> 9001` | Admin console | `127.0.0.1`, reach it with `ssh -L 9101:127.0.0.1:9101 user@VM_IP` |

## Backend wiring

The backend joins the `mail-reply-engine-network` network as external and uses two endpoints:

| Backend env | Value | Why |
|-------------|-------|-----|
| `S3_ENDPOINT_URL` | `http://mail-reply-engine-minio:9000` | Uploads and reads over the Docker network |
| `S3_PUBLIC_ENDPOINT_URL` | `https://files.your-domain` | Only used to sign presigned links, since the signature includes the host the browser calls |
| `S3_BUCKET` | `MINIO_BUCKET` | |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | `MINIO_APP_ACCESS_KEY` / `MINIO_APP_SECRET_KEY` | Never the root user |

Use path-style addressing and `s3v4` signatures in the client config. For local dev both endpoints can be `http://localhost:9100` with `MINIO_API_BIND=127.0.0.1`.

## HTTPS

Presigned links carry ID documents, so they must never travel over plain HTTP on a shared network. Put the API behind the VM's reverse proxy and keep `MINIO_API_BIND=127.0.0.1`.

```nginx
server {
    server_name files.your-domain;
    client_max_body_size 50m;
    location / {
        proxy_pass http://127.0.0.1:9100;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The proxy must pass the `Host` header unchanged or every presigned link fails its signature check.

## Verify

```bash
docker ps --filter name=mail-reply-engine-minio --format '{{.Names}}  {{.Status}}'
curl -s http://127.0.0.1:9100/minio/health/live -o /dev/null -w '%{http_code}\n'

docker compose run --rm --entrypoint sh minio-init -c '
  mc --config-dir /tmp/mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null &&
  mc --config-dir /tmp/mc encrypt info local/$MINIO_BUCKET &&
  mc --config-dir /tmp/mc anonymous get local/$MINIO_BUCKET'
```

Expect `SSE-S3` encryption and `Access permission for ... is private`.

## Day-2 operations

```bash
docker compose logs -f minio
docker compose restart minio
docker compose down              # data survives in the minio-data volume
docker compose down -v           # wipes every stored object, full reset
docker compose pull && docker compose up -d   # monthly image refresh
```

## Security checklist

| Check | How this stack handles it |
|-------|---------------------------|
| Encryption at rest | Bucket default SSE-S3 with `MINIO_KMS_SECRET_KEY`. Also turn on disk encryption for the VM volume |
| Encryption in transit | HTTPS reverse proxy, API bound to localhost |
| Public access | Bucket set to private, no anonymous policy, files only reachable through short presigned links |
| Least privilege | Backend uses a bucket-scoped user, root is only for the console and init job |
| Console | Bound to localhost, opened over an SSH tunnel |
| Patching | Upstream MinIO is no longer maintained. Pin the image digest, refresh monthly, and watch for CVEs |
| Backups | Back up the volume and the KMS key to different places |
| Secrets | `.env` is gitignored and `chmod 600` |

## License

MinIO server is AGPLv3. Running it unchanged as a separate service that the backend talks to over the S3 API does not put the backend under AGPL. If the stack is ever shipped to a client, include the MinIO license notice and a link to its source, and get a quick legal check.
