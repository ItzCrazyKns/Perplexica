#############################
# Build stage
#############################

FROM node:22-alpine AS builder

WORKDIR /app

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./

# Copy the rest of the application code
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src

# Install dependencies & build the application
RUN yarn install --frozen-lockfile --network-timeout 600000 && yarn build

#############################
# Production stage
#############################

FROM node:22-alpine

ARG USER=node

WORKDIR /app

# Copy built assets and necessary files from the builder stage
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/node_modules ./node_modules

# Copy the rest of the application code
COPY --chown=node:node drizzle.config.ts ./
COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node src/db/schema.ts ./src/db/schema.ts
COPY --chown=node:node package.json ./package.json

# Create data directory & set permissions to node user
RUN mkdir /app/data && \
    chown -R node:node /app/data && \
    chmod -R 755 /app/data

# Run the Docker image as node or root if Docker Compose du to volume permissions
USER ${USER}

# Start the application
CMD ["yarn", "start"]