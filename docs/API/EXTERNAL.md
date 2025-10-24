# External API Documentation

## Overview

The External API provides endpoints for external applications to interact with the Perplexica search and chat functionality. It supports both streaming and non-streaming responses.

## Endpoints

## API: localhost:3000

### POST /api/external

Non-streaming endpoint that returns a complete response.

**Request Body:**

```json
{
  "query": "What is artificial intelligence?",
  "model": {
    "provider": "openai",
    "name": "gpt-4"
  },
  "searchProvider": "searxng",
  "searchCount": 10,
  "focusMode": "webSearch",
  "history": [
    ["human", "Hello"],
    ["ai", "Hi there! How can I help you?"]
  ],
  "systemInstructions": "Be concise and helpful"
}
```

**Response:**

```json
{
  "message": "Artificial intelligence (AI) is...",
  "sources": [
    {
      "title": "What is AI?",
      "url": "https://example.com/ai",
      "content": "Artificial intelligence is..."
    }
  ],
  "metadata": {
    "model": {
      "provider": "openai",
      "name": "gpt-4"
    },
    "searchProvider": "searxng",
    "searchCount": 10,
    "focusMode": "webSearch"
  }
}
```

### POST /api/external/stream

Streaming endpoint that returns responses in real-time.

**Request Body:** Same as non-streaming endpoint

**Response Format (Stream):**

```
{"type":"init","data":"Stream connected","metadata":{...}}
{"type":"response","data":"Artificial"}
{"type":"response","data":" intelligence"}
{"type":"sources","data":[...]}
{"type":"done"}
```

## Parameters

### Required Parameters

- `query` (string): The search query or question
- `focusMode` (string): The search focus mode. Available modes:
  - `webSearch` - General web search
  - `academicSearch` - Academic research
  - `writingAssistant` - Writing assistance
  - `wolframAlphaSearch` - Computational knowledge
  - `youtubeSearch` - Video search
  - `redditSearch` - Community discussions

### Optional Parameters

- `model` (object): Model configuration
  - `provider` (string): Model provider (openai, anthropic, gemini, etc.)
  - `name` (string): Specific model name
- `searchProvider` (string): Search engine provider
  - `searxng` - SearXNG metasearch
  - `exa` - Exa AI search
  - `tavily` - Tavily AI search
  - `firecrawl` - Firecrawl web scraping
  - `jina-ai` - Jina AI search
- `searchCount` (number): Number of search results (1-50, default: 10)
- `history` (array): Conversation history as tuples [role, content]
- `systemInstructions` (string): Custom system instructions for the AI

## Model Providers

Available model providers:

- `openai` - OpenAI models (GPT-4, GPT-3.5)
- `anthropic` - Anthropic Claude models
- `gemini` - Google Gemini models
- `groq` - Groq models
- `deepseek` - DeepSeek models
- `ollama` - Local Ollama models
- `custom_openai` - Custom OpenAI-compatible endpoints

## Search Providers

Available search providers:

- `searxng` - Open-source metasearch engine
- `exa` - AI-powered search with content understanding
- `tavily` - AI search optimized for LLMs
- `firecrawl` - Web scraping and content extraction
- `jina-ai` - Neural search with embeddings

## Examples

### Basic Search Request

```bash
curl -X POST http://localhost:3000/api/external \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is machine learning?",
    "focusMode": "webSearch"
  }'
```

### Advanced Request with Custom Model

```bash
curl -X POST http://localhost:3000/api/external \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Explain quantum computing",
    "model": {
      "provider": "anthropic",
      "name": "claude-3-sonnet"
    },
    "searchProvider": "exa",
    "searchCount": 5,
    "focusMode": "academicSearch",
    "systemInstructions": "Explain in simple terms for beginners"
  }'
```

### Streaming Request

```bash
curl -X POST http://localhost:3000/api/external/stream \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the latest developments in AI?",
    "focusMode": "webSearch"
  }'
```

## Error Responses

All endpoints return standard HTTP status codes:

- `200` - Success
- `400` - Bad request (invalid parameters)
- `500` - Internal server error

Error response format:

```json
{
  "message": "Error description",
  "error": "Detailed error information"
}
```

## Rate Limiting

Currently no rate limiting is implemented. Consider implementing your own rate limiting for production use.

## Authentication

Currently no authentication is required. For production use, consider adding API key authentication.
