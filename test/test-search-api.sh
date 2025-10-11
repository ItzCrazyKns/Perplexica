#!/bin/bash
# Test Perplexica search API with Google Custom Search

curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"what is machine learning","chat_history":[],"chat_model_provider":"custom_openai","chat_model":"gpt-4","embedding_model_provider":"transformers","embedding_model":"xenova-bge-small-en-v1.5"}' \
  2>&1 | head -100
