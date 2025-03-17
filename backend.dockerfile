FROM node:18-slim as base
WORKDIR /home/perplexica
RUN mkdir -p /home/perplexica/data /home/perplexica/uploads

# Development stage
FROM base as development
ENV NODE_ENV=development
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
EXPOSE 3001
CMD ["yarn", "dev"]

# Production stage
FROM base as production
COPY src /home/perplexica/src
COPY tsconfig.json /home/perplexica/
COPY drizzle.config.ts /home/perplexica/
COPY package.json /home/perplexica/
COPY yarn.lock /home/perplexica/
RUN yarn install --frozen-lockfile --network-timeout 600000
RUN yarn build
CMD ["yarn", "start"]