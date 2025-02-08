/**
 * Configuration interfaces for AI model providers
 */
export interface Env {
  AZURE_API_KEY: string;
  AZURE_ENDPOINT?: string;
  AZURE_RESOURCE_NAME?: string;
  AZURE_DEPLOYMENT_NAME?: string;
  GITHUB_API_KEY?: string;
  MODEL_MAPPINGS?: string;
}

export interface AzureConfig {
  baseURL: string;
  apiKey: string;
  resourceName?: string;
  deploymentName?: string;
  apiVersion: string;
  model?: string;
}

export interface GitHubConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface ProxyConfig {
  azure: AzureConfig;
  github?: GitHubConfig;
  defaultProvider: 'azure' | 'github';
  defaultModel: string;
  defaultApiVersion: string;
  modelMappings: Record<string, string>;
}

/**
 * Build Azure configuration from environment variables
 */
const buildAzureConfig = (env: Partial<Env>): AzureConfig => {
  // Support both traditional Azure OpenAI and new AI Inference endpoints
  const baseURL = env.AZURE_ENDPOINT || 
    (env.AZURE_RESOURCE_NAME && env.AZURE_DEPLOYMENT_NAME ? 
      `https://${env.AZURE_RESOURCE_NAME}.openai.azure.com/openai/deployments/${env.AZURE_DEPLOYMENT_NAME}` :
      'https://models.inference.ai.azure.com');

  return {
    apiKey: env.AZURE_API_KEY || '',
    resourceName: env.AZURE_RESOURCE_NAME,
    deploymentName: env.AZURE_DEPLOYMENT_NAME,
    apiVersion: '2024-12-01-preview',
    baseURL,
    model: 'DeepSeek-R1'
  };
};

/**
 * Build GitHub configuration from environment variables
 */
const buildGitHubConfig = (env: Partial<Env>): GitHubConfig | undefined => {
  if (!env.GITHUB_API_KEY) {
    return undefined;
  }
  
  return {
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: env.GITHUB_API_KEY,
    model: 'DeepSeek-R1',
  };
};

/**
 * Type guard to check if value is a Record<string, string>
 */
function isStringRecord(obj: unknown): obj is Record<string, string> {
  return typeof obj === 'object' && obj !== null && Object.values(obj).every(value => typeof value === 'string');
}

/**
 * Parse model mappings from environment variable and convert keys to lowercase
 */
const parseModelMappings = (env: Partial<Env>): Record<string, string> => {
  if (!env.MODEL_MAPPINGS) {
    return {};
  }

  try {
    const parsedJson = JSON.parse(env.MODEL_MAPPINGS);
    if (!isStringRecord(parsedJson)) {
      console.error('MODEL_MAPPINGS contains non-string values');
      return {};
    }

    // Convert all keys to lowercase while preserving the original deployment names
    const mappings = Object.entries(parsedJson).reduce((acc, [key, value]) => {
      acc[key.toLowerCase()] = value;
      return acc;
    }, {} as Record<string, string>);

    console.log('Parsed model mappings:', mappings); // Debug log
    return mappings;
  } catch (error) {
    console.error('Failed to parse MODEL_MAPPINGS:', error);
    return {};
  }
};

/**
 * Get deployment name for a model
 */
export function getDeploymentName(modelName: string, config: ProxyConfig): string {
  const deploymentName = config.modelMappings[modelName.toLowerCase()] || modelName;
  console.log(`getDeploymentName: modelName=${modelName}, deploymentName=${deploymentName}`);
  return deploymentName;
}

/**
 * Validate if a model exists in the mapping
 */
export function isValidModel(modelName: string, config: ProxyConfig): boolean {
  return modelName.toLowerCase() in config.modelMappings;
}

/**
 * Create configuration object with environment variables
 */
export function createConfig(env: Partial<Env> = {}): ProxyConfig {
  const github = buildGitHubConfig(env);
  const modelMappings = parseModelMappings(env);
  
  return {
    azure: buildAzureConfig(env),
    github,
    defaultProvider: github ? 'github' : 'azure',
    defaultModel: 'DeepSeek-R1',
    defaultApiVersion: 'v1',
    modelMappings
  };
}

// Export empty default config - actual config will be created with env variables at runtime
const config: ProxyConfig = createConfig();

export default config;