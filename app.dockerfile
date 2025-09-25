FROM node:22-slim AS builder

WORKDIR /home/perplexica

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
ENV NEXT_TELEMETRY_DISABLED=1

COPY tsconfig.json next.config.mjs next-env.d.ts postcss.config.js drizzle.config.ts tailwind.config.ts ./
COPY src ./src
COPY public ./public

RUN mkdir -p /home/perplexica/data
RUN yarn build

RUN yarn add --dev @vercel/ncc
RUN yarn ncc build ./src/lib/db/migrate.ts -o migrator

FROM node:22-slim

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /home/perplexica

COPY --from=builder /home/perplexica/public ./public
COPY --from=builder /home/perplexica/.next/static ./public/_next/static

COPY --from=builder /home/perplexica/.next/standalone ./
COPY --from=builder /home/perplexica/data ./data
COPY drizzle ./drizzle
COPY --from=builder /home/perplexica/migrator/build ./build
COPY --from=builder /home/perplexica/migrator/index.js ./migrate.js

COPY entrypoint.sh ./entrypoint.sh

RUN mkdir /home/perplexica/uploads && \
    chown -R node:node /home/perplexica && \
    chmod +x /home/perplexica/entrypoint.sh && \
    npm install playwright -g --no-fund --no-audit && \
    npx playwright install-deps chromium && \
    apt-get update && \
    apt-get install -y procps && \
    apt-get clean && rm -rf /var/lib/apt/lists/* && \
    rm -rf ~/.npm

# Configure the container to run in an unprivileged mode
USER node

# Install Playwright and its dependencies
RUN npx -y playwright install chromium --only-shell && \
    rm -rf ~/.npm

CMD ["./entrypoint.sh"]
