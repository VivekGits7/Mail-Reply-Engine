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

## Sources

- [GNU AGPL v3.0 text](https://www.gnu.org/licenses/agpl-3.0.html)
- [MinIO repository](https://github.com/minio/minio)
- [Chainguard: MinIO image changes](https://www.chainguard.dev/unchained/secure-and-free-minio-chainguard-containers)
- [Chainguard MinIO image versions](https://images.chainguard.dev/directory/image/minio)
- [MinIO maintenance mode explained](https://alexandre-vazquez.com/minio-maintenance-mode-s3-open-source-alternatives/)
- [MinIO archived, self-hosted alternatives](https://pinggy.io/blog/minio_archived_self_hosted_s3_alternatives/)
- [Bizety: MinIO in maintenance mode](https://bizety.com/2025/12/06/minio-in-maintenance-mode-open-source-alternatives/)
