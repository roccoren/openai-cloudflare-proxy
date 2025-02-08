import { createConfig, getDeploymentName, isValidModel } from './config';
import { AzureKeyCredential } from "@azure/core-auth";
import { default as aiClient } from "@azure-rest/ai-inference";
import type { ChatCompletionRequest, ChatCompletionResponse, ErrorResponse } from './types';

export interface Env {
  AZURE_API_KEY: string;
  AZURE_ENDPOINT?: string;
  GITHUB_API_KEY?: string;
  MODEL_MAPPINGS?: string;
}

interface AzureChatMessage {
  role: string;
  content: string | null;
}

interface AzureErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

interface AzureApiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

function validateParameters(request: ChatCompletionRequest): { valid: boolean; error?: string } {
  if (request.temperature !== undefined) {
    if (typeof request.temperature !== 'number' || request.temperature < 0 || request.temperature > 2) {
      console.error('Invalid temperature parameter:', request.temperature);
      return { valid: false, error: 'temperature must be between 0 and 2' };
    }
  }

  if (request.max_tokens !== undefined) {
    if (!Number.isInteger(request.max_tokens) || request.max_tokens <= 0) {
      console.error('Invalid max_tokens parameter:', request.max_tokens);
      return { valid: false, error: 'max_tokens must be a positive integer' };
    }
  }

  if (request.max_completion_tokens !== undefined) {
    if (!Number.isInteger(request.max_completion_tokens) || request.max_completion_tokens <= 0) {
      console.error('Invalid max_completion_tokens parameter:', request.max_completion_tokens);
      return { valid: false, error: 'max_completion_tokens must be a positive integer' };
    }
  }

  if (request.top_p !== undefined) {
    if (typeof request.top_p !== 'number' || request.top_p < 0 || request.top_p > 1) {
      console.error('Invalid top_p parameter:', request.top_p);
      return { valid: false, error: 'top_p must be between 0 and 1' };
    }
  }

  return { valid: true };
}

function getTokenLimit(request: ChatCompletionRequest): number | undefined {
  // If max_tokens is explicitly provided, use it
  if (request.max_tokens !== undefined) {
    console.log('Using provided max_tokens:', request.max_tokens);
    return request.max_tokens;
  }

  // If max_completion_tokens is provided as fallback, use it
  if (request.max_completion_tokens !== undefined) {
    console.log('Using max_completion_tokens as fallback:', request.max_completion_tokens);
    return request.max_completion_tokens;
  }

  // If neither is provided, return undefined to let the API use its default
  console.log('No token limit specified, using API default');
  return undefined;
}

function stripUnsupportedParameters(request: ChatCompletionRequest): {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
} {
  return {
    model: request.model,
    messages: request.messages,
    temperature: request.temperature,
    max_tokens: getTokenLimit(request),
    top_p: request.top_p,
    stream: request.stream
  };
}

function createAzureClient(env: Env) {
  const endpoint = env.AZURE_ENDPOINT || 'https://models.inference.ai.azure.com';
  return aiClient(endpoint, new AzureKeyCredential(env.AZURE_API_KEY));
}

function handleError(error: unknown): Response {
  console.error('Error:', error);
  const errorResponse: ErrorResponse = {
    error: {
      message: error instanceof Error ? error.message : 'An unknown error occurred',
      type: 'proxy_error',
      code: 'internal_error',
    },
  };
  return new Response(JSON.stringify(errorResponse), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleAzureChatCompletion(
  request: ChatCompletionRequest, 
  env: Env,
  config: ReturnType<typeof createConfig>
): Promise<Response> {
  try {
    const validation = validateParameters(request);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        error: {
          message: validation.error,
          type: 'invalid_request_error',
          code: 'invalid_parameters',
        },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const client = createAzureClient(env);
    const modelName = request.model || config.defaultModel;
    const deploymentName = getDeploymentName(modelName, config);

    console.log('Making request to Azure AI with messages:', request.messages);

    const requestParams = stripUnsupportedParameters(request);
    console.log('Azure AI request payload:', JSON.stringify(requestParams, null, 2));
    
    const response = await client.path("/chat/completions").post({
      queryParameters: {
        'api-version': '2024-12-01-preview'
      },
      body: {
        messages: request.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        model: deploymentName,
        temperature: request.temperature,
        max_tokens: requestParams.max_tokens,
        top_p: request.top_p,
        stream: false
      }
    });
    console.log('Azure AI raw response:', JSON.stringify(response, null, 2));

    console.log('Azure AI response status:', response.status);

    if (response.status !== "200") {
      const errorText = await new Response(response.body as unknown as BodyInit).text();
      try {
        const parsedError = JSON.parse(errorText);
        console.error('Azure AI error:', parsedError);
        
        return new Response(JSON.stringify({
          error: {
            message: parsedError.error?.message || 'Azure AI request failed',
            type: 'azure_error',
            code: parsedError.error?.code || 'unknown_error',
          },
        }), {
          status: parseInt(response.status, 10),
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({
          error: {
            message: `Azure AI request failed: ${errorText}`,
            type: 'azure_error',
            code: 'parse_error',
          },
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const responseBody = response.body as AzureApiResponse;
    console.log('Azure AI response body:', responseBody);

    const chatCompletionResponse: ChatCompletionResponse = {
      id: crypto.randomUUID(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelName,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseBody.choices[0].message.content || '',
        },
        finish_reason: 'stop',
      }],
    };

    return new Response(JSON.stringify(chatCompletionResponse), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return handleError(error);
  }
}

async function handleGitHubChatCompletion(
  request: ChatCompletionRequest, 
  env: Env,
  config: ReturnType<typeof createConfig>
): Promise<Response> {
  if (!env.GITHUB_API_KEY) {
    return new Response(JSON.stringify({
      error: {
        message: 'GitHub API key not configured',
        type: 'configuration_error',
        code: 'missing_api_key',
      },
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const validation = validateParameters(request);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        error: {
          message: validation.error,
          type: 'invalid_request_error',
          code: 'invalid_parameters',
        },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const requestParams = stripUnsupportedParameters(request);
    console.log('GitHub API request payload:', JSON.stringify(requestParams, null, 2));

    const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GITHUB_API_KEY}`,
      },
      body: JSON.stringify({
        messages: request.messages,
        model: request.model || config.defaultModel,
        temperature: request.temperature,
        max_tokens: requestParams.max_tokens,
        top_p: request.top_p,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json() as AzureErrorResponse;
      return new Response(JSON.stringify({
        error: {
          message: errorData.error?.message || 'GitHub API request failed',
          type: 'github_error',
          code: errorData.error?.code || 'unknown_error',
        },
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const responseBody = await response.json() as AzureApiResponse;
    const chatCompletionResponse: ChatCompletionResponse = {
      id: crypto.randomUUID(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model || config.defaultModel,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseBody.choices[0].message.content || '',
        },
        finish_reason: 'stop',
      }],
    };

    return new Response(JSON.stringify(chatCompletionResponse), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return handleError(error);
  }
}

async function handleChatCompletion(request: Request, env: Env): Promise<Response> {
  try {
    const config = createConfig(env);
    const requestBody: ChatCompletionRequest = await request.json();
    const modelName = requestBody.model || config.defaultModel;

    if (!isValidModel(modelName, config)) {
      return new Response(JSON.stringify({
        error: {
          message: `Model ${modelName} not supported`,
          type: 'invalid_request_error',
          code: 'model_not_found',
        },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // All models are now handled by Azure
    return handleAzureChatCompletion(requestBody, env, config);
  } catch (error) {
    return handleError(error);
  }
}

import { modelMappings as modelCapabilities } from './models';

async function handleModels(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const config = createConfig(env);
  const configMappings = config.modelMappings;

  const response = {
    object: 'list',
    data: Object.entries(configMappings).map(([id, deploymentName]) => {
      const capabilities = modelCapabilities[id] || {
        capabilities: {
          contextWindow: 8192,
          maxTokens: 4096,
          supportsFunctions: false,
          supportsVision: false
        }
      };

      return {
        id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: capabilities.provider || 'azure',
        permission: [],
        root: id,
        parent: null,
        context_window: capabilities.capabilities.contextWindow,
        max_tokens: capabilities.capabilities.maxTokens
      };
    })
  };

  return new Response(JSON.stringify(response, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    console.log('Received request:', request.method, request.url);
    
    const url = new URL(request.url);
    console.log('Path:', url.pathname);
    
    // Handle different API endpoints
    if (url.pathname === '/v1/models') {
      return handleModels(request, env);
    }
    
    if (url.pathname === '/v1/chat/completions') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }
      return handleChatCompletion(request, env);
    }
    
    console.log('Path not found:', url.pathname);
    return new Response('Not found', { status: 404 });
  },
};
