export interface ChatCompletionRequest {
  model?: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;  // Fallback for max_tokens
  top_p?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

export interface ErrorResponse {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

export interface ModelCapabilities {
  contextWindow: number;
  maxTokens: number;
  supportsFunctions: boolean;
  supportsVision: boolean;
}

export interface ModelInfo {
  provider: 'azure' | 'github';
  deploymentName?: string;
  capabilities: ModelCapabilities;
}

export interface ModelMapping {
  [key: string]: ModelInfo;
}