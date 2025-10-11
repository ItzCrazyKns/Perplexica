#!/bin/bash
# Complete E2E test: Google Custom Search + Gemini Flash 2.0

echo "🧪 Testing Perplexica with Google Custom Search + Gemini Flash 2.0"
echo "=================================================================="
echo ""

curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "focusMode": "webSearch",
    "query": "what is machine learning",
    "history": [],
    "optimizationMode": "balanced",
    "chatModel": {
      "provider": "gemini",
      "name": "gemini-2.0-flash"
    },
    "embeddingModel": {
      "provider": "gemini",
      "name": "models/text-embedding-004"
    },
    "stream": false
  }' | python3 -m json.tool
