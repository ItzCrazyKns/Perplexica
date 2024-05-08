terraform {
  required_providers {
    google = {
      source = "hashicorp/google"
      version = "5.28.0"
    }
    kubernetes = {
      source = "hashicorp/kubernetes"
    }
  }
}

provider "google" {
  credentials = file(var.key_file)
  project     = var.project_id
  region      = var.region
}

data "google_client_config" "default" {
  depends_on = [module.gke-cluster]
}

# Defer reading the cluster data until the GKE cluster exists.
data "google_container_cluster" "default" {
  name       = var.cluster_name
  depends_on = [module.gke-cluster]
  location   = var.region
}

provider "kubernetes" {
  host  = "https://${data.google_container_cluster.default.endpoint}"
  token = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(
    data.google_container_cluster.default.master_auth[0].cluster_ca_certificate,
  )
}

resource "kubernetes_deployment" "searxng" {
  metadata {
    name = "searxng"
    labels = {
      app = "searxng"
    }
  }
  spec {
    replicas = 1
    selector {
      match_labels = {
        component = "searxng"
      }
    }
    template {
      metadata {
        labels = {
          component = "searxng"
        }
      }
      spec {
        container {
          image = var.search_image
          name = "searxng-container"
          port {
            container_port = 8080
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "searxng_service" {
  metadata {
    name      = "searxng-service"
    namespace = "default"
  }

  spec {
    selector = {
      component = "searxng"
    }

    port {
      port        = 8080
      target_port = 8080
    }

    type = "LoadBalancer"
  }
}

variable "project_id" {
  description = "The ID of the project in which the resources will be deployed."
  type        = string
}

variable "key_file" {
  description = "The path to the GCP service account key file."
  type        = string
}

variable "region" {
  description = "The GCP region to deploy to."
  type        = string
}

variable "cluster_name" {
  description = "The GCP region to deploy to."
  type        = string
}

variable "search_image" {
  description = "Tag for the searxng image"
  type        = string
}

variable "backed_image" {
  description = "Tag for the Perplexica backend image"
  type        = string
}

variable "app_image" {
  description = "Tag for the app image"
  type        = string
}

module "gke-cluster" {
  source       = "./gke-cluster"

  project_id = var.project_id
  name       = var.cluster_name
  region     = var.region
  key_file   = var.key_file
}
