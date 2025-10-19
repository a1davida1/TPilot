terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region for the log archive bucket"
  type        = string
}

variable "log_archive_bucket_name" {
  description = "Name of the immutable log archive bucket"
  type        = string
}

variable "kms_key_arn" {
  description = "Optional KMS key ARN for bucket encryption"
  type        = string
  default     = ""
}

variable "log_writer_role_arn" {
  description = "IAM role ARN used by the application to upload logs"
  type        = string
}

resource "aws_s3_bucket" "log_archive" {
  bucket              = var.log_archive_bucket_name
  object_lock_enabled = true
  force_destroy       = false
}

resource "aws_s3_bucket_versioning" "log_archive" {
  bucket = aws_s3_bucket.log_archive.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "log_archive" {
  bucket = aws_s3_bucket.log_archive.bucket

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.kms_key_arn != "" ? var.kms_key_arn : null
      sse_algorithm     = var.kms_key_arn != "" ? "aws:kms" : "AES256"
    }
  }
}

resource "aws_s3_bucket_object_lock_configuration" "log_archive" {
  bucket = aws_s3_bucket.log_archive.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = 30
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "log_archive" {
  bucket = aws_s3_bucket.log_archive.id

  rule {
    id     = "glacier-transition"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = 30
      storage_class = "GLACIER_IR"
    }
  }

  rule {
    id     = "dry-run-expiration"
    status = "Enabled"

    filter {
      prefix = "_dry-run/"
    }

    expiration {
      days = 7
    }
  }
}

resource "aws_s3_bucket_public_access_block" "log_archive" {
  bucket = aws_s3_bucket.log_archive.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "log_archive" {
  bucket = aws_s3_bucket.log_archive.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowApplicationWrites"
        Effect   = "Allow"
        Principal = {
          AWS = var.log_writer_role_arn
        }
        Action   = ["s3:PutObject", "s3:AbortMultipartUpload" ]
        Resource = [
          "${aws_s3_bucket.log_archive.arn}/*"
        ]
        Condition = {
          StringEquals = {
            "s3:x-amz-server-side-encryption" = var.kms_key_arn != "" ? "aws:kms" : "AES256"
          }
        }
      },
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.log_archive.arn,
          "${aws_s3_bucket.log_archive.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = false
          }
        }
      }
    ]
  })
}

output "log_archive_bucket_name" {
  value = aws_s3_bucket.log_archive.bucket
}
