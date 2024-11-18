FROM node:slim

WORKDIR /home/perplexica

COPY package.json yarn.lock ./
RUN yarn install

COPY . .

CMD ["yarn", "dev"]