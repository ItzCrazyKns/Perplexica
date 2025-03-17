FROM node:20.18.0-alpine as base
WORKDIR /home/perplexica

# Development stage
FROM base as development
ENV NODE_ENV=development
ARG NEXT_PUBLIC_WS_URL=ws://127.0.0.1:3001
ARG NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY ui/package.json ui/yarn.lock ./
RUN yarn install
EXPOSE 3000
CMD ["yarn", "dev"]

# Production stage
FROM base as production
ARG NEXT_PUBLIC_WS_URL=ws://127.0.0.1:3001
ARG NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY ui /home/perplexica/
RUN yarn install --frozen-lockfile
RUN yarn build
CMD ["yarn", "start"]