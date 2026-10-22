# MinIO: License and Security

## At a glance

- **Software:** MinIO server and the `mc` client, S3-compatible object storage
- **License:** GNU AGPL v3.0 since 2021, Apache 2.0 before that
- **Image:** `cgr.dev/chainguard/minio`, rebuilt by Chainguard from source
- **Upstream status:** the community edition is frozen, see Project status
- **Cost:** free. MinIO Inc. sells a commercial license under the name AIStor
- **Our use:** internal, unmodified, its own container, and the backend talks to it over the S3 API

## License, what it means for us

- **Running MinIO unchanged inside our VM:** no obligation beyond keeping the license intact
- **Backend calling MinIO over the S3 API:** the backend code stays ours, it is not a derivative work
- **If we ever modify MinIO and users reach it over a network:** we must publish our modified MinIO source, per AGPL section 13
- **If we ship this stack to a client:** include the AGPL text and a link to the exact MinIO source used
- MinIO Inc. reads the AGPL broadly, so get a quick legal sign-off before shipping this stack to a client

## Project status

- **May 2025:** admin features were removed from the free console
- **Oct 2025:** official binaries and Docker images stopped, the project is source only
- **Dec 2025:** the repo moved to maintenance mode, with security fixes decided case by case
- **2026:** the repo is reported archived and read-only
- Chainguard still rebuilds the image daily
- Reports say Chainguard builds from `pgsty/silo`, a maintained AGPL fork. This comes from issue threads, not an official notice

## Data we store

- **Candidate documents** such as PAN, Aadhaar, certificates and photos
  - High sensitivity, personal data
  - Encrypted and private, opened only through 5 minute links
- **Appointment letters**
  - High sensitivity, they contain salary
  - Stored as an opaque file, never read by code or AI
- **Payslips or offer letters sent by mistake**
  - Contain salary
  - Deleted on detection, only a metadata row is kept
- **HR uploads** such as reminder lists, survey exports and transcripts
  - Medium to high sensitivity
  - Transcripts are limited to users with complaints access
- **Generated reports and the Statement of Understanding PDF**
  - Low to medium sensitivity
  - Private bucket, presigned links only
- Extracted document text is never written to MinIO or the database

## Security controls in this stack

- **Encryption at rest:** SSE-S3 on the whole bucket, using `MINIO_KMS_SECRET_KEY`, set up by `init.sh`. MinIO uses authenticated encryption, AES-256-GCM or ChaCha20-Poly1305
- **No public access:** the anonymous policy is set to none in `init.sh`
- **Least privilege:** the backend user can only get, put, delete and list inside one bucket, through the policy in `init.sh`
- **Root kept away from the app:** the root user is only for the console and the init job
- **Network exposure:** the API and console are bound to 127.0.0.1 in `docker-compose.yml`
- **Short-lived access:** SigV4 presigned links that expire after 300 seconds, and every link is logged in `action_log`
- **Upload origin lock:** CORS allows only the dashboard origin, set by `MINIO_CORS_ALLOW_ORIGIN`
- **Secrets:** `.env` is gitignored and `chmod 600`, and secrets are generated, never typed by hand

## Risks and mitigations

- **Upstream is frozen**
  - Impact: slower or missing security fixes
  - Mitigation: Chainguard daily rebuilds, a pinned digest, a monthly refresh, and the exit plan below
- **One static KMS key**
  - Impact: one key protects everything, and losing it loses every file
  - Mitigation: an offsite key backup. MinIO recommends KES with an external KMS for larger setups
- **Leaked presigned link**
  - Impact: the file is readable until the link expires
  - Mitigation: 5 minute expiry, an HR-only endpoint, and every link logged
- **Leaked root password**
  - Impact: full control of the storage
  - Mitigation: a localhost-only console, the app never uses root, and secret rotation

## Exit plan

- The backend only uses the S3 API, so swapping storage needs no backend code change
- If security rejects MinIO, switch to another S3-compatible store such as SeaweedFS, which is Apache 2.0
- Point `S3_ENDPOINT_URL` and the keys at the new store
- Copy the existing objects across with `mc mirror`

## Sources

- [GNU AGPL v3.0 text](https://www.gnu.org/licenses/agpl-3.0.html)
- [MinIO repository](https://github.com/minio/minio)
- [Chainguard: MinIO image changes](https://www.chainguard.dev/unchained/secure-and-free-minio-chainguard-containers)
- [Chainguard MinIO image versions](https://images.chainguard.dev/directory/image/minio)
- [MinIO maintenance mode explained](https://alexandre-vazquez.com/minio-maintenance-mode-s3-open-source-alternatives/)
- [MinIO archived, self-hosted alternatives](https://pinggy.io/blog/minio_archived_self_hosted_s3_alternatives/)
- [Bizety: MinIO in maintenance mode](https://bizety.com/2025/12/06/minio-in-maintenance-mode-open-source-alternatives/)
