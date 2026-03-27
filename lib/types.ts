// Market Data Types
export interface MarketData {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface CryptoData {
  symbol: string;
  price: number;
  marketCap?: number;
  volume24h?: number;
  change24h?: number;
  dominance?: number;
  timestamp: string;
}

export interface MacroIndicator {
  indicator: string;
  country: string;
  value: number;
  unit: string;
  period: string;
  releaseDate: string;
  forecastValue?: number;
  previousValue?: number;
}

// News Types
export interface NewsArticle {
  id: string;
  title: string;
  description?: string;
  source: string;
  sourceUrl: string;
  author?: string;
  imageUrl?: string;
  sentiment: "positive" | "negative" | "neutral";
  sentimentScore: number;
  relevantAssets?: string[];
  region?: string;
  category: string[];
  publishedAt: string;
}

// Map Types
export interface MapLayer {
  id: string;
  name: string;
  displayName: string;
  layerType: "geojson" | "raster" | "heatmap";
  isVisible: boolean;
  color: string;
  opacity: number;
  intensity: number;
  data?: GeoJSONData;
}

export interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: "Point" | "LineString" | "Polygon";
    coordinates: number[] | number[][] | number[][][];
  };
  properties: Record<string, any>;
}

export interface GeoJSONData {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

export interface MapOverlay {
  id: string;
  type: "conflict" | "intelligence" | "infrastructure" | "climate" | "economic";
  title: string;
  latitude: number;
  longitude: number;
  severity: number; // 1-5
  riskScore: number; // 0-100
  description?: string;
  color: string;
}

// Risk Assessment
export interface RiskAssessment {
  id: string;
  region: string;
  country?: string;
  riskType: "geopolitical" | "market" | "climate" | "cyber" | "infrastructure";
  riskScore: number; // 0-100
  factors: Record<string, number>;
  trend: "increasing" | "stable" | "decreasing";
  timestamp: string;
}

// AI Analysis
export interface AIAnalysis {
  id: string;
  type: "market" | "risk" | "geopolitical" | "macro" | "sector";
  summary: string;
  riskScore: number;
  strategicPosture: string;
  forwardProjection: string;
  volatilityEstimate: number;
  cascadingRisks: string[];
  confidence: number;
  timestamp: string;
}

// Dashboard Types
export interface DashboardLayout {
  id: string;
  name: string;
  leftSidebarWidth: number;
  rightPanelWidth: number;
  visibleLayers: string[];
  activeTab: string;
  filters: DashboardFilters;
  customGridLayout?: Record<string, any>;
}

export interface DashboardFilters {
  region?: string;
  country?: string;
  sector?: string;
  assetClass?: string;
  timeRange?: "1h" | "4h" | "1d" | "1w" | "1m" | "3m" | "1y";
  severity?: "low" | "medium" | "high" | "critical";
}

// Chart Data
export interface ChartPoint {
  time: number | string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  value?: number;
}

export interface CorrelationMatrix {
  assets: string[];
  correlations: number[][];
}

export interface HeatmapData {
  x: string;
  y: string;
  value: number;
  color?: string;
}

// Conflict Event
export interface ConflictEvent {
  id: string;
  date: string;
  location: string;
  latitude: number;
  longitude: number;
  country: string;
  eventType: string;
  deathCount: number;
  actors: string[];
  description?: string;
  severity: number; // 1-5
}

// Geopolitical Event
export interface GeopoliticalEvent {
  id: string;
  title: string;
  description: string;
  country: string;
  region: string;
  latitude: number;
  longitude: number;
  eventType: "military" | "diplomatic" | "protest" | "disaster";
  severity: number; // 1-5
  impact: "low" | "medium" | "high" | "critical";
  sources: string[];
  timestamp: string;
}

// API Response Types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface StreamMessage {
  type: "start" | "chunk" | "end" | "error";
  content?: string;
  error?: string;
}

// User Types
export interface UserPreferences {
  theme: "dark" | "light";
  defaultDashboard: string;
  notificationsEnabled: boolean;
  emailDigest: boolean;
}

// Watchlist Types
export interface Watchlist {
  id: string;
  name: string;
  assets: string[];
  assetType: "crypto" | "equity" | "commodity";
  createdAt: string;
}

// Alert Types
export interface UserAlert {
  id: string;
  assetSymbol: string;
  condition: string;
  threshold: number;
  isActive: boolean;
  lastTriggered?: string;
}

// Sector Performance
export interface SectorData {
  sector: string;
  performance: number;
  dayHigh: number;
  dayLow: number;
  marketCap?: number;
  volume?: number;
  topMovers: Array<{
    symbol: string;
    change: number;
  }>;
}

// Transport Data
export interface FlightData {
  id: string;
  departure: string;
  arrival: string;
  altitude: number;
  speed: number;
  heading: number;
  aircraft: string;
  airline: string;
  status: string;
}

export interface ShipData {
  id: string;
  mmsi: number;
  name: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  destination?: string;
  vesselType: string;
  status: string;
}

// Climate & Environment
export interface ClimateAnomaly {
  id: string;
  type: "temperature" | "precipitation" | "wildfire" | "hurricane";
  location: string;
  latitude: number;
  longitude: number;
  severity: number; // 1-5
  description: string;
  timestamp: string;
}
