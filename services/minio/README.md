# MinIO

Private S3-compatible storage for documents, uploads and generated reports.

## Getting started

Requires Docker Compose. Run commands from this directory.

1. Create `.env` from `.env.example` and configure credentials, the encryption key, bucket and frontend origin.
2. Start MinIO and initialize the bucket:

```bash
docker compose up -d --build minio
docker compose run --rm minio-init
```

Initialization creates the private encrypted bucket and a bucket-scoped application user. Match the backend storage credentials to this user.

For deployment and port configuration, see the [VM commands](../../CMD.md).

[License notice](license.md).
