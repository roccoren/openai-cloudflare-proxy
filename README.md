# Azure AI Proxy Cloudflare Worker

This Cloudflare Worker serves as a proxy for Azure AI services, providing a standardized API interface similar to OpenAI's API. It supports model mapping and handles chat completions through Azure's AI services.

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
AZURE_API_KEY=your_azure_api_key
AZURE_ENDPOINT=https://models.inference.ai.azure.com
MODEL_MAPPINGS={"gpt-4":"gpt-4","gpt-4-turbo":"gpt-4-turbo","gpt-4-vision":"gpt-4-vision","gpt-3.5":"gpt-35-turbo","DeepSeek-R1":"deepseek-r1"}
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
      "id": "gpt-4",
      "object": "model",
      "created": 1707393369,
      "owned_by": "azure",
      "permission": [],
      "root": "gpt-4",
      "parent": null,
      "context_window": 8192,
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
  "model": "gpt-4",
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
  "model": "gpt-4",
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

Model mappings are defined in two places:

1. `.dev.vars` or `wrangler.toml`: Maps external model names to Azure deployment names
2. `src/models.ts`: Defines model capabilities and properties

### Environment Variables

- `AZURE_API_KEY`: Your Azure API key (required)
- `AZURE_ENDPOINT`: Azure endpoint URL (defaults to https://models.inference.ai.azure.com)
- `MODEL_MAPPINGS`: JSON string mapping model names to Azure deployments

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