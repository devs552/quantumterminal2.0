import axios from 'axios';
import { MarketData, CryptoData, MacroIndicator, NewsArticle } from './types';

/**
 * External API Clients for real-time data integration
 * This module handles integration with free-tier APIs for real data
 */

// ============= CoinGecko API =============
export const coinGeckoAPI = {
  baseURL: 'https://api.coingecko.com/api/v3',

  async getGlobalData() {
    try {
      const response = await axios.get(`${this.baseURL}/global`);
      return response.data;
    } catch (error) {
      console.error('[CoinGecko] Global data fetch failed:', error);
      return null;
    }
  },

  async getCryptoPrice(ids: string[]) {
    try {
      const response = await axios.get(`${this.baseURL}/simple/price`, {
        params: {
          ids: ids.join(','),
          vs_currencies: 'usd',
          include_market_cap: true,
          include_24hr_vol: true,
          include_24hr_change: true,
        },
      });
      return response.data;
    } catch (error) {
      console.error('[CoinGecko] Price fetch failed:', error);
      return null;
    }
  },

  async getMarketData(order: string = 'market_cap_desc', perPage: number = 250) {
    try {
      const response = await axios.get(`${this.baseURL}/coins/markets`, {
        params: {
          vs_currency: 'usd',
          order,
          per_page: perPage,
          page: 1,
          sparkline: true,
          price_change_percentage: '24h',
        },
      });
      return response.data;
    } catch (error) {
      console.error('[CoinGecko] Market data fetch failed:', error);
      return null;
    }
  },
};

// ============= Alpha Vantage API =============
export const alphaVantageAPI = {
  baseURL: 'https://www.alphavantage.co/query',
  apiKey: process.env.ALPHA_VANTAGE_API_KEY || 'demo',

  async getQuote(symbol: string) {
    try {
      const response = await axios.get(this.baseURL, {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol,
          apikey: this.apiKey,
        },
      });
      return response.data['Global Quote'];
    } catch (error) {
      console.error(`[Alpha Vantage] Quote fetch for ${symbol} failed:`, error);
      return null;
    }
  },

  async getIntraday(symbol: string, interval: string = '5min') {
    try {
      const response = await axios.get(this.baseURL, {
        params: {
          function: 'TIME_SERIES_INTRADAY',
          symbol,
          interval,
          apikey: this.apiKey,
        },
      });
      return response.data;
    } catch (error) {
      console.error(`[Alpha Vantage] Intraday fetch for ${symbol} failed:`, error);
      return null;
    }
  },

  async getDaily(symbol: string) {
    try {
      const response = await axios.get(this.baseURL, {
        params: {
          function: 'TIME_SERIES_DAILY',
          symbol,
          apikey: this.apiKey,
        },
      });
      return response.data;
    } catch (error) {
      console.error(`[Alpha Vantage] Daily fetch for ${symbol} failed:`, error);
      return null;
    }
  },
};

// ============= NewsAPI =============
export const newsAPI = {
  baseURL: 'https://newsapi.org/v2',
  apiKey: process.env.NEWS_API_KEY || '',

  async getHeadlines(
    query?: string,
    sortBy: string = 'publishedAt',
    pageSize: number = 100
  ) {
    try {
      if (!this.apiKey) {
        console.warn('[NewsAPI] No API key provided');
        return null;
      }

      const response = await axios.get(`${this.baseURL}/everything`, {
        params: {
          q: query || 'markets OR crypto OR economy OR geopolitics',
          sortBy,
          pageSize,
          language: 'en',
          apiKey: this.apiKey,
        },
      });
      return response.data.articles;
    } catch (error) {
      console.error('[NewsAPI] Headlines fetch failed:', error);
      return null;
    }
  },

  async getTopHeadlines(country: string = 'us') {
    try {
      if (!this.apiKey) {
        console.warn('[NewsAPI] No API key provided');
        return null;
      }

      const response = await axios.get(`${this.baseURL}/top-headlines`, {
        params: {
          country,
          apiKey: this.apiKey,
        },
      });
      return response.data.articles;
    } catch (error) {
      console.error('[NewsAPI] Top headlines fetch failed:', error);
      return null;
    }
  },
};

// ============= FRED (Federal Reserve Economic Data) API =============
export const fredAPI = {
  baseURL: 'https://api.stlouisfed.org/fred/series/observations?series_id=UNRATE&api_key=YOUR_KEY&limit=1&file_type=json',
  apiKey: process.env.FRED_API_KEY || '',

  async getSeries(seriesId: string, limit: number = 1) {
  try {
    console.log('[FRED] apiKey present:', !!this.apiKey, 'seriesId:', seriesId);
    
    const response = await axios.get(`${this.baseURL}/series/observations`, {
      params: {
        series_id: seriesId,
        api_key: this.apiKey,
        limit,
        sort_order: 'desc',
        file_type: 'json',
      },
    });
    console.log('[FRED] response status:', response.status, 'data:', JSON.stringify(response.data).slice(0, 200));
    return response.data.observations;
  } catch (error: any) {
    console.error(`[FRED] Series ${seriesId} fetch failed:`, error?.response?.status, error?.response?.data || error?.message);
    return null;
  }
},
  async getLatest(seriesId: string) {
    const data = await this.getSeries(seriesId, 1);
    return data?.[0] || null;
  },
};

// ============= OpenWeatherMap API =============
export const weatherAPI = {
  baseURL: 'https://api.openweathermap.org/data/2.5',
  apiKey: process.env.OPENWEATHER_API_KEY || '',

  async getWeather(lat: number, lon: number) {
    try {
      if (!this.apiKey) {
        console.warn('[Weather] No API key provided');
        return null;
      }

      const response = await axios.get(`${this.baseURL}/weather`, {
        params: {
          lat,
          lon,
          appid: this.apiKey,
        },
      });
      return response.data;
    } catch (error) {
      console.error('[Weather] Fetch failed:', error);
      return null;
    }
  },
};

// ============= Data Transformation Utilities =============

/**
 * Transform CoinGecko data to internal format
 */
export function transformCoinGeckoToCrypto(data: any[]): CryptoData[] {
  return data.map((coin) => ({
    symbol: coin.symbol.toUpperCase(),
    price: coin.current_price || 0,
    marketCap: coin.market_cap,
    volume24h: coin.total_volume,
    change24h: coin.price_change_percentage_24h,
    dominance: coin.market_cap_percentage,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Transform Alpha Vantage quote to internal format
 */
export function transformAlphaVantageQuote(data: any): MarketData {
  return {
    symbol: data['01. symbol'],
    open: parseFloat(data['02. open']),
    high: parseFloat(data['03. high']),
    low: parseFloat(data['04. low']),
    close: parseFloat(data['05. price']),
    volume: parseFloat(data['06. volume']),
    change: parseFloat(data['09. change']),
    changePercent: parseFloat(data['10. change percent']),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Transform NewsAPI article to internal format
 */
export function transformNewsAPIArticle(article: any): NewsArticle {
  // Simple sentiment analysis based on keywords
  const negativekeywords = ['crash', 'plunge', 'decline', 'fall', 'loss', 'crisis', 'collapse'];
  const positivekeywords = ['surge', 'rally', 'gain', 'rise', 'soar', 'boom', 'recovery'];
  
  const text = `${article.title} ${article.description}`.toLowerCase();
  const negativeCount = negativekeywords.filter(k => text.includes(k)).length;
  const positiveCount = positivekeywords.filter(k => text.includes(k)).length;
  
  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (positiveCount > negativeCount) sentiment = 'positive';
  if (negativeCount > positiveCount) sentiment = 'negative';

  return {
    id: article.url,
    title: article.title,
    description: article.description,
    source: article.source.name,
    sourceUrl: article.url,
    author: article.author,
    imageUrl: article.urlToImage,
    sentiment,
    sentimentScore: (positiveCount - negativeCount) / Math.max(1, positiveCount + negativeCount),
    relevantAssets: [],
    region: undefined,
    category: ['markets', 'news'],
    publishedAt: article.publishedAt,
  };
}

/**
 * Transform FRED data to internal format
 */
export function transformFREDtoMacro(seriesId: string, observation: any): MacroIndicator {
  const seriesNames: Record<string, string> = {
    UNRATE: 'Unemployment Rate',
    CPIAUCSL: 'CPI',
    CPILFESL: 'CPI (Core)',
    PPIACO: 'PPI',
    DEXUSEU: 'USD/EUR',
    M2SL: 'M2 Money Supply',
    FEDFUNDS: 'Fed Funds Rate',
    T10Y2Y: '10Y-2Y Yield Curve',
  };

  return {
    indicator: seriesId,
    country: 'United States',
    value: parseFloat(observation.value),
    unit: 'varies',
    period: 'monthly',
    releaseDate: observation.date,
  };
}

/**
 * Fetch from multiple sources with fallback
 */
export async function fetchWithFallback<T>(
  primary: () => Promise<T | null>,
  fallback: () => Promise<T | null>
): Promise<T | null> {
  try {
    const result = await primary();
    if (result) return result;
  } catch (error) {
    console.warn('Primary fetch failed, trying fallback');
  }

  try {
    return await fallback();
  } catch (error) {
    console.error('Both primary and fallback fetch failed');
    return null;
  }
}
