# Advanced Trading Charts & Panels Documentation

This document describes the six new advanced trading chart types added to QuantumTerminal, providing professional-grade market microstructure and technical analysis tools.

## Overview

The following chart/panel types have been implemented with multi-exchange support (Binance, Bybit, Hyperliquid, OKX):

1. **Heatmap (Historical DOM)** - Time-series volume profile visualization
2. **Candlestick** - Traditional OHLC charting with moving averages
3. **Footprint** - Order flow analysis with imbalance studies
4. **Time & Sales** - Live trades scrollable list
5. **DOM (Depth of Market) / Ladder** - Real-time order book visualization
6. **Comparison** - Multi-asset normalized comparison chart

---

## 1. Heatmap (Historical DOM)

### Purpose
Visualizes the distribution of trading activity across price levels over time using a heat map.

### Features
- **Price Grouping**: Customize price aggregation intervals ($1, $5, $10, $20, etc.)
- **Time Aggregation**: Available intervals: 1m, 5m, 15m, 1h
- **Volume Profiles**: Shows buy/sell volume separation
- **Imbalance Overlay**: Optional buy/sell pressure indicator
- **Profile Types**: Fixed-range or visible-range volume profiles

### Data Source
- Live trades fetched from exchange WebSocket
- Aggregated into price×time grid cells
- Buy/sell volume tracked separately
- Point of Control (POC) calculated per cell

### Settings
```typescript
interface HeatmapSettings {
  exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx';
  symbol: string;
  priceGrouping: number;          // e.g., 10 for $10 ranges
  timeAggregation: '1m' | '5m' | '15m' | '1h';
  profileType: 'fixed-range' | 'visible-range';
  showBuySell: boolean;
  showImbalance: boolean;
}
```

### Example Usage
```
Exchange: Binance
Symbol: BTCUSDT
Price Grouping: $10
Time Aggregation: 5m
Profile Type: Visible Range
Show Buy/Sell: ✓
Show Imbalance: ✓
```

---

## 2. Candlestick Chart

### Purpose
Traditional OHLC candlestick chart with optional technical indicators.

### Features
- **Interval Support**: 1m, 5m, 15m, 1h, 4h, 1d
- **Configurable Candles**: Up to 1000 historical candles
- **Moving Averages**: Dual MA support (e.g., 7 and 25 period)
- **Volume Bars**: Optional volume histogram
- **Price Statistics**: High, low, change, % change tracking

### Data Source
- Kline (candlestick) data from exchange REST API
- Volume normalized to 100% for visualization
- Moving averages calculated client-side

### Settings
```typescript
interface CandlestickSettings {
  exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx';
  symbol: string;
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  limit: number;                  // 1-1000 candles
  showVolume: boolean;
  showMA: boolean;
  ma1?: number;                   // First MA period
  ma2?: number;                   // Second MA period
}
```

### Example Usage
```
Exchange: Binance
Symbol: BTCUSDT
Interval: 1h
Limit: 100 candles
Show Volume: ✓
Show Moving Averages: ✓
MA1 Period: 7
MA2 Period: 25
```

---

## 3. Footprint Chart

### Purpose
Advanced order flow analysis showing trades aggregated on candlestick bars with volume profiles and imbalance metrics.

### Features
- **Price-grouped Trades**: Trades aggregated by price level per candle
- **Buy/Sell Separation**: Visual distinction of buying vs selling pressure
- **Imbalance Studies**: Measures buy/sell volume ratio
- **Point of Control (POC)**: Identifies price level with highest activity
- **Clustering Methods**: Order-book, delta, or imbalance-based
- **Naked POC**: Highlights untested Price of Control levels

### Data Source
- Live trades from WebSocket aggregated into candlestick bars
- Trades grouped by configurable price intervals
- Imbalance = Buy Volume / (Buy Volume + Sell Volume)

### Settings
```typescript
interface FootprintSettings {
  exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx';
  symbol: string;
  interval: '1m' | '5m' | '15m' | '1h';
  priceGrouping: number;
  clusteringMethod: 'order-book' | 'delta' | 'imbalance';
  showNakedPOC: boolean;
  showImbalance: boolean;
}
```

### Example Usage
```
Exchange: Binance
Symbol: BTCUSDT
Interval: 5m
Price Grouping: $10
Clustering Method: Delta
Show Naked POC: ✓
Show Imbalance: ✓
```

---

## 4. Time & Sales

### Purpose
Scrollable list of recent trades with real-time updates and volume highlighting.

### Features
- **Live Trade Stream**: Updates in real-time (5s refresh default)
- **Large Volume Highlighting**: Automatic highlighting of outsized trades
- **Buy/Sell Filtering**: Color-coded buy (green) and sell (red) orders
- **Configurable Threshold**: Set volume threshold % for highlighting
- **Auto-Refresh**: Toggle for continuous updating
- **Statistics**: Buy count, sell count, total volume, average price

### Data Source
- Recent trades (limit: 10-1000) from exchange REST API
- Sorted by timestamp (newest first)
- Optional auto-refresh every 5 seconds

### Settings
```typescript
interface TimeSalesSettings {
  exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx';
  symbol: string;
  limit: number;                  // 10-1000 trades
  highlightLargeVolume: boolean;
  largeVolumeThreshold: number;   // Percentage
  autoRefresh: boolean;
}
```

### Example Usage
```
Exchange: Binance
Symbol: BTCUSDT
Limit: 100 trades
Highlight Large Volume: ✓
Large Volume Threshold: 10%
Auto Refresh: ✓ (5s interval)
```

---

## 5. DOM / Ladder

### Purpose
Depth of Market visualization showing bid/ask ladders with order book imbalance.

### Features
- **Real-time Order Book**: L2 snapshot updated every 2 seconds
- **Bid/Ask Visualization**: Stacked bar chart of order book levels
- **Price Grouping**: Customize aggregation for cleaner visualization
- **Spread Metrics**: Bid-ask spread in absolute and percentage terms
- **Mid Price**: Calculated from best bid/ask
- **Volume Imbalance**: Bid vs ask volume comparison

### Data Source
- Level 2 orderbook from exchange REST API
- Configurable depth: typically 5, 10, 20, 50, 100 levels
- Grouped by price interval to reduce noise

### Settings
```typescript
interface DOMSettings {
  exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx';
  symbol: string;
  depth: number;                  // e.g., 20 levels
  grouping: number;               // e.g., $1 grouping
  showSpread: boolean;
  autoRefresh: boolean;           // 2s refresh
}
```

### Example Usage
```
Exchange: Binance
Symbol: BTCUSDT
Depth: 20 levels
Price Grouping: $1
Show Spread: ✓
Auto Refresh: ✓ (2s interval)
```

---

## 6. Comparison Chart

### Purpose
Compare multiple assets on a normalized percentage or absolute price scale.

### Features
- **Multi-Asset Support**: Up to 4 assets simultaneously
- **Normalization Options**: Percentage change (%) or absolute price
- **Custom Colors**: Assign distinct colors to each asset
- **Add/Remove Assets**: Dynamic addition up to 4 symbols
- **Synchronized Timeline**: All assets share same time axis
- **Real-time Updates**: Refreshes every minute

### Data Source
- Kline (candlestick) data for each symbol
- Base price taken from first candle
- Percentage change = (Close - BasePrice) / BasePrice × 100

### Settings
```typescript
interface ComparisonSettings {
  exchanges: Array<{
    exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx';
    symbol: string;
    color: string;
    label: string;
  }>;
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  limit: number;
  normalizePercent: boolean;
}
```

### Example Usage
```
Assets:
  BTC (Binance) - Blue   - 100% baseline
  ETH (Binance) - Green  - 0% if at base price
  SOL (Binance) - Orange - +50% if up 50%

Interval: 1h
Limit: 100 candles
Normalize: % (percentage change)
```

---

## API Endpoints

### GET /api/trades
Fetch recent or historical trades.

**Query Parameters:**
```
exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx'
symbol: string (e.g., 'BTCUSDT')
limit: number (default: 500)
startTime?: number (ms timestamp for historical)
endTime?: number (ms timestamp for historical)
method?: 'binance-vision' | 'rest-api' (Binance only)
testnet?: boolean
```

**Example:**
```
GET /api/trades?exchange=binance&symbol=BTCUSDT&limit=1000

GET /api/trades?exchange=binance&symbol=BTCUSDT&startTime=1700000000000&endTime=1700086400000&method=rest-api
```

### GET /api/klines
Fetch candlestick (kline) data.

**Query Parameters:**
```
exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx'
symbol: string
interval: string (e.g., '1h', '5m', '1d')
limit: number (default: 500)
testnet?: boolean
```

**Example:**
```
GET /api/klines?exchange=binance&symbol=BTCUSDT&interval=1h&limit=100
```

### GET /api/orderbook
Fetch current depth of market (order book snapshot).

**Query Parameters:**
```
exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx'
symbol: string
depth: number (typical: 5, 10, 20, 50, 100)
testnet?: boolean
```

**Example:**
```
GET /api/orderbook?exchange=binance&symbol=BTCUSDT&depth=20
```

### POST /api/audio
Trigger audio notifications for trading events.

**Request Body:**
```json
{
  "eventType": "largeVolume" | "priceBreakout" | "orderImbalance" | "liquidation" | "ponr",
  "volume"?: number,
  "price"?: number,
  "imbalance"?: number
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "eventType": "largeVolume",
    "audioUrl": "/sounds/volume-spike-3.mp3",
    "description": "Large volume detected: 500 BTC",
    "volume": 0.5
  }
}
```

---

## Exchange Support Matrix

| Feature | Binance | Bybit | Hyperliquid | OKX |
|---------|---------|-------|-------------|-----|
| Trades (Live) | ✓ | ✓ | ✓ | ✓ |
| Trades (Historical - REST) | ✓ | ✗ | ✗ | (WIP) |
| Trades (Historical - Vision) | ✓ | ✗ | ✗ | ✗ |
| Klines | ✓ | ✓ | ✓ | ✓ |
| Order Book | ✓ | ✓ | ✓ | ✓ |
| WebSocket Support | ✓ | (Planned) | (Planned) | (Planned) |

**Notes:**
- **Binance**: Full support including Binance Vision for fast daily bulk downloads
- **Bybit**: REST API only, no historical intraday trade fetching
- **Hyperliquid**: REST API only, no historical intraday trade fetching
- **OKX**: Basic support, historical trade fetching is WIP

---

## Real-Time Audio Notifications

The audio system provides contextual sound effects for trading events.

### Available Events

**largeVolume**
- Triggered when volume exceeds threshold
- Frequency scales with volume intensity
- Default threshold: 500 BTC

**priceBreakout**
- Triggered on price level breakout
- Higher pitch for upside, lower for downside

**orderImbalance**
- Triggered on buy/sell pressure extremes
- Threshold: >60% imbalance

**liquidation**
- Triggered on detected liquidations
- Double-tone alert pattern

**ponr** (Point of No Return)
- Triggered on Point of Control shift

### Configuration

```typescript
interface AudioConfig {
  enabled: boolean;
  volumePercentage: number;      // 0-100
  triggers: {
    largeVolume?: { threshold: number; };
    priceBreakout?: { threshold: number; };
    orderImbalance?: { threshold: number; };
    liquidation?: { };
  };
}
```

### Usage Example
```typescript
import { getAudioManager } from '@/services/audioManager';

const audioManager = getAudioManager();
audioManager.setEnabled(true);
audioManager.setVolume(75);

// Play tone on large volume
audioManager.handleLargeVolume(1000);

// Play tone on breakout
audioManager.handlePriceBreakout('up');
```

---

## Multi-Window & Pane Linking

While not yet fully implemented, the architecture supports:

- **Multi-window Support**: Each chart can be in separate window/tab
- **Pane Linking**: Quickly switch tickers across linked panes
- **Persistent Layouts**: Save and restore custom arrangements
- **Custom Themes**: Editable color palettes per theme

### Planned Architecture
```typescript
interface TradingLayout {
  id: string;
  name: string;
  panes: Array<{
    id: string;
    type: "heatmap" | "candlestick" | "footprint" | "timesales" | "dom" | "comparison";
    symbol: string;
    config: Record<string, any>;
  }>;
  linkedPanes?: string[];
  theme?: string;
}
```

---

## Performance Considerations

- **Heatmap**: Aggregates 1000 trades, rendered every 30s
- **Candlestick**: 100-1000 candles, responsive
- **Footprint**: 50 bars max, ~1000 trades per bar
- **Time & Sales**: 100-1000 trades, scrollable with virtualization
- **DOM**: 20-100 price levels, updates every 2s
- **Comparison**: 4 assets max, synced at 1m intervals

---

## Troubleshooting

### No data displayed
- Check exchange connectivity: `GET /api/trades?exchange=binance&symbol=BTCUSDT`
- Verify symbol is correct (e.g., BTCUSDT not BTC/USD)
- Check rate limits not exceeded

### Audio not playing
- Browser may require user interaction to enable audio
- Call `audioManager.resumeAudioContext()` after user interaction
- Check browser console for AudioContext errors

### High latency
- Reduce limit/depth parameters
- Increase refresh intervals
- Check network connectivity

---

## Future Enhancements

1. **WebSocket Streaming**: Real-time updates for all exchanges
2. **Advanced Clustering**: K-means clustering for footprint analysis
3. **Naked POC Detection**: Algorithmic detection of untested levels
4. **Market Profile**: Horizontal volume analysis
5. **Spread Analytics**: Spread behavior over time
6. **Order Imbalance Alerts**: Configurable thresholds with alerts
7. **Multi-Timeframe Analysis**: Nested charts by timeframe
8. **Custom Indicators**: User-defined technical indicators

---

## References

- [Binance API Docs](https://binance-docs.github.io/apidocs/)
- [Bybit API Docs](https://bybit-exchange.github.io/docs/)
- [Hyperliquid API Docs](https://hyperliquid.gitbook.io/)
- [OKX API Docs](https://www.okx.com/docs-v5/en/)
- [OHLC Format](https://en.wikipedia.org/wiki/Open-high-low-close_chart)
- [Order Book Depth](https://en.wikipedia.org/wiki/Limit_order_book)
- [Volume Profile Trading](https://www.investopedia.com/terms/v/volume-profile.asp)
