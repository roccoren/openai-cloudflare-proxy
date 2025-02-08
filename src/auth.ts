import { ErrorResponse } from './types';

class KeyManager {
  private static instance: KeyManager;
  private cache: Map<string, { key: string; timestamp: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.cache = new Map();
  }

  static getInstance(): KeyManager {
    if (!KeyManager.instance) {
      KeyManager.instance = new KeyManager();
    }
    return KeyManager.instance;
  }

  private isValidKey(key: string): boolean {
    return typeof key === 'string' && key.length > 0;
  }

  private getCachedKey(cacheKey: string): string | null {
    const cached = this.cache.get(cacheKey);
    if (cached) {
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.key;
      }
      this.cache.delete(cacheKey);
    }
    return null;
  }

  private cacheKey(key: string, cacheKey: string): void {
    this.cache.set(cacheKey, {
      key,
      timestamp: Date.now()
    });
  }

  async getAzureKey(request: Request, env: { AZURE_API_KEY?: string }): Promise<string> {
    // Check cache first
    const cachedKey = this.getCachedKey('azure');
    if (cachedKey) {
      return cachedKey;
    }

    // Priority 1: Environment variable
    if (env.AZURE_API_KEY) {
      if (await this.validateKey(env.AZURE_API_KEY)) {
        this.cacheKey(env.AZURE_API_KEY, 'azure');
        return env.AZURE_API_KEY;
      }
    }

    // Priority 2: Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match && await this.validateKey(match[1])) {
        this.cacheKey(match[1], 'azure');
        return match[1];
      }
    }

    // Priority 3: api-key header
    const apiKey = request.headers.get('api-key');
    if (apiKey && await this.validateKey(apiKey)) {
      this.cacheKey(apiKey, 'azure');
      return apiKey;
    }

    throw new ApiKeyError('Missing or invalid Azure API key');
  }

  async validateKey(key: string): Promise<boolean> {
    try {
      // Basic validation
      if (!this.isValidKey(key)) {
        return false;
      }

      // Additional validation could be added here, such as:
      // - Key format validation
      // - Key introspection
      // - Network call to validate the key with Azure

      return true;
    } catch (error) {
      console.error('Error validating key:', error);
      return false;
    }
  }
}

export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyError';
  }

  toResponse(): Response {
    const errorResponse: ErrorResponse = {
      error: {
        message: this.message,
        type: 'authentication_error',
        code: 'invalid_api_key',
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const keyManager = KeyManager.getInstance();