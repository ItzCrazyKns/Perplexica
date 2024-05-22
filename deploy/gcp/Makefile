# Adds all the deployment relevant sensitive information about project
include .env

# Adds secrets/ keys we have define for the project locally and deployment
include ../../.env

# Use `location-id-docker.pkg` for artifact registry Ex. west-1-docker.pkg
GCP_REPO=gcr.io
PREFIX=perplexica
SEARCH_PORT=8080
BACKEND_PORT=3001
SEARCH_IMAGE_TAG=$(GCP_REPO)/$(GCP_PROJECT_ID)/$(PREFIX)-searxng:latest
BACKEND_IMAGE_TAG=$(GCP_REPO)/$(GCP_PROJECT_ID)/$(PREFIX)-backend:latest
APP_IMAGE_TAG=$(GCP_REPO)/$(GCP_PROJECT_ID)/$(PREFIX)-app:latest
CLUSTER_NAME=$(PREFIX)-cluster


.PHONY: build-deploy
build-deploy: docker-build-all deploy


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
	&& echo $(APP_IMAGE_TAG) \
	&& echo $(SEARCH_PORT) \
	&& echo $(BACKEND_PORT) \
	&& echo $(OPENAI) \
	&& echo $(SUPER_SECRET_KEY)

.PHONY: docker-build-push-searxng
docker-build-push-searxng:
	cd ../../ && docker build -f ./deploy/gcp/searxng.dockerfile -t $(SEARCH_IMAGE_TAG) . --platform="linux/amd64"
	docker push $(SEARCH_IMAGE_TAG)


.PHONY: docker-build-push-backend
docker-build-push-backend:
	cd ../../ && docker build -f ./backend.dockerfile -t $(BACKEND_IMAGE_TAG) . --platform="linux/amd64"
	docker push $(BACKEND_IMAGE_TAG)


.PHONY: docker-build-push-app
docker-build-push-app:
	#
	# cd ../../ && docker build -f ./app.dockerfile -t $(APP_IMAGE_TAG) . --platform="linux/amd64"
	# docker push $(APP_IMAGE_TAG)


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
	&& export TF_VAR_search_port=$(SEARCH_PORT) \
	&& export TF_VAR_backend_port=$(BACKEND_PORT) \
	&& export TF_VAR_open_ai=$(OPENAI) \
	&& export TF_VAR_secret_key=$(SUPER_SECRET_KEY) \
	&& terraform apply


.PHONY: teardown
teardown:
	terraform destroy
