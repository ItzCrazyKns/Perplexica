# Configuration Guide

This guide covers all the configuration options available in Perplexica's `config.toml` file.

## Configuration File Structure

Perplexica uses a TOML configuration file to manage settings. Copy `sample.config.toml` to `config.toml` and modify it according to your needs.

```bash
cp sample.config.toml config.toml
```

## Configuration Sections

### [GENERAL]

General application settings.

#### SIMILARITY_MEASURE
- **Type**: String
- **Options**: `"cosine"` or `"dot"`
- **Default**: `"cosine"`
- **Description**: The similarity measure used for embedding comparisons in search results ranking.

#### KEEP_ALIVE
- **Type**: String
- **Default**: `"5m"`
- **Description**: How long to keep Ollama models loaded into memory. Use time suffixes like `"5m"` for 5 minutes, `"1h"` for 1 hour, or `"-1m"` for indefinite.

#### BASE_URL
- **Type**: String
- **Default**: `""` (empty)
- **Description**: Optional base URL override. When set, overrides the detected URL for OpenSearch and other public URLs.

#### HIDDEN_MODELS
- **Type**: Array of Strings
- **Default**: `[]` (empty array)
- **Description**: Array of model names to hide from the user interface and API responses. Hidden models will not appear in model selection lists but can still be used if directly specified.
- **Example**: `["gpt-4", "claude-3-opus", "expensive-model"]`
- **Use Cases**:
  - Hide expensive models to prevent accidental usage
  - Remove models that don't work well with your configuration
  - Simplify the UI by hiding unused models

### [MODELS]

Model provider configurations. Each provider has its own subsection.

#### [MODELS.OPENAI]
- **API_KEY**: Your OpenAI API key

#### [MODELS.GROQ]
- **API_KEY**: Your Groq API key

#### [MODELS.ANTHROPIC]
- **API_KEY**: Your Anthropic API key

#### [MODELS.GEMINI]
- **API_KEY**: Your Google Gemini API key

#### [MODELS.CUSTOM_OPENAI]
Configuration for OpenAI-compatible APIs (like LMStudio, vLLM, etc.)
- **API_KEY**: API key for the custom endpoint
- **API_URL**: Base URL for the OpenAI-compatible API
- **MODEL_NAME**: Name of the model to use

#### [MODELS.OLLAMA]
- **API_URL**: Ollama server URL (e.g., `"http://host.docker.internal:11434"`)

#### [MODELS.DEEPSEEK]
- **API_KEY**: Your DeepSeek API key

#### [MODELS.LM_STUDIO]
- **API_URL**: LM Studio server URL (e.g., `"http://host.docker.internal:1234"`)

### [API_ENDPOINTS]

External service endpoints.

#### SEARXNG
- **Type**: String
- **Description**: SearxNG API URL for web search functionality
- **Example**: `"http://localhost:32768"`

## Environment Variables

Some configurations can also be set via environment variables, which take precedence over the config file:

- `OPENAI_API_KEY`
- `GROQ_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- And others following the pattern `{PROVIDER}_API_KEY`

## Model Visibility Management

The `HIDDEN_MODELS` setting allows server administrators to control which models are visible to users:

### How It Works
1. Models listed in `HIDDEN_MODELS` are filtered out of API responses
2. The settings UI shows all models (including hidden ones) for management
3. Hidden models can still be used if explicitly specified in API calls

### Managing Hidden Models
1. **Via Configuration File**: Edit the `HIDDEN_MODELS` array in `config.toml`
2. **Via Settings UI**: Use the "Model Visibility" section in the settings page
3. **Via API**: Use the `/api/config` endpoint to update the configuration

### API Behavior
- **Default**: `/api/models` returns only visible models
- **Include Hidden**: `/api/models?include_hidden=true` returns all models (for admin use)

## Security Considerations

- Store API keys securely and never commit them to version control
- Use environment variables for sensitive configuration in production
- Regularly rotate API keys
- Consider using `HIDDEN_MODELS` to prevent access to expensive or sensitive models

## Troubleshooting

### Common Issues

1. **Models not appearing**: Check if they're listed in `HIDDEN_MODELS`
2. **API errors**: Verify API keys and URLs are correct
3. **Ollama connection issues**: Ensure the Ollama server is running and accessible
4. **SearxNG not working**: Verify the SearxNG endpoint is correct and accessible

### Configuration Validation

The application validates configuration on startup and will log errors for:
- Invalid TOML syntax
- Missing required fields
- Invalid URLs or API endpoints
- Unreachable services

## Example Configuration

```toml
[GENERAL]
SIMILARITY_MEASURE = "cosine"
KEEP_ALIVE = "5m"
BASE_URL = ""
HIDDEN_MODELS = ["gpt-4", "claude-3-opus"]

[MODELS.OPENAI]
API_KEY = "sk-your-openai-key-here"

[MODELS.OLLAMA]
API_URL = "http://localhost:11434"

[API_ENDPOINTS]
SEARXNG = "http://localhost:32768"
```
