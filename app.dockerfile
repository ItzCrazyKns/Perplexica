FROM --platform=linux/amd64 node:20-slim AS builder

WORKDIR /home/perplexica

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
ENV NEXT_TELEMETRY_DISABLED=1

COPY tsconfig.json next.config.mjs next-env.d.ts postcss.config.js drizzle.config.ts tailwind.config.ts ./
COPY src ./src
COPY public ./public

RUN mkdir -p /home/perplexica/data
RUN yarn build

FROM --platform=linux/amd64 node:20-slim

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /home/perplexica

COPY --from=builder /home/perplexica/public ./public
COPY --from=builder /home/perplexica/.next/static ./public/_next/static

COPY --from=builder /home/perplexica/.next/standalone ./
COPY --from=builder /home/perplexica/data ./data

# Copy files needed for database migrations at runtime
COPY drizzle.config.ts ./
COPY src/lib/db/schema.ts ./src/lib/db/
COPY docker-entrypoint.sh ./
COPY package.json ./

RUN mkdir /home/perplexica/uploads && \
    chmod +x /home/perplexica/docker-entrypoint.sh && \
    npm install playwright drizzle-kit && \
    npx -y playwright install chromium --only-shell --with-deps && \
    apt-get update && \
    apt-get install -y procps && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

CMD ["./docker-entrypoint.sh"]