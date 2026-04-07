# OpenAI-Compatible Chat Completions API

Vane provides an OpenAI-compatible endpoint that allows you to use it as a drop-in replacement for OpenAI or Perplexity API clients.

## Endpoint

### **POST** `/v1/chat/completions`
### **POST** `/api/openai/chat/completions`

**Full URL**: `http://localhost:3000/v1/chat/completions`

## Request Structure

The request body follows the standard OpenAI Chat Completions format. However, the `model` field is used to configure Vane-specific search options.

### Model String Formatting

You can encode search focus (sources) and optimization modes directly into the `model` string using a specific prefix format.

**Format**: `[mode:][source1,source2,...]/model_name`

#### 1. Search Focus (Sources)
Specify which search engines or data sources Vane should use. Separate multiple sources with commas.

*   **Available Sources**: `web`, `academic`, `discussions`, `news`, `videos`, `images`
*   **Example**: `web,news/gpt-4o` (Searches both Web and News using GPT-4o)

#### 2. Optimization Mode
Control the balance between research depth and speed by prefixing the string with a mode and a colon.

*   **Available Modes**: 
    *   `speed`: (Default) Performs minimal iterations (2) for the fastest response.
    *   `balanced`: Performs moderate research (6 iterations).
    *   `quality`: Performs deep research (up to 25 iterations).
*   **Example**: `quality:web/llama3` (Deep web research using Llama 3)

### Combined Examples

| Model String | Mode | Sources | LLM Model |
| :--- | :--- | :--- | :--- |
| `gpt-4o` | `speed` | `web` (default) | `gpt-4o` |
| `academic/claude-3` | `speed` | `academic` | `claude-3` |
| `balanced:news/qwen2.5:7b` | `balanced` | `news` | `qwen2.5:7b` |
| `quality:web,academic/llama3:8b` | `quality` | `web`, `academic` | `llama3:8b` |

### Ollama Model Tags
Vane fully supports Ollama model tags (parameter sizes and versions). You can specify them in the `model_name` part of the string.

*   **Example**: `qwen2.5:7b`, `llama3.1:8b`, `mistral:latest`
*   **API Usage**: `web/qwen2.5:7b` (Performs a web search using the 7B parameter version of Qwen 2.5)

## Extended Response Fields

In addition to the standard OpenAI response fields, Vane includes a `citations` array at the top level of the response object (similar to the Perplexity API).

```json
{
  "id": "...",
  "object": "chat.completion",
  "created": 1739123456,
  "model": "web/gpt-4o",
  "choices": [...],
  "usage": {...},
  "citations": [
    "https://example.com/article1",
    "https://example.com/article2"
  ]
}
```

## Integration with Tools

### OpenClaw
To use Vane with OpenClaw, set the Perplexity base URL to your Vane instance:
- **Base URL**: `http://your-ip:3000/v1`
- **Model**: `web/your-model-name`
