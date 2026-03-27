// Theme Colors - Cyberpunk Quantum Terminal Aesthetic
export const COLORS = {
  // Primary Brand Colors
  primary: "#00D9FF", // Neon Cyan
  secondary: "#0FFF50", // Electric Green
  accent: "#FFD700", // Amber/Gold
  danger: "#FF1744", // Neon Red
  
  // Background
  background: "#0A0E27", // Deep Space Black
  surface: "#0F1432", // Slightly lighter black
  surfaceLight: "#1A1F3A", // Even lighter
  
  // Text
  textPrimary: "#FFFFFF",
  textSecondary: "#B0B9C1",
  textTertiary: "#7A8391",
  
  // Status
  success: "#00D9FF",
  warning: "#FFD700",
  error: "#FF1744",
  info: "#0FFF50",
};

// Map Layer Configurations
export const MAP_LAYERS = [
  { id: "intel-hotspots", name: "Intel Hotspots", displayName: "🎯 Hotspots", color: COLORS.primary },
  { id: "conflict-zones", name: "Conflict Zones", displayName: "⚔ Conflicts", color: COLORS.danger },
  { id: "military-bases", name: "Military Bases", displayName: "🏛 Bases", color: COLORS.danger },
  { id: "nuclear-sites", name: "Nuclear Sites", displayName: "☢ Nuclear", color: "#FF6600" },
  { id: "spaceports", name: "Spaceports", displayName: "🚀 Spaceports", color: COLORS.primary },
  { id: "undersea-cables", name: "Undersea Cables", displayName: "🔌 Cables", color: "#00FFFF" },
  { id: "pipelines", name: "Pipelines", displayName: "🛢 Pipelines", color: "#FFA500" },
  { id: "data-centers", name: "AI Data Centers", displayName: "🖥 Data Centers", color: COLORS.secondary },
  { id: "military-activity", name: "Military Activity", displayName: "✈ Military", color: COLORS.danger },
  { id: "ship-traffic", name: "Ship Traffic", displayName: "🚢 Ships", color: COLORS.primary },
  { id: "flight-delays", name: "Flight Delays", displayName: "✈ Flights", color: COLORS.warning },
  { id: "protests", name: "Protests", displayName: "📢 Protests", color: COLORS.danger },
  { id: "displacement", name: "Displacement Flows", displayName: "👥 Displacement", color: COLORS.accent },
  { id: "climate-anomalies", name: "Climate Anomalies", displayName: "🌫 Climate", color: "#FF00FF" },
  { id: "weather-alerts", name: "Weather Alerts", displayName: "⛈ Weather", color: COLORS.warning },
  { id: "internet-outages", name: "Internet Outages", displayName: "📡 Outages", color: COLORS.error },
  { id: "cyber-threats", name: "Cyber Threats", displayName: "🛡 Cyber", color: COLORS.danger },
  { id: "natural-events", name: "Natural Events", displayName: "🌋 Events", color: COLORS.warning },
  { id: "fires", name: "Fires", displayName: "🔥 Fires", color: COLORS.danger },
  { id: "strategic-waterways", name: "Strategic Waterways", displayName: "⚓ Waterways", color: COLORS.primary },
  { id: "economic-centers", name: "Economic Centers", displayName: "💰 Economy", color: COLORS.secondary },
  { id: "critical-minerals", name: "Critical Minerals", displayName: "💎 Minerals", color: COLORS.accent },
];

// Market Symbols to Monitor
export const MARKET_SYMBOLS = ["SPX", "NASDAQ", "DXY", "GOLD", "CRB", "VIX"];
export const CRYPTO_SYMBOLS = ["BTC", "ETH", "USDT", "USDC", "XRP", "SOL"];
export const COMMODITIES = ["GOLD", "OIL", "COPPER", "NATURAL_GAS", "WHEAT"];

// Sectors
export const SECTORS = [
  "Technology",
  "Healthcare",
  "Financials",
  "Energy",
  "Industrials",
  "Consumer Discretionary",
  "Materials",
  "Real Estate",
  "Utilities",
  "Communication Services",
];

// Economic Indicators (FRED)
export const MACRO_INDICATORS = [
  { key: "UNRATE", name: "Unemployment Rate" },
  { key: "CPIAUCSL", name: "CPI" },
  { key: "CPILFESL", name: "CPI (Core)" },
  { key: "PPIACO", name: "PPI" },
  { key: "DEXUSEU", name: "USD/EUR Exchange Rate" },
  { key: "M2SL", name: "M2 Money Supply" },
  { key: "FEDFUNDS", name: "Fed Funds Rate" },
  { key: "T10Y2Y", name: "10Y-2Y Yield Curve" },
  { key: "INDPRO", name: "Industrial Production" },
  { key: "UMCSENT", name: "Consumer Sentiment" },
];

// Risk Score Weights
export const RISK_WEIGHTS = {
  geopolitical: 0.3,
  market: 0.25,
  climate: 0.2,
  cyber: 0.15,
  infrastructure: 0.1,
};

// Severity Colors (HSL-based for gradients)
export const SEVERITY_COLORS = {
  1: "#00D9FF", // Cyan - Low
  2: "#0FFF50", // Green - Low-Medium
  3: "#FFD700", // Amber - Medium
  4: "#FF8C00", // Orange - High
  5: "#FF1744", // Red - Critical
};

// Time Ranges
export const TIME_RANGES = [
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "1Y", value: "1y" },
  { label: "ALL", value: "all" },
];

// API Endpoints
export const API_ENDPOINTS = {
  MARKETS: "/api/data/markets",
  CRYPTO: "/api/data/crypto",
  MACRO: "/api/data/macro",
  NEWS: "/api/data/news",
  MAP_LAYERS: "/api/data/layers",
  AI_ANALYZE: "/api/ai/analyze",
  AI_STREAM: "/api/ai/stream",
  DASHBOARDS: "/api/dashboards",
  WATCHLISTS: "/api/watchlists",
  ALERTS: "/api/alerts",
};

// News Categories
export const NEWS_CATEGORIES = [
  "markets",
  "geopolitics",
  "technology",
  "energy",
  "infrastructure",
  "climate",
  "conflict",
  "economics",
  "cyber",
];

// Regions for Filtering
export const REGIONS = [
  "Global",
  "North America",
  "Europe",
  "Asia-Pacific",
  "Middle East & Africa",
  "Americas",
  "Sub-Saharan Africa",
  "Central Asia",
  "Eastern Europe",
];

// Countries (Selection)
export const COUNTRIES = [
  "United States",
  "China",
  "Russia",
  "India",
  "Germany",
  "Japan",
  "United Kingdom",
  "France",
  "Brazil",
  "Israel",
  "Ukraine",
  "Taiwan",
  "South Korea",
  "Iran",
  "Saudi Arabia",
];

// Dashboard Tab Names
export const DASHBOARD_TABS = [
  { id: "overview", label: "Overview", icon: "Gauge" },
  { id: "markets", label: "Markets", icon: "TrendingUp" },
  { id: "crypto", label: "Crypto", icon: "Zap" },
  { id: "macro", label: "Macro", icon: "BarChart3" },
  { id: "intelligence", label: "Intelligence", icon: "AlertCircle" },
  { id: "transport", label: "Transport", icon: "Navigation" },
  { id: "modules", label: "Modules", icon: "Layers" },
];

// Sentiment Color Mapping
export const SENTIMENT_COLORS = {
  positive: "#0FFF50", // Green
  neutral: "#B0B9C1", // Gray
  negative: "#FF1744", // Red
};

// Default Dashboard Configuration
export const DEFAULT_DASHBOARD_CONFIG = {
  layout: "3-column",
  leftSidebarWidth: 280,
  centerWidth: "auto",
  rightPanelWidth: 350,
  visibleLayers: ["intel-hotspots", "conflict-zones", "military-activity"],
  activeTab: "overview",
  refreshInterval: 5000, // 5 seconds
};

// WebSocket Events
export const WS_EVENTS = {
  MARKET_UPDATE: "market:update",
  CRYPTO_UPDATE: "crypto:update",
  NEWS_ALERT: "news:alert",
  RISK_UPDATE: "risk:update",
  ALERT_TRIGGERED: "alert:triggered",
  MAP_OVERLAY_UPDATE: "map:overlay-update",
};

// Debounce/Throttle Times (ms)
export const DEBOUNCE_TIMES = {
  MAP_INTERACTION: 300,
  FILTER_CHANGE: 500,
  SEARCH: 300,
  RESIZE: 250,
};

// Cache TTLs (seconds)
export const CACHE_TTLS = {
  MARKET_DATA: 60, // 1 minute
  CRYPTO_DATA: 30, // 30 seconds
  MACRO_DATA: 3600, // 1 hour
  NEWS: 300, // 5 minutes
  MAP_LAYERS: 600, // 10 minutes
  AI_ANALYSIS: 1800, // 30 minutes
};

// Pagination
export const PAGE_SIZE = 50;
export const INITIAL_LOAD_SIZE = 20;
