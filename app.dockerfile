FROM node:20.18.0-alpine

ENV NEXT_PUBLIC_WS_URL=ws://127.0.0.1:3001
ENV NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api

WORKDIR /home/perplexica

COPY ui /home/perplexica/

RUN yarn install --frozen-lockfile
RUN yarn build

CMD ["yarn", "start"]