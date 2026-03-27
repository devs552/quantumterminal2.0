import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { APIResponse } from './types';

class APIClient {
  private client: AxiosInstance;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL: Map<string, number> = new Map();

  constructor() {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for caching
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('[API Client] Error:', error.message);
        throw error;
      }
    );
  }

  /**
   * Set cache TTL for a specific endpoint
   */
  setCacheTTL(endpoint: string, ttl: number) {
    this.cacheTTL.set(endpoint, ttl);
  }

  /**
   * Get cached data if valid
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const ttl = this.cacheTTL.get(key) || 60000; // 60 seconds default
    const isExpired = Date.now() - cached.timestamp > ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cache data
   */
  private setCache(key: string, data: any) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Generic GET request with caching
   */
  async get<T>(
    endpoint: string,
    config?: AxiosRequestConfig,
    useCache = true
  ): Promise<T> {
    const cacheKey = `GET:${endpoint}`;

    if (useCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await this.client.get<T>(endpoint, config);
      if (useCache) {
        this.setCache(cacheKey, response.data);
      }
      return response.data;
    } catch (error: any) {
      console.error(`[API] GET ${endpoint} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Generic POST request
   */
  async post<T>(
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response = await this.client.post<T>(endpoint, data, config);
      return response.data;
    } catch (error: any) {
      console.error(`[API] POST ${endpoint} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch market data
   */
  async getMarketData(config?: AxiosRequestConfig) {
    return this.get('/api/data/markets', config, true);
  }

  /**
   * Fetch crypto data
   */
  async getCryptoData(config?: AxiosRequestConfig) {
    return this.get('/api/data/crypto', config, true);
  }

  /**
   * Fetch macro indicators
   */
  async getMacroData(config?: AxiosRequestConfig) {
    return this.get('/api/data/macro', config, true);
  }

  /**
   * Fetch news
   */
  async getNews(limit = 50, config?: AxiosRequestConfig) {
    return this.get(`/api/data/news?limit=${limit}`, config, true);
  }

  /**
   * Fetch map layer data
   */
  async getMapLayerData(layerId: string, config?: AxiosRequestConfig) {
    return this.get(`/api/data/layers/${layerId}`, config, true);
  }

  /**
   * Request AI analysis
   */
  async requestAIAnalysis(data: any, config?: AxiosRequestConfig) {
    return this.post('/api/ai/analyze', data, config);
  }

  /**
   * Stream AI analysis
   */
  async *streamAIAnalysis(data: any): AsyncGenerator<string> {
    try {
      const response = await fetch(`${this.client.defaults.baseURL}/api/ai/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield decoder.decode(value, { stream: true });
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error: any) {
      console.error('[API] Stream failed:', error.message);
      throw error;
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(key: string) {
    this.cache.delete(key);
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export type for use in components
export type { APIResponse };
