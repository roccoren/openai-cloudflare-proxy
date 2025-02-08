# Azure AI Proxy Cloudflare Worker

This Cloudflare Worker serves as a proxy for AI services, primarily Azure AI services but now with support for other providers. It provides a standardized API interface similar to OpenAI's API, supporting model mapping and chat completions through various AI services.

## Deployment URL

The worker is deployed at: https://az-proxy-worker.roccor.workers.dev

## Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Configure environment variables by creating a `.dev.vars` file with the following content:
```env
# Required Azure configuration
AZURE_API_KEY=your_azure_api_key

# Optional: Azure endpoint configuration (choose one approach)
AZURE_ENDPOINT=https://models.inference.ai.azure.com
# Or for traditional Azure OpenAI:
AZURE_RESOURCE_NAME=your_resource_name
AZURE_DEPLOYMENT_NAME=your_deployment_name

# Optional: GitHub configuration
GITHUB_API_KEY=your_github_api_key

# Model mappings configuration
MODEL_MAPPINGS={"gpt-4o":"gpt-4o","gpt-4o-mini":"gpt-4o-mini","DeepSeek-R1":"deepseek-r1"}
```

## Development

To run the development server:

```bash
npm run dev
# or
npx wrangler dev
```

The server will start on `http://localhost:8787`

## API Endpoints

### List Available Models

```http
GET /v1/models
```

Returns a list of available models and their capabilities.

Example response:
```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4-turbo",
      "object": "model",
      "created": 1707393369,
      "owned_by": "azure",
      "permission": [],
      "root": "gpt-4-turbo",
      "parent": null,
      "context_window": 128000,
      "max_tokens": 4096
    }
  ]
}
```

### Create Chat Completion

```http
POST /v1/chat/completions
```

Request body:
```json
{
  "model": "gpt-4-turbo",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

Response:
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1707393369,
  "model": "gpt-4-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm functioning well, thank you for asking. How can I assist you today?"
      },
      "finish_reason": "stop"
    }
  ]
}
```

## Configuration

### Model Mappings

Model capabilities are defined in `src/models.ts`. Current supported models include:

- **GPT-4**: Context window: 8192, Max tokens: 4096
- **GPT-4-Turbo**: Context window: 128000, Max tokens: 4096, Vision support
- **DeepSeek-R1**: Context window: 32768, Max tokens: 8192 (via GitHub provider)

### Environment Variables

- `AZURE_API_KEY`: Your Azure API key (required)
- `AZURE_ENDPOINT`: Azure endpoint URL (defaults to https://models.inference.ai.azure.com)
- `AZURE_RESOURCE_NAME`: Your Azure OpenAI resource name (optional, for traditional Azure OpenAI setup)
- `AZURE_DEPLOYMENT_NAME`: Your Azure OpenAI deployment name (optional, for traditional Azure OpenAI setup)
- `GITHUB_API_KEY`: Your GitHub API key (optional, for GitHub provider access)
- `MODEL_MAPPINGS`: JSON string mapping model names to deployments

### Providers

The proxy now supports multiple AI providers:

1. **Azure AI** (Primary provider)
   - Supports both modern AI Inference endpoints and traditional Azure OpenAI endpoints
   - Configurable through environment variables

2. **GitHub** (Secondary provider)
   - Support for models like DeepSeek-R1
   - Requires GitHub API key configuration

## Deployment

To deploy to Cloudflare Workers:

```bash
npm run deploy
# or
npx wrangler deploy
```

## Error Handling

The API returns standard error responses with appropriate HTTP status codes:

- 400: Invalid request (e.g., invalid parameters)
- 401: Authentication error
- 404: Resource not found
- 405: Method not allowed
- 500: Internal server error

Example error response:
```json
{
  "error": {
    "message": "Invalid parameters: temperature must be between 0 and 2",
    "type": "invalid_request_error",
    "code": "invalid_parameters"
  }
}