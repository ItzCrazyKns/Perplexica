#############################
# Build stage
#############################

FROM node:22-alpine AS builder

WORKDIR /app

# Copy package.json and yarn.lock
COPY ui/package.json ui/yarn.lock ./

# Copy the rest of the application code
COPY ui .

# Install dependencies & build the application
RUN yarn install --frozen-lockfile && yarn build

#############################
# Production stage
#############################

FROM node:22-alpine

WORKDIR /app

# Copy built assets from the builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# Run the Docker image as node instead of root
USER node

# Start the application
CMD ["yarn", "start"]