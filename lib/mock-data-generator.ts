import { 
  MarketData, 
  CryptoData, 
  NewsArticle, 
  ConflictEvent, 
  MapOverlay,
  MacroIndicator,
  SectorData,
} from "./types";
import { 
  MARKET_SYMBOLS, 
  CRYPTO_SYMBOLS, 
  COMMODITIES, 
  SECTORS,
  SEVERITY_COLORS,
  REGIONS,
} from "./constants";

// Random number generator with seed for consistency
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getRandomInRange(min: number, max: number, seed?: number) {
  const random = seed !== undefined ? seededRandom(seed) : Math.random();
  return min + (max - min) * random;
}

// Market Data Generator
export function generateMarketData(): MarketData[] {
  const now = new Date();
  return MARKET_SYMBOLS.map((symbol, idx) => {
    const basePrice = 100 + idx * 50;
    const change = getRandomInRange(-5, 5, idx);
    const changePercent = (change / basePrice) * 100;

    return {
      symbol,
      open: basePrice + getRandomInRange(-2, 2, idx * 2),
      high: basePrice + getRandomInRange(0, 3, idx * 3),
      low: basePrice - getRandomInRange(0, 3, idx * 4),
      close: basePrice + change,
      volume: getRandomInRange(50000000, 200000000, idx * 5),
      change,
      changePercent,
      timestamp: now.toISOString(),
    };
  });
}

// Crypto Data Generator
export function generateCryptoData(): CryptoData[] {
  const now = new Date();
  const prices: Record<string, number> = {
    BTC: 42500,
    ETH: 2250,
    USDT: 1.0,
    USDC: 1.0,
    XRP: 2.1,
    SOL: 195,
  };

  return CRYPTO_SYMBOLS.map((symbol) => {
    const basePrice = prices[symbol] || 100;
    const change24h = getRandomInRange(-15, 15, symbol.charCodeAt(0));
    const changePercent = (change24h / basePrice) * 100;

    return {
      symbol,
      price: basePrice + change24h,
      marketCap: getRandomInRange(100000000000, 2000000000000, symbol.charCodeAt(0) * 2),
      volume24h: getRandomInRange(5000000000, 50000000000, symbol.charCodeAt(0) * 3),
      change24h,
      dominance: getRandomInRange(0.5, 50, symbol.charCodeAt(0) * 4),
      timestamp: now.toISOString(),
    };
  });
}

// Sector Performance Generator
export function generateSectorData(): SectorData[] {
  return SECTORS.map((sector, idx) => ({
    sector,
    performance: getRandomInRange(-5, 5, idx),
    dayHigh: 100 + getRandomInRange(1, 5, idx * 2),
    dayLow: 95 + getRandomInRange(-5, 1, idx * 3),
    marketCap: getRandomInRange(1000000000000, 5000000000000, idx * 4),
    volume: getRandomInRange(50000000000, 500000000000, idx * 5),
    topMovers: [
      {
        symbol: `${sector.split(" ")[0].substring(0, 3).toUpperCase()}1`,
        change: getRandomInRange(-10, 10, idx * 6),
      },
      {
        symbol: `${sector.split(" ")[0].substring(0, 3).toUpperCase()}2`,
        change: getRandomInRange(-10, 10, idx * 7),
      },
    ],
  }));
}

// News Generator
export function generateNews(count: number = 20): NewsArticle[] {
  const newsHeadlines = [
    "Global markets rally on inflation data",
    "Tech stocks surge amid AI breakthrough",
    "Central banks signal rate decision",
    "Supply chain disruption reported in Asia",
    "Energy prices spike on geopolitical tensions",
    "Crypto market sees massive liquidation",
    "Fed minutes reveal hawkish stance",
    "Manufacturing output contracts",
    "Oil prices hit new highs",
    "Trade tensions escalate between nations",
  ];

  const sources = ["Reuters", "Bloomberg", "BBC", "CNBC", "Financial Times", "WSJ"];
  const sentiments: ("positive" | "negative" | "neutral")[] = ["positive", "negative", "neutral"];
  const categories = ["markets", "geopolitics", "technology", "energy", "economics"];
  const regions = REGIONS;

  return Array.from({ length: count }, (_, i) => ({
    id: `news-${i}`,
    title: newsHeadlines[i % newsHeadlines.length],
    description: `Latest developments in ${categories[i % categories.length]} affecting global markets.`,
    source: sources[i % sources.length],
    sourceUrl: `https://example.com/article-${i}`,
    author: `Author ${i % 5}`,
    sentiment: sentiments[i % 3],
    sentimentScore: getRandomInRange(-1, 1, i),
    relevantAssets: [MARKET_SYMBOLS[i % MARKET_SYMBOLS.length], CRYPTO_SYMBOLS[i % CRYPTO_SYMBOLS.length]],
    region: regions[i % regions.length],
    category: [categories[i % categories.length]],
    publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
  }));
}

// Conflict Events Generator
export function generateConflictEvents(count: number = 15): ConflictEvent[] {
  const locations = [
    "Ukraine - Eastern Border",
    "South China Sea",
    "Middle East - Gaza Strip",
    "Taiwan Strait",
    "Kashmir Region",
    "Crimea Peninsula",
    "Syria - Northern Region",
    "Yemen - Houthi Territory",
    "Libya - Western Region",
    "Sudan - Darfur Region",
  ];

  const eventTypes = ["battle", "violence", "protest", "explosion", "airstrike"];
  const actors = [
    ["Military A", "Military B"],
    ["Rebel Group", "Government"],
    ["Civilians", "Security Forces"],
  ];

  return Array.from({ length: count }, (_, i) => {
    const location = locations[i % locations.length];
    const [lat, lng] = generateCoordinates();
    const severity = Math.ceil(getRandomInRange(1, 5, i));

    return {
      id: `conflict-${i}`,
      date: new Date(Date.now() - i * 86400000).toISOString(),
      location,
      latitude: lat,
      longitude: lng,
      country: getCountryFromLocation(location),
      eventType: eventTypes[i % eventTypes.length],
      deathCount: Math.floor(getRandomInRange(0, 500, i)),
      actors: actors[i % actors.length],
      description: `Event type: ${eventTypes[i % eventTypes.length]}`,
      severity,
    };
  });
}

// Map Overlays Generator
export function generateMapOverlays(): MapOverlay[] {
  const types: MapOverlay["type"][] = [
    "conflict",
    "intelligence",
    "infrastructure",
    "climate",
    "economic",
  ];
  const overlays: MapOverlay[] = [];

  types.forEach((type) => {
    for (let i = 0; i < 8; i++) {
      const [lat, lng] = generateCoordinates();
      const severity = Math.ceil(getRandomInRange(1, 5, i));
      const severityColor = SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS];

      overlays.push({
        id: `overlay-${type}-${i}`,
        type,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Event ${i + 1}`,
        latitude: lat,
        longitude: lng,
        severity,
        riskScore: getRandomInRange(20, 100, i),
        description: `Risk assessment for ${type} in this region`,
        color: severityColor,
      });
    }
  });

  return overlays;
}

// Macro Indicators Generator
export function generateMacroIndicators(): MacroIndicator[] {
  const indicators = [
    { key: "UNRATE", name: "Unemployment Rate", unit: "%", value: 3.8 },
    { key: "CPIAUCSL", name: "CPI", unit: "Index", value: 310.326 },
    { key: "PPIACO", name: "PPI", unit: "Index", value: 145.6 },
    { key: "M2SL", name: "M2 Money Supply", unit: "Billions", value: 20850 },
    { key: "FEDFUNDS", name: "Fed Funds Rate", unit: "%", value: 5.25 },
  ];

  return indicators.map((ind, i) => ({
    indicator: ind.key,
    country: "United States",
    value: ind.value + getRandomInRange(-2, 2, i),
    unit: ind.unit,
    period: "monthly",
    releaseDate: new Date(Date.now() - i * 2592000000).toISOString(),
    forecastValue: ind.value + getRandomInRange(-1, 1, i * 2),
    previousValue: ind.value - getRandomInRange(-0.5, 0.5, i * 3),
  }));
}

// Risk Assessment Generator
export function generateRiskAssessments(regions: string[] = REGIONS) {
  return regions.slice(0, 10).map((region, i) => ({
    id: `risk-${i}`,
    region,
    country: region === "Global" ? undefined : "Various",
    riskScore: getRandomInRange(20, 90, i),
    factors: {
      geopolitical: getRandomInRange(10, 90, i * 2),
      market: getRandomInRange(10, 90, i * 3),
      climate: getRandomInRange(10, 90, i * 4),
      cyber: getRandomInRange(10, 90, i * 5),
      infrastructure: getRandomInRange(10, 90, i * 6),
    },
    trend: ["increasing", "stable", "decreasing"][i % 3] as any,
    timestamp: new Date().toISOString(),
  }));
}

// Correlation Matrix Generator
export function generateCorrelationMatrix() {
  const assets = ["SPX", "GOLD", "BTC", "DXY"];
  const size = assets.length;
  const correlations: number[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 0)
  );

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (i === j) {
        correlations[i][j] = 1;
      } else if (i < j) {
        const value = getRandomInRange(-0.8, 0.8, i * size + j);
        correlations[i][j] = value;
        correlations[j][i] = value;
      }
    }
  }

  return { assets, correlations };
}

// Time Series Chart Data Generator
export function generateTimeSeriesData(
  symbol: string,
  periods: number = 100,
  startPrice: number = 100
) {
  const data = [];
  let price = startPrice;

  for (let i = periods - 1; i >= 0; i--) {
    const change = getRandomInRange(-2, 2, symbol.charCodeAt(0) + i);
    price = Math.max(price + change, 10);

    data.push({
      time: Math.floor(Date.now() / 1000) - i * 3600,
      open: price - 0.5,
      high: price + 1,
      low: price - 1.5,
      close: price,
      volume: Math.floor(getRandomInRange(1000000, 10000000, i)),
    });
  }

  return data;
}

// Helper Functions
function generateCoordinates(): [number, number] {
  const lat = getRandomInRange(-90, 90, Math.random() * 1000);
  const lng = getRandomInRange(-180, 180, Math.random() * 1000);
  return [lat, lng];
}

function getCountryFromLocation(location: string): string {
  const locationCountryMap: Record<string, string> = {
    "Ukraine": "Ukraine",
    "South China": "China",
    "Gaza Strip": "Palestine",
    "Taiwan": "Taiwan",
    "Kashmir": "India",
    "Crimea": "Russia",
    "Syria": "Syria",
    "Yemen": "Yemen",
    "Libya": "Libya",
    "Sudan": "Sudan",
  };

  for (const [key, country] of Object.entries(locationCountryMap)) {
    if (location.includes(key)) return country;
  }
  return "Unknown";
}

// Generate Heatmap Data for Sectors
export function generateSectorHeatmap() {
  const data = [];
  SECTORS.forEach((sector, i) => {
    COMMODITIES.forEach((commodity, j) => {
      data.push({
        x: sector,
        y: commodity,
        value: Math.floor(getRandomInRange(20, 100, i * 10 + j)),
        color: SEVERITY_COLORS[Math.ceil(getRandomInRange(1, 5, i + j)) as keyof typeof SEVERITY_COLORS],
      });
    });
  });
  return data;
}

// Generate GeoJSON for Map Layers
export function generateGeoJSONLayer(type: string, count: number = 50) {
  const features = [];

  for (let i = 0; i < count; i++) {
    const [lat, lng] = generateCoordinates();
    const severity = Math.ceil(getRandomInRange(1, 5, i));

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lng, lat],
      },
      properties: {
        id: `${type}-${i}`,
        title: `${type} ${i + 1}`,
        severity,
        riskScore: getRandomInRange(20, 100, i),
        color: SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS],
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

// Generate AI Mock Analyses
export function generateAIAnalysis(topic: string) {
  const templates = {
    market: {
      summary: "Market showing resilience with selective strength in technology and energy sectors.",
      strategicPosture: "Bullish on long-term fundamentals, cautious on near-term volatility",
      forwardProjection: "Expect consolidation around current levels with potential breakout to upside",
      volatilityEstimate: 18.5,
    },
    risk: {
      summary: "Overall risk environment elevated due to geopolitical tensions and inflation concerns.",
      strategicPosture: "Risk-off positioning recommended for conservative portfolios",
      forwardProjection: "Monitor central bank communications for policy shifts",
      volatilityEstimate: 22.3,
    },
    geopolitical: {
      summary: "Heightened tensions in key regions with economic implications for energy and trade.",
      strategicPosture: "Defensive positions in energy and logistics sectors advised",
      forwardProjection: "Escalation risk remains elevated; de-escalation could trigger rallies",
      volatilityEstimate: 25.8,
    },
  };

  const analysis = templates[topic as keyof typeof templates] || templates.market;

  return {
    ...analysis,
    riskScore: Math.floor(getRandomInRange(30, 85)),
    cascadingRisks: [
      "Supply chain disruption",
      "Currency volatility",
      "Demand destruction",
    ],
    confidence: getRandomInRange(0.65, 0.95),
    timestamp: new Date().toISOString(),
  };
}
