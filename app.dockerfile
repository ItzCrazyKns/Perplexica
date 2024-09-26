FROM node:alpine

ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

WORKDIR /home/perplexica

COPY ui/package.json /home/perplexica/
COPY ui/yarn.lock /home/perplexica/

RUN yarn install

COPY ui /home/perplexica/

RUN yarn build

CMD ["yarn", "start"]
