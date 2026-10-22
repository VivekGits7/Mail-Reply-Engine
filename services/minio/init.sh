#!/bin/sh
set -eu

MC="mc --config-dir /tmp/mc"
POLICY_NAME="${MINIO_BUCKET}-rw"

$MC alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null

$MC mb --ignore-existing "local/$MINIO_BUCKET"
$MC anonymous set none "local/$MINIO_BUCKET"
$MC encrypt set sse-s3 "local/$MINIO_BUCKET"

cat > /tmp/app-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetBucketLocation", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::${MINIO_BUCKET}"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::${MINIO_BUCKET}/*"]
    }
  ]
}
EOF

$MC admin policy create local "$POLICY_NAME" /tmp/app-policy.json
$MC admin user add local "$MINIO_APP_ACCESS_KEY" "$MINIO_APP_SECRET_KEY"
$MC admin policy attach local "$POLICY_NAME" --user "$MINIO_APP_ACCESS_KEY" 2>/dev/null || echo "Policy $POLICY_NAME already attached"

echo "MinIO ready: bucket $MINIO_BUCKET is private, encrypted at rest, and scoped to $MINIO_APP_ACCESS_KEY"
