#!/bin/bash
# Test Perplexica search with Google Custom Search backend

echo "🔍 Testing Perplexica Search API with Google Custom Search..."
echo ""

curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "focusMode": "webSearch",
    "query": "what is machine learning",
    "history": [],
    "optimizationMode": "balanced",
    "chatModel": {
      "provider": "custom_openai",
      "name": "gpt-4"
    },
    "embeddingModel": {
      "provider": "transformers",
      "name": "xenova-bge-small-en-v1.5"
    },
    "stream": false
  }' | jq '.'
