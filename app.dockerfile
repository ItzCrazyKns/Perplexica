FROM node:alpine

ARG BACKEND_WS_URL='ws://127.0.0.1:3001'
ARG BACKEND_API_URL='http://127.0.0.1:3001/api'
ENV BACKEND_WS_URL=${BACKEND_WS_URL}
ENV BACKEND_API_URL=${BACKEND_API_URL}

WORKDIR /home/perplexica

COPY ui /home/perplexica/

RUN yarn install
RUN yarn build

CMD ["yarn", "start"]