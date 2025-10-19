# Remote Log Archive Infrastructure

This module provisions the immutable storage bucket used by the Winston remote log forwarder. Choose the template that matches your provider:

- `s3.tf` – AWS S3 bucket with object lock, SSE-KMS (optional), lifecycle rules, and a bucket policy restricting uploads to the log-forwarder IAM role.
- `gcs.tf` – Google Cloud Storage bucket with uniform access, retention policy, optional CMEK, and lifecycle rules.

## Usage

```bash
# AWS example
default_region=us-east-1
log_bucket=tpilot-log-archive-prod

terraform init
terraform apply \
  -var="aws_region=$default_region" \
  -var="log_archive_bucket_name=$log_bucket" \
  -var="log_writer_role_arn=arn:aws:iam::123456789012:role/tpilot-log-forwarder" \
  -var="kms_key_arn=arn:aws:kms:us-east-1:123456789012:key/your-key-id"
```

```bash
# GCS example
project_id=tpilot-prod
region=us-central1
bucket_name=tpilot-log-archive-prod

terraform init
terraform apply \
  -var="project_id=$project_id" \
  -var="region=$region" \
  -var="log_archive_bucket_name=$bucket_name" \
  -var="log_uploader_service_account=log-forwarder@tpilot-prod.iam.gserviceaccount.com" \
  -var="kms_key_name=projects/$project_id/locations/$region/keyRings/logs/cryptoKeys/archive"
```

## Post-provision Checklist

1. Export the bucket name into `LOG_ARCHIVE_BUCKET` and set `LOG_ARCHIVE_PROVIDER` (`s3` or `gcs`).
2. Store encryption key references (`LOG_ARCHIVE_KMS_KEY`, `LOG_ARCHIVE_STORAGE_CLASS`) if applicable.
3. Grant only the log forwarder IAM role/service account the ability to upload objects.
4. Run `npm run verify:log-archive` with production credentials to confirm connectivity.
5. Monitor `log_forwarder_*` Prometheus counters and `log_forwarder_failure` alerts for issues.
