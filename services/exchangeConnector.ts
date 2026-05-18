import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import {
  Trade,
  OrderBook,
  Kline,
  ExchangeConfig,
  TradeHistoryConfig,
} from '@/lib/types';

// ── Base Exchange Connector ───────────────────────────────────────────────────

export interface IExchangeConnector {
  connect(): Promise<void>;
  disconnect(): void;
  getTrades(symbol: string, limit?: number): Promise<Trade[]>;
  getOrderBook(symbol: string, depth?: number): Promise<OrderBook>;
  getKlines(symbol: string, interval: string, limit?: number): Promise<Kline[]>;
  getHistoricalTrades(config: TradeHistoryConfig): Promise<Trade[]>;
  onTrade(callback: (trade: Trade) => void): void;
  onOrderBook(callback: (ob: OrderBook) => void): void;
  onKline(callback: (kline: Kline) => void): void;
}

// ── Binance Connector ─────────────────────────────────────────────────────────

export class BinanceConnector implements IExchangeConnector {
  private config: ExchangeConfig;
  private client: AxiosInstance;
  private wsClient: WebSocket | null = null;
  private baseUrl: string;
  private wsBaseUrl: string;
  private tradeCallback: ((trade: Trade) => void) | null = null;
  private obCallback: ((ob: OrderBook) => void) | null = null;
  private klineCallback: ((kline: Kline) => void) | null = null;
  private subscriptions: Map<string, any> = new Map();

  constructor(config: ExchangeConfig) {
    this.config = config;
    this.baseUrl = config.testnet
      ? 'https://testnet.binance.vision/api'
      : 'https://api.binance.com/api';
    this.wsBaseUrl = config.testnet
      ? 'wss://stream.testnet.binance.vision:9443'
      : 'wss://stream.binance.com:9443';

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: this.config.apiKey
        ? {
            'X-MBX-APIKEY': this.config.apiKey,
          }
        : {},
    });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Test connection
        this.client
          .get('/v3/ping')
          .then(() => resolve())
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
  }

  async getTrades(symbol: string, limit: number = 500): Promise<Trade[]> {
    try {
      const response = await this.client.get(`/v3/trades`, {
        params: { symbol: symbol.toUpperCase(), limit },
      });

      return response.data.map(
        (trade: any): Trade => ({
          id: `${trade.id}`,
          symbol: symbol.toUpperCase(),
          price: parseFloat(trade.price),
          quantity: parseFloat(trade.qty),
          side: trade.isBuyerMaker ? 'sell' : 'buy',
          timestamp: trade.time,
          exchange: 'binance',
          isBuyerMaker: trade.isBuyerMaker,
        })
      );
    } catch (error) {
      console.error('Error fetching Binance trades:', error);
      return [];
    }
  }

  async getOrderBook(symbol: string, depth: number = 20): Promise<OrderBook> {
    try {
      const response = await this.client.get(`/v3/depth`, {
        params: { symbol: symbol.toUpperCase(), limit: depth },
      });

      return {
        symbol: symbol.toUpperCase(),
        timestamp: response.data.E,
        bids: response.data.bids.map((bid: any) => ({
          price: parseFloat(bid[0]),
          quantity: parseFloat(bid[1]),
        })),
        asks: response.data.asks.map((ask: any) => ({
          price: parseFloat(ask[0]),
          quantity: parseFloat(ask[1]),
        })),
      };
    } catch (error) {
      console.error('Error fetching Binance orderbook:', error);
      return {
        symbol: symbol.toUpperCase(),
        timestamp: Date.now(),
        bids: [],
        asks: [],
      };
    }
  }

  async getKlines(
    symbol: string,
    interval: string,
    limit: number = 500
  ): Promise<Kline[]> {
    try {
      const response = await this.client.get(`/v3/klines`, {
        params: { symbol: symbol.toUpperCase(), interval, limit },
      });

      return response.data.map(
        (kline: any): Kline => ({
          symbol: symbol.toUpperCase(),
          interval,
          openTime: kline[0],
          closeTime: kline[6],
          open: parseFloat(kline[1]),
          high: parseFloat(kline[2]),
          low: parseFloat(kline[3]),
          close: parseFloat(kline[4]),
          volume: parseFloat(kline[7]),
          quoteVolume: parseFloat(kline[8]),
          trades: parseInt(kline[8], 10),
        })
      );
    } catch (error) {
      console.error('Error fetching Binance klines:', error);
      return [];
    }
  }

  async getHistoricalTrades(config: TradeHistoryConfig): Promise<Trade[]> {
    if (config.exchange !== 'binance') return [];

    if (config.method === 'binance-vision') {
      return this.fetchViaBinanceVision(config);
    } else {
      return this.fetchViaRestAPI(config);
    }
  }

  private async fetchViaBinanceVision(
    config: TradeHistoryConfig
  ): Promise<Trade[]> {
    try {
      // Binance Vision daily bulk downloads
      const startDate = new Date(config.startTime);
      const endDate = new Date(config.endTime);
      const dateStr = startDate.toISOString().split('T')[0];

      const url = `https://data.binance.vision/data/futures/um/daily/trades/${config.symbol.toUpperCase()}/${config.symbol.toUpperCase()}-trades-${dateStr}.zip`;

      // In production, would download and parse ZIP
      console.log('Binance Vision URL:', url);
      return [];
    } catch (error) {
      console.error('Error fetching from Binance Vision:', error);
      return [];
    }
  }

  private async fetchViaRestAPI(
    config: TradeHistoryConfig
  ): Promise<Trade[]> {
    const trades: Trade[] = [];
    let fromId = 0;

    try {
      while (trades.length < (config.limit || 1000)) {
        const response = await this.client.get(`/v3/aggTrades`, {
          params: {
            symbol: config.symbol.toUpperCase(),
            fromId,
            limit: Math.min(1000, (config.limit || 1000) - trades.length),
          },
        });

        if (response.data.length === 0) break;

        trades.push(
          ...response.data
            .filter(
              (t: any) =>
                t.T >= config.startTime && t.T <= config.endTime
            )
            .map(
              (trade: any): Trade => ({
                id: `${trade.a}`,
                symbol: config.symbol.toUpperCase(),
                price: parseFloat(trade.p),
                quantity: parseFloat(trade.q),
                side: trade.m ? 'sell' : 'buy',
                timestamp: trade.T,
                exchange: 'binance',
                aggId: `${trade.a}`,
                isBuyerMaker: trade.m,
              })
            )
        );

        fromId = response.data[response.data.length - 1].a + 1;
      }
    } catch (error) {
      console.error('Error fetching from Binance REST API:', error);
    }

    return trades;
  }

  onTrade(callback: (trade: Trade) => void): void {
    this.tradeCallback = callback;
  }

  onOrderBook(callback: (ob: OrderBook) => void): void {
    this.obCallback = callback;
  }

  onKline(callback: (kline: Kline) => void): void {
    this.klineCallback = callback;
  }

  subscribeToTrades(symbol: string): void {
    if (this.wsClient?.readyState === WebSocket.OPEN) {
      const subscription = {
        method: 'SUBSCRIBE',
        params: [`${symbol.toLowerCase()}@aggTrade`],
        id: Date.now(),
      };
      this.wsClient.send(JSON.stringify(subscription));
    }
  }

  subscribeToOrderBook(symbol: string, depth: number = 20): void {
    if (this.wsClient?.readyState === WebSocket.OPEN) {
      const subscription = {
        method: 'SUBSCRIBE',
        params: [
          `${symbol.toLowerCase()}@depth${depth}@100ms`,
        ],
        id: Date.now(),
      };
      this.wsClient.send(JSON.stringify(subscription));
    }
  }

  subscribeToKlines(symbol: string, interval: string): void {
    if (this.wsClient?.readyState === WebSocket.OPEN) {
      const subscription = {
        method: 'SUBSCRIBE',
        params: [`${symbol.toLowerCase()}@klines_${interval}`],
        id: Date.now(),
      };
      this.wsClient.send(JSON.stringify(subscription));
    }
  }
}

// ── Bybit Connector ───────────────────────────────────────────────────────────

export class BybitConnector implements IExchangeConnector {
  private config: ExchangeConfig;
  private client: AxiosInstance;
  private baseUrl: string;
  private tradeCallback: ((trade: Trade) => void) | null = null;
  private obCallback: ((ob: OrderBook) => void) | null = null;
  private klineCallback: ((kline: Kline) => void) | null = null;

  constructor(config: ExchangeConfig) {
    this.config = config;
    this.baseUrl = config.testnet
      ? 'https://api-testnet.bybit.com'
      : 'https://api.bybit.com';

    this.client = axios.create({ baseURL: this.baseUrl });
  }

  async connect(): Promise<void> {
    try {
      await this.client.get('/v5/market/time');
    } catch (error) {
      throw new Error('Failed to connect to Bybit');
    }
  }

  disconnect(): void {
    // Bybit REST API doesn't need disconnect
  }

  async getTrades(symbol: string, limit: number = 500): Promise<Trade[]> {
    try {
      const response = await this.client.get(`/v5/market/recent-trade`, {
        params: { symbol: symbol.toUpperCase(), limit },
      });

      return response.data.result.list.map(
        (trade: any): Trade => ({
          id: trade.execId,
          symbol: symbol.toUpperCase(),
          price: parseFloat(trade.price),
          quantity: parseFloat(trade.size),
          side: trade.side.toLowerCase() as 'buy' | 'sell',
          timestamp: parseInt(trade.time, 10),
          exchange: 'bybit',
        })
      );
    } catch (error) {
      console.error('Error fetching Bybit trades:', error);
      return [];
    }
  }

  async getOrderBook(symbol: string, depth: number = 20): Promise<OrderBook> {
    try {
      const response = await this.client.get(`/v5/market/orderbook`, {
        params: { symbol: symbol.toUpperCase(), limit: depth },
      });

      return {
        symbol: symbol.toUpperCase(),
        timestamp: parseInt(response.data.result.ts, 10),
        bids: response.data.result.b.map((bid: any) => ({
          price: parseFloat(bid[0]),
          quantity: parseFloat(bid[1]),
        })),
        asks: response.data.result.a.map((ask: any) => ({
          price: parseFloat(ask[0]),
          quantity: parseFloat(ask[1]),
        })),
      };
    } catch (error) {
      console.error('Error fetching Bybit orderbook:', error);
      return {
        symbol: symbol.toUpperCase(),
        timestamp: Date.now(),
        bids: [],
        asks: [],
      };
    }
  }

  async getKlines(
    symbol: string,
    interval: string,
    limit: number = 500
  ): Promise<Kline[]> {
    try {
      const response = await this.client.get(`/v5/market/kline`, {
        params: { symbol: symbol.toUpperCase(), interval, limit },
      });

      return response.data.result.list.map(
        (kline: any): Kline => ({
          symbol: symbol.toUpperCase(),
          interval,
          openTime: parseInt(kline[0], 10),
          closeTime: parseInt(kline[0], 10) + 60000,
          open: parseFloat(kline[1]),
          high: parseFloat(kline[2]),
          low: parseFloat(kline[3]),
          close: parseFloat(kline[4]),
          volume: parseFloat(kline[5]),
          quoteVolume: parseFloat(kline[6]),
        })
      );
    } catch (error) {
      console.error('Error fetching Bybit klines:', error);
      return [];
    }
  }

  async getHistoricalTrades(config: TradeHistoryConfig): Promise<Trade[]> {
    // Bybit does not have a suitable REST API for historical intraday trades
    console.warn('Historical trade fetching not supported for Bybit');
    return [];
  }

  onTrade(callback: (trade: Trade) => void): void {
    this.tradeCallback = callback;
  }

  onOrderBook(callback: (ob: OrderBook) => void): void {
    this.obCallback = callback;
  }

  onKline(callback: (kline: Kline) => void): void {
    this.klineCallback = callback;
  }
}

// ── Hyperliquid Connector ─────────────────────────────────────────────────────

export class HyperliquidConnector implements IExchangeConnector {
  private config: ExchangeConfig;
  private client: AxiosInstance;
  private baseUrl: string;
  private tradeCallback: ((trade: Trade) => void) | null = null;
  private obCallback: ((ob: OrderBook) => void) | null = null;
  private klineCallback: ((kline: Kline) => void) | null = null;

  constructor(config: ExchangeConfig) {
    this.config = config;
    this.baseUrl = 'https://api.hyperliquid.xyz';
    this.client = axios.create({ baseURL: this.baseUrl });
  }

  async connect(): Promise<void> {
    try {
      await this.client.post('/info', {
        type: 'wellKnownContractAddrs',
      });
    } catch (error) {
      throw new Error('Failed to connect to Hyperliquid');
    }
  }

  disconnect(): void {
    // Hyperliquid REST API doesn't need disconnect
  }

  async getTrades(symbol: string, limit: number = 500): Promise<Trade[]> {
    try {
      const response = await this.client.post('/info', {
        type: 'recentTrades',
        coin: symbol.toUpperCase(),
      });

      return response.data.map(
        (trade: any): Trade => ({
          id: `${trade.tradeId}`,
          symbol: symbol.toUpperCase(),
          price: parseFloat(trade.px),
          quantity: parseFloat(trade.sz),
          side: trade.side.toLowerCase() as 'buy' | 'sell',
          timestamp: trade.time,
          exchange: 'hyperliquid',
        })
      );
    } catch (error) {
      console.error('Error fetching Hyperliquid trades:', error);
      return [];
    }
  }

  async getOrderBook(symbol: string, depth: number = 20): Promise<OrderBook> {
    try {
      const response = await this.client.post('/info', {
        type: 'l2Book',
        coin: symbol.toUpperCase(),
      });

      return {
        symbol: symbol.toUpperCase(),
        timestamp: Date.now(),
        bids: response.data.bids
          .slice(0, depth)
          .map((bid: any) => ({
            price: parseFloat(bid.px),
            quantity: parseFloat(bid.sz),
          })),
        asks: response.data.asks
          .slice(0, depth)
          .map((ask: any) => ({
            price: parseFloat(ask.px),
            quantity: parseFloat(ask.sz),
          })),
      };
    } catch (error) {
      console.error('Error fetching Hyperliquid orderbook:', error);
      return {
        symbol: symbol.toUpperCase(),
        timestamp: Date.now(),
        bids: [],
        asks: [],
      };
    }
  }

  async getKlines(
    symbol: string,
    interval: string,
    limit: number = 500
  ): Promise<Kline[]> {
    try {
      const res = await this.client.post('/info', {
        type: 'candleSnapshot',
        req: {
          coin: symbol.toUpperCase(),
          interval,
          startTime: Date.now() - limit * this.intervalToMs(interval),
          endTime: Date.now(),
        },
      });

      return res.data.candles.map(
        (candle: any): Kline => ({
          symbol: symbol.toUpperCase(),
          interval,
          openTime: candle.t,
          closeTime: candle.t + this.intervalToMs(interval),
          open: parseFloat(candle.o),
          high: parseFloat(candle.h),
          low: parseFloat(candle.l),
          close: parseFloat(candle.c),
          volume: parseFloat(candle.v),
          quoteVolume: parseFloat(candle.v),
        })
      );
    } catch (error) {
      console.error('Error fetching Hyperliquid klines:', error);
      return [];
    }
  }

  async getHistoricalTrades(config: TradeHistoryConfig): Promise<Trade[]> {
    // Hyperliquid does not have a suitable REST API for historical intraday trades
    console.warn('Historical trade fetching not supported for Hyperliquid');
    return [];
  }

  onTrade(callback: (trade: Trade) => void): void {
    this.tradeCallback = callback;
  }

  onOrderBook(callback: (ob: OrderBook) => void): void {
    this.obCallback = callback;
  }

  onKline(callback: (kline: Kline) => void): void {
    this.klineCallback = callback;
  }

  private intervalToMs(interval: string): number {
    const intervals: Record<string, number> = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
    };
    return intervals[interval] || 60000;
  }
}

// ── OKX Connector (WIP) ───────────────────────────────────────────────────────

export class OKXConnector implements IExchangeConnector {
  private config: ExchangeConfig;
  private client: AxiosInstance;
  private baseUrl: string;
  private tradeCallback: ((trade: Trade) => void) | null = null;
  private obCallback: ((ob: OrderBook) => void) | null = null;
  private klineCallback: ((kline: Kline) => void) | null = null;

  constructor(config: ExchangeConfig) {
    this.config = config;
    this.baseUrl = 'https://www.okx.com/api/v5';
    this.client = axios.create({ baseURL: this.baseUrl });
  }

  async connect(): Promise<void> {
    try {
      await this.client.get('/public/time');
    } catch (error) {
      throw new Error('Failed to connect to OKX');
    }
  }

  disconnect(): void {
    // OKX REST API doesn't need disconnect
  }

  async getTrades(symbol: string, limit: number = 500): Promise<Trade[]> {
    try {
      const instId = `${symbol.toUpperCase()}-USDT`;
      const response = await this.client.get(
        `/market/trades?instId=${instId}&limit=${limit}`
      );

      return response.data.data.map(
        (trade: any): Trade => ({
          id: trade.tradeId,
          symbol: symbol.toUpperCase(),
          price: parseFloat(trade.px),
          quantity: parseFloat(trade.sz),
          side: trade.side === 'buy' ? 'buy' : 'sell',
          timestamp: parseInt(trade.ts, 10),
          exchange: 'okx',
        })
      );
    } catch (error) {
      console.error('Error fetching OKX trades:', error);
      return [];
    }
  }

  async getOrderBook(symbol: string, depth: number = 20): Promise<OrderBook> {
    try {
      const instId = `${symbol.toUpperCase()}-USDT`;
      const response = await this.client.get(
        `/market/books?instId=${instId}&sz=${depth}`
      );

      const book = response.data.data[0];
      return {
        symbol: symbol.toUpperCase(),
        timestamp: parseInt(book.ts, 10),
        bids: book.bids.map((bid: any) => ({
          price: parseFloat(bid[0]),
          quantity: parseFloat(bid[1]),
        })),
        asks: book.asks.map((ask: any) => ({
          price: parseFloat(ask[0]),
          quantity: parseFloat(ask[1]),
        })),
      };
    } catch (error) {
      console.error('Error fetching OKX orderbook:', error);
      return {
        symbol: symbol.toUpperCase(),
        timestamp: Date.now(),
        bids: [],
        asks: [],
      };
    }
  }

  async getKlines(
    symbol: string,
    interval: string,
    limit: number = 500
  ): Promise<Kline[]> {
    try {
      const instId = `${symbol.toUpperCase()}-USDT`;
      const response = await this.client.get(
        `/market/candles?instId=${instId}&bar=${interval}&limit=${limit}`
      );

      return response.data.data.map(
        (kline: any): Kline => ({
          symbol: symbol.toUpperCase(),
          interval,
          openTime: parseInt(kline[0], 10),
          closeTime: parseInt(kline[0], 10),
          open: parseFloat(kline[1]),
          high: parseFloat(kline[2]),
          low: parseFloat(kline[3]),
          close: parseFloat(kline[4]),
          volume: parseFloat(kline[6]),
          quoteVolume: parseFloat(kline[7]),
        })
      );
    } catch (error) {
      console.error('Error fetching OKX klines:', error);
      return [];
    }
  }

  async getHistoricalTrades(config: TradeHistoryConfig): Promise<Trade[]> {
    // OKX support is WIP
    console.warn('Historical trade fetching is WIP for OKX');
    return [];
  }

  onTrade(callback: (trade: Trade) => void): void {
    this.tradeCallback = callback;
  }

  onOrderBook(callback: (ob: OrderBook) => void): void {
    this.obCallback = callback;
  }

  onKline(callback: (kline: Kline) => void): void {
    this.klineCallback = callback;
  }
}

// ── Factory Function ──────────────────────────────────────────────────────────

export function createExchangeConnector(
  config: ExchangeConfig
): IExchangeConnector {
  switch (config.name) {
    case 'binance':
      return new BinanceConnector(config);
    case 'bybit':
      return new BybitConnector(config);
    case 'hyperliquid':
      return new HyperliquidConnector(config);
    case 'okx':
      return new OKXConnector(config);
    default:
      throw new Error(`Unknown exchange: ${config.name}`);
  }
}
