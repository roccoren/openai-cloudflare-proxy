import { ModelMapping } from './types';

/**
 * Model mappings configuration
 * Add or modify models and their capabilities here
 */
export const modelMappings: ModelMapping = {
  'gpt-4': {
    provider: 'azure',
    deploymentName: 'gpt-4',
    capabilities: {
      contextWindow: 8192,
      maxTokens: 4096,
      supportsFunctions: true,
      supportsVision: false
    }
  },
  'gpt-4-turbo': {
    provider: 'azure',
    deploymentName: 'gpt-4-turbo',
    capabilities: {
      contextWindow: 128000,
      maxTokens: 4096,
      supportsFunctions: true,
      supportsVision: true
    }
  },
  'DeepSeek-R1': {
    provider: 'github',
    capabilities: {
      contextWindow: 32768,
      maxTokens: 8192,
      supportsFunctions: true,
      supportsVision: false
    }
  }
};