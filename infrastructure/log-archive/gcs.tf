terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for bucket placement"
  type        = string
}

variable "log_archive_bucket_name" {
  description = "Name of the log archive bucket"
  type        = string
}

variable "kms_key_name" {
  description = "Customer-managed KMS key for automatic encryption"
  type        = string
  default     = ""
}

variable "log_uploader_service_account" {
  description = "Service account email used by the application to upload logs"
  type        = string
}

resource "google_storage_bucket" "log_archive" {
  name          = var.log_archive_bucket_name
  location      = var.region
  storage_class = "STANDARD"

  uniform_bucket_level_access = true
  force_destroy               = false

  versioning {
    enabled = true
  }

  retention_policy {
    retention_period = 30 * 24 * 60 * 60
    is_locked        = true
  }

  dynamic "encryption" {
    for_each = var.kms_key_name != "" ? [1] : []
    content {
      default_kms_key_name = var.kms_key_name
    }
  }

  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "ARCHIVE"
    }
    condition {
      age = 30
    }
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age   = 7
      matches_prefix = ["_dry-run/"]
    }
  }
}

resource "google_storage_bucket_iam_member" "uploader" {
  bucket = google_storage_bucket.log_archive.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${var.log_uploader_service_account}"
}

resource "google_storage_bucket_iam_member" "viewer" {
  bucket = google_storage_bucket.log_archive.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${var.log_uploader_service_account}"
}

output "log_archive_bucket_url" {
  value = google_storage_bucket.log_archive.url
}
