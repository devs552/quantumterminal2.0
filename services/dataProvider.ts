// Data Provider Service - Hybrid approach with external APIs + mock data
// Manages polling, caching, and real-time updates

import { 
  generateMarketData, 
  generateCryptoData, 
  generateMacroData,
  getUpdatedMarketData,
  getUpdatedCryptoData,
} from '@/lib/mockData';

export class DataProvider {
  private marketDataCache: any[] = [];
  private cryptoDataCache: any[] = [];
  private macroDataCache: any[] = [];
  private lastUpdateMarket: number = 0;
  private lastUpdateCrypto: number = 0;
  private lastUpdateMacro: number = 0;
  private cacheExpiry: number = 60000; // 60 seconds

  async getMarketData() {
    if (Date.now() - this.lastUpdateMarket > this.cacheExpiry) {
      this.marketDataCache = generateMarketData();
      this.lastUpdateMarket = Date.now();
    }
    return this.marketDataCache;
  }

  async getCryptoData() {
    if (Date.now() - this.lastUpdateCrypto > this.cacheExpiry) {
      this.cryptoDataCache = generateCryptoData();
      this.lastUpdateCrypto = Date.now();
    }
    return this.cryptoDataCache;
  }

  async getMacroData() {
    if (Date.now() - this.lastUpdateMacro > this.cacheExpiry) {
      this.macroDataCache = generateMacroData();
      this.lastUpdateMacro = Date.now();
    }
    return this.macroDataCache;
  }

  // Real-time updates with interval
  subscribeToMarketData(callback: (data: any) => void, interval: number = 5000) {
    const intervalId = setInterval(async () => {
      const data = await this.getMarketData();
      const updated = getUpdatedMarketData(data);
      this.marketDataCache = updated;
      callback(updated);
    }, interval);

    return () => clearInterval(intervalId);
  }

  subscribeToCryptoData(callback: (data: any) => void, interval: number = 3000) {
    const intervalId = setInterval(async () => {
      const data = await this.getCryptoData();
      const updated = getUpdatedCryptoData(data);
      this.cryptoDataCache = updated;
      callback(updated);
    }, interval);

    return () => clearInterval(intervalId);
  }

  // External API integrations (to be implemented)
  async fetchFromCoinGecko(ids: string[]) {
    // Example: Integration with CoinGecko API
    // const response = await fetch(
    //   `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_vol=true`
    // );
    // return response.json();
    console.log('CoinGecko API integration ready');
  }

  async fetchFromAlphaVantage(symbol: string) {
    // Example: Integration with Alpha Vantage API
    // const response = await fetch(
    //   `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min`
    // );
    // return response.json();
    console.log('Alpha Vantage API integration ready');
  }

  async fetchFromFRED(seriesId: string) {
    // Example: Integration with Federal Reserve Economic Data
    // const response = await fetch(
    //   `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}`
    // );
    // return response.json();
    console.log('FRED API integration ready');
  }

  async fetchNewsFromNewsAPI(query: string) {
    // Example: Integration with NewsAPI
    // const response = await fetch(
    //   `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt`
    // );
    // return response.json();
    console.log('NewsAPI integration ready');
  }

  clearCache() {
    this.marketDataCache = [];
    this.cryptoDataCache = [];
    this.macroDataCache = [];
    this.lastUpdateMarket = 0;
    this.lastUpdateCrypto = 0;
    this.lastUpdateMacro = 0;
  }
}

export const dataProvider = new DataProvider();
