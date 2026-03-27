// Mock Data Generator for Quantum Terminal
// In production, these would be replaced with real API calls

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  volume: number;
  timestamp: number;
}

export interface CryptoData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  dominance: number;
  timestamp: number;
}

export interface MacroIndicator {
  name: string;
  value: number;
  previous: number;
  unit: string;
  timestamp: number;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  region: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  impact: 'high' | 'medium' | 'low';
  timestamp: number;
  content: string;
}

export interface ConflictEvent {
  id: string;
  location: string;
  latitude: number;
  longitude: number;
  severity: number; // 0-10
  type: string;
  timestamp: number;
  description: string;
}

// Market Data Generators
export function generateMarketData(): MarketData[] {
  return [
    { symbol: 'SPX', price: 4782.61, change: 1.24, volume: 2.3e9, timestamp: Date.now() },
    { symbol: 'NDX', price: 16384.45, change: 2.15, volume: 1.8e9, timestamp: Date.now() },
    { symbol: 'DXY', price: 104.32, change: -0.58, volume: 500e6, timestamp: Date.now() },
    { symbol: 'GOLD', price: 2034.50, change: 0.92, volume: 250e6, timestamp: Date.now() },
    { symbol: 'CL', price: 78.45, change: -1.23, volume: 180e6, timestamp: Date.now() },
    { symbol: 'VIX', price: 15.32, change: -2.10, volume: 100e6, timestamp: Date.now() },
  ];
}

export function generateCryptoData(): CryptoData[] {
  return [
    { symbol: 'BTC', price: 42156.78, change24h: 3.45, volume24h: 28.5e9, dominance: 48.2, timestamp: Date.now() },
    { symbol: 'ETH', price: 2234.56, change24h: 2.89, volume24h: 12.3e9, dominance: 18.5, timestamp: Date.now() },
    { symbol: 'SOL', price: 142.34, change24h: 5.12, volume24h: 2.1e9, dominance: 2.3, timestamp: Date.now() },
    { symbol: 'XRP', price: 2.48, change24h: 1.23, volume24h: 1.8e9, dominance: 1.9, timestamp: Date.now() },
  ];
}

export function generateMacroData(): MacroIndicator[] {
  return [
    { name: 'CPI (YoY)', value: 3.2, previous: 3.4, unit: '%', timestamp: Date.now() },
    { name: 'Unemployment', value: 3.7, previous: 3.8, unit: '%', timestamp: Date.now() },
    { name: 'GDP Growth', value: 2.8, previous: 2.4, unit: 'Q%', timestamp: Date.now() },
    { name: 'Fed Funds Rate', value: 5.5, previous: 5.5, unit: '%', timestamp: Date.now() },
    { name: 'M2 Money', value: -2.1, previous: -2.3, unit: '%', timestamp: Date.now() },
  ];
}

export function generateNewsItems(): NewsItem[] {
  const newsItems: NewsItem[] = [
    {
      id: '1',
      title: 'Fed Signals Potential Rate Cut in Q2',
      source: 'Reuters',
      region: 'Americas',
      sentiment: 'positive',
      impact: 'high',
      timestamp: Date.now() - 300000,
      content: 'Federal Reserve officials hint at future rate cuts...',
    },
    {
      id: '2',
      title: 'ECB Maintains Hawkish Stance',
      source: 'Bloomberg',
      region: 'Europe',
      sentiment: 'neutral',
      impact: 'high',
      timestamp: Date.now() - 600000,
      content: 'European Central Bank keeps rates unchanged...',
    },
    {
      id: '3',
      title: 'China GDP Beats Expectations',
      source: 'Al Jazeera',
      region: 'Asia',
      sentiment: 'positive',
      impact: 'medium',
      timestamp: Date.now() - 1200000,
      content: 'Chinese economic growth accelerates in Q1...',
    },
  ];
  return newsItems;
}

export function generateConflictEvents(): ConflictEvent[] {
  return [
    {
      id: '1',
      location: 'Eastern Europe',
      latitude: 50.2,
      longitude: 30.5,
      severity: 8,
      type: 'Military Activity',
      timestamp: Date.now() - 1800000,
      description: 'Increased military activity detected',
    },
    {
      id: '2',
      location: 'Middle East',
      latitude: 35.5,
      longitude: 40.2,
      severity: 7,
      type: 'Conflict Zone',
      timestamp: Date.now() - 3600000,
      description: 'Active conflict ongoing',
    },
    {
      id: '3',
      location: 'South China Sea',
      latitude: 10.5,
      longitude: 106.5,
      severity: 5,
      type: 'Strategic Waterway',
      timestamp: Date.now() - 7200000,
      description: 'Increased surveillance activity',
    },
  ];
}

export function generateAIInsights() {
  return {
    riskScore: 6.8,
    riskLevel: 'ELEVATED',
    sentiment: {
      bullish: 42,
      neutral: 35,
      bearish: 23,
    },
    alerts: [
      'USD/CHF correlation break detected',
      'BTC whale accumulation observed',
      'ECB hawkish bias continuing',
    ],
    forecast: 'Markets expected to consolidate near current levels with elevated volatility',
  };
}

// Utility function to simulate real-time updates
export function getUpdatedMarketData(baseData: MarketData[]): MarketData[] {
  return baseData.map((data) => ({
    ...data,
    price: data.price * (1 + (Math.random() - 0.5) * 0.01),
    change: data.change + (Math.random() - 0.5) * 0.2,
    volume: data.volume * (0.9 + Math.random() * 0.2),
    timestamp: Date.now(),
  }));
}

export function getUpdatedCryptoData(baseData: CryptoData[]): CryptoData[] {
  return baseData.map((data) => ({
    ...data,
    price: data.price * (1 + (Math.random() - 0.5) * 0.015),
    change24h: data.change24h + (Math.random() - 0.5) * 0.5,
    volume24h: data.volume24h * (0.95 + Math.random() * 0.1),
    timestamp: Date.now(),
  }));
}
