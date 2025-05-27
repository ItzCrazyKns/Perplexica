#!/bin/bash
set -e

echo "🚀 Starting Perplexica..."

# Ensure data directory exists
mkdir -p /home/perplexica/data

# Run database schema migration
echo "📊 Updating database schema..."
npm run db:push

# Start the application
echo "🌐 Starting Next.js server..."
exec node server.js