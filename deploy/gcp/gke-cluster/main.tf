terraform {
  required_providers {
    google = {
      source = "hashicorp/google"
      version = "5.28.0"
    }
  }
}

variable "project_id" {
  description = "The ID of the project in which resources will be deployed."
  type        = string
}

variable "name" {
  description = "The GKE Cluster name"
  type        = string
}

variable "region" {
  description = "The GCP region to deploy to."
  type        = string
}

variable "key_file" {
  description = "The path to the GCP service account key file."
  type        = string
}

provider "google" {
  credentials = file(var.key_file)
  project     = var.project_id
  region      = var.region
}

resource "google_container_cluster" "cluster" {
  name               = var.name
  location           = var.region
  initial_node_count = 1
  remove_default_node_pool = true
}

resource "google_container_node_pool" "primary_preemptible_nodes" {
  name       = "${google_container_cluster.cluster.name}-node-pool"
  location   = var.region
  cluster    = google_container_cluster.cluster.name
  node_count = 1

  node_config {
    machine_type = "n1-standard-4"
    disk_size_gb = 25
    spot = true
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/devstorage.read_only",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring",
    ]
  }
}
