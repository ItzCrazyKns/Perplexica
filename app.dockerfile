FROM node:20.18.0-slim AS builder

ENV NEXT_PUBLIC_AWS_DB_API_URL=https://lyxeetk4w1.execute-api.us-east-1.amazonaws.com/default/getFromStockalyzerDB
ENV NEXT_PUBLIC_AWS_DB_API_KEY=0KcuAyP5zT8kk2vW4MXAU9lMi52Yorti4vRwLwia

WORKDIR /home/perplexica

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

COPY tsconfig.json next.config.mjs next-env.d.ts postcss.config.js drizzle.config.ts tailwind.config.ts ./
COPY src ./src
COPY public ./public

RUN mkdir -p /home/perplexica/data
RUN yarn build

FROM node:20.18.0-slim

WORKDIR /home/perplexica

# 🐧 Install curl + netstat (from net-tools)
# RUN apt-get update && apt-get install -y curl net-tools && apt-get clean

COPY --from=builder /home/perplexica/public ./public
COPY --from=builder /home/perplexica/.next/static ./public/_next/static

COPY --from=builder /home/perplexica/.next/standalone ./
COPY --from=builder /home/perplexica/data ./data

RUN mkdir /home/perplexica/uploads

CMD ["node", "server.js"]
