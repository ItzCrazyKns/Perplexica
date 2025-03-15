# Multi-stage build for Perplexica
# Stage 1: Build the backend
FROM node:lts-alpine as backend-builder

WORKDIR /app

COPY src ./src
COPY tsconfig.json drizzle.config.ts package.json yarn.lock ./

RUN yarn install --frozen-lockfile --network-timeout 600000 && \
    yarn build

# Stage 2: Build the frontend
FROM node:lts-alpine as frontend-builder

WORKDIR /app

COPY ui ./
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_WS_URL=auto
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}

RUN yarn install --frozen-lockfile && \
    yarn build

# Stage 3: Final image
FROM node:lts-alpine

# Install curl and jq for GitHub API access
RUN apk add --no-cache curl jq

# Determine latest S6 overlay version at build time
RUN S6_OVERLAY_VERSION=$(curl -s https://api.github.com/repos/just-containers/s6-overlay/releases/latest | jq -r .tag_name | sed 's/^v//') && \
    echo "Using S6 overlay version: $S6_OVERLAY_VERSION" && \
    echo "$S6_OVERLAY_VERSION" > /tmp/s6-version

# Use Docker's TARGETARCH for automatic architecture detection
ARG TARGETARCH

# Install additional required packages and create directory structure in one layer
RUN apk add --no-cache \
    nginx \
    tzdata \
    bash && \
    mkdir -p /app/backend /app/frontend /app/data /app/uploads

# Map Docker's architecture names to s6-overlay architecture names and download/install
RUN S6_OVERLAY_VERSION=$(cat /tmp/s6-version) && \
    case "${TARGETARCH}" in \
      "amd64")  S6_OVERLAY_ARCH="x86_64"  ;; \
      "arm64")  S6_OVERLAY_ARCH="aarch64" ;; \
      "arm")    S6_OVERLAY_ARCH="arm"     ;; \
      *) echo "Unsupported architecture: ${TARGETARCH}. Only amd64, arm64, and arm are supported." && exit 1 ;; \
    esac && \
    echo "Target architecture: ${TARGETARCH} -> S6 architecture: ${S6_OVERLAY_ARCH}" && \
    echo "Downloading s6-overlay v${S6_OVERLAY_VERSION} for architecture: ${S6_OVERLAY_ARCH}" && \
    curl -L -s -o /tmp/s6-overlay-noarch.tar.xz "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz" && \
    tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz && \
    curl -L -s -o /tmp/s6-overlay-arch.tar.xz "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_OVERLAY_ARCH}.tar.xz" && \
    tar -C / -Jxpf /tmp/s6-overlay-arch.tar.xz && \
    curl -L -s -o /tmp/s6-overlay-symlinks-noarch.tar.xz "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-symlinks-noarch.tar.xz" && \
    tar -C / -Jxpf /tmp/s6-overlay-symlinks-noarch.tar.xz && \
    rm -f /tmp/s6-overlay-*.tar.xz /tmp/s6-version

# Copy configuration files
COPY docker/etc/s6-overlay/services /etc/services.d/
COPY docker/etc/nginx/nginx.conf /etc/nginx/nginx.conf

# Make service scripts executable
RUN chmod +x /etc/services.d/*/run /etc/services.d/*/finish

# Copy application files from builders
COPY --from=backend-builder /app/dist /app/backend/dist
COPY --from=backend-builder /app/node_modules /app/backend/node_modules
COPY --from=backend-builder /app/package.json /app/backend/package.json
COPY --from=backend-builder /app/drizzle.config.ts /app/backend/drizzle.config.ts
# Copy only the schema file for Drizzle migrations
COPY --from=backend-builder /app/src/db/schema.ts /app/backend/src/db/schema.ts
COPY --from=frontend-builder /app/.next /app/frontend/.next
COPY --from=frontend-builder /app/node_modules /app/frontend/node_modules
COPY --from=frontend-builder /app/package.json /app/frontend/package.json
COPY --from=frontend-builder /app/public /app/frontend/public

# Configure volumes and ports
VOLUME ["/app/backend/data", "/app/backend/uploads"]
EXPOSE 8080

# Set up healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

ENTRYPOINT ["/init"]
