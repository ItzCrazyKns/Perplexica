# USAGE:
# 0: Install `docker` and `terraform` (Process specific to your system)
# 1: Copy the sample.env file to .env
# 2: Fillout the GCP info in .env
# 3: Edit GCP_REPO to the correct docker image repo path if you are using something other than Container registry
# 4: Edit the PREFIX if you would like images and GKE entities to be prefixed with something else
# 5: Run `make init` to initialize terraform
# 6: Follow the normal Preplexica configuration steps outlined in the project readme
# 7: Run `make build-deplpy` to build and push the project images to the repo, create a GKE cluster and deploy the app
#
# NOTES/ WARNINGS:
# - The app endpoint is unsecured and exposed to the internet at large, you will need to implement your desired auth
# - No auto scaling is enabled for this cluster and deployments, edit the terraform files accordingly for that
include .env

# Use `location-id-docker.pkg` for artifact registry Ex. west-1-docker.pkg
GCP_REPO=gcr.io
PREFIX=perplexica
SEARCH_IMAGE_TAG=$(GCP_REPO)/$(GCP_PROJECT_ID)/$(PREFIX)-searxng:latest
BACKEND_IMAGE_TAG=$(GCP_REPO)/$(GCP_PROJECT_ID)/$(PREFIX)-backend:latest
APP_IMAGE_TAG=$(GCP_REPO)/$(GCP_PROJECT_ID)/$(PREFIX)-app:latest
CLUSTER_NAME=$(PREFIX)-cluster


.PHONY: build-deplpy
build-deplpy: docker-build-all deploy


.PHONY: docker-build-all
docker-build-all: docker-build-push-searxng docker-build-push-backend docker-build-push-app


.PHONY: show_config
show_config:
	@echo $(GCP_PROJECT_ID) \
	&& echo $(CLUSTER_NAME) \
	&& echo $(GCP_REGION) \
	&& echo $(GCP_SERVICE_ACCOUNT_KEY_FILE) \
	&& echo $(SEARCH_IMAGE_TAG) \
	&& echo $(BACKEND_IMAGE_TAG) \
	&& echo $(APP_IMAGE_TAG)


.PHONY: docker-build-push-searxng
docker-build-push-searxng:
	cd ../../ && docker build -f ./searxng.dockerfile -t $(SEARCH_IMAGE_TAG) . --platform="linux/amd64"
	docker push $(SEARCH_IMAGE_TAG)


.PHONY: docker-build-push-backend
docker-build-push-backend:
	cd ../../ && docker build -f ./backed.dockerfile -t $(BACKEND_IMAGE_TAG) . --platform="linux/amd64"
	docker push $(BACKEND_IMAGE_TAG)


.PHONY: docker-build-push-app
docker-build-push-app:
	cd ../../ && docker build -f ./app.dockerfile -t $(APP_IMAGE_TAG) . --platform="linux/amd64"
	docker push $(APP_IMAGE_TAG)


.PHONY: init
init:
	terraform init


.PHONY: deploy
deploy:
	export TF_VAR_project_id=$(GCP_PROJECT_ID) \
	&& export TF_VAR_cluster_name=$(CLUSTER_NAME) \
	&& export TF_VAR_region=$(GCP_REGION) \
	&& export TF_VAR_key_file=$(GCP_SERVICE_ACCOUNT_KEY_FILE) \
	&& export TF_VAR_search_image=$(SEARCH_IMAGE_TAG) \
	&& export TF_VAR_backend_image=$(BACKEND_IMAGE_TAG) \
	&& export TF_VAR_app_image=$(APP_IMAGE_TAG) \
	&& terraform apply


.PHONY: teardown
teardown:
	terraform destroy
