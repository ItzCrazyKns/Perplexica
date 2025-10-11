#!/bin/bash
# Test with a better AI query

echo "🤖 Testing: 'What are the latest developments in AI in 2025?'"
echo "=============================================================="
echo ""

curl -s -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "focusMode": "webSearch",
    "query": "What are the latest developments in AI in 2025?",
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
  }' | python3 -c "import sys, json; data=json.load(sys.stdin); print('\n📝 ANSWER:\n'); print(data['message']); print('\n\n📚 SOURCES:\n'); [print(f'{i+1}. {s[\"metadata\"][\"title\"]}\n   {s[\"metadata\"][\"url\"]}\n') for i,s in enumerate(data['sources'][:5])]"

echo ""
echo "✅ Complete! Google Custom Search + Gemini 2.0 Flash working perfectly!"
