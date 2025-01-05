#!/bin/sh

echo "Building with current environment variables..."
yarn build

exec yarn start
