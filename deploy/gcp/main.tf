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

##################################################################################################### 
# SearXNG - Search engine deployment and service
##################################################################################################### 
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
            container_port = var.search_port
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
      port        = var.search_port
      target_port = var.search_port
    }

    type = "LoadBalancer"
  }
}

##################################################################################################### 
# Perplexica - backend deployment and service
##################################################################################################### 
resource "kubernetes_deployment" "backend" {
  metadata {
    name = "backend"
    labels = {
      app = "backend"
    }
  }
  spec {
    replicas = 1
    selector {
      match_labels = {
        component = "backend"
      }
    }
    template {
      metadata {
        labels = {
          component = "backend"
        }
      }
      spec {
        container {
          image = var.backend_image
          name = "backend-container"
          port {
            container_port = var.backend_port
          }
        env {
          # searxng service ip
          name = "SEARXNG_API_URL"
          value =  "http://${kubernetes_service.searxng_service.status[0].load_balancer[0].ingress[0].ip}:${var.search_port}" 
        }
        env {
          # openai key
          name = "OPENAI"
          value = var.open_ai
        }
        env {
          # port
          name = "PORT"
          value = var.backend_port 
        }
        env {
          # Access key for backend
          name = "SUPER_SECRET_KEY"
          value = var.secret_key
        }
        }
      }
    }
  }
}

resource "kubernetes_service" "backend_service" {
  metadata {
    name      = "backend-service"
    namespace = "default"
  }

  spec {
    selector = {
      component = "backend"
    }

    port {
      port        = var.backend_port
      target_port = var.backend_port
    }

    type = "LoadBalancer"
  }
}

##################################################################################################### 
# Variable and module definitions
##################################################################################################### 
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

variable "backend_image" {
  description = "Tag for the Perplexica backend image"
  type        = string
}

variable "app_image" {
  description = "Tag for the app image"
  type        = string
}

variable "open_ai" {
  description = "OPENAI access key"
  type        = string
}

variable "secret_key" {
  description = "Access key to secure backend endpoints"
  type        = string
}

variable "search_port" {
  description = "Port for searxng service"
  type        = number
}

variable "backend_port" {
  description = "Port for backend service"
  type        = number
}

module "gke-cluster" {
  source       = "./gke-cluster"

  project_id = var.project_id
  name       = var.cluster_name
  region     = var.region
  key_file   = var.key_file
}
