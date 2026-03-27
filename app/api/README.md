# Quantum Terminal API Routes

This directory contains all API endpoints for the Quantum Terminal application.

## Endpoints Structure

### Markets Data
- `GET /api/markets` - Global market data (SPX, NASDAQ, DXY, Gold, Oil, VIX)
- `GET /api/markets/sectors` - Sector performance data
- `GET /api/markets/watchlist` - User watchlist data

### Crypto Assets
- `GET /api/crypto` - Cryptocurrency market data
- `GET /api/crypto/liquidations` - Liquidation heatmap data
- `GET /api/crypto/whales` - Large transaction tracking
- `GET /api/crypto/orderflow` - Order flow and CVD data

### Economics & Macro
- `GET /api/macro` - Macro indicators (CPI, GDP, Unemployment)
- `GET /api/macro/fred/:series` - FRED data for specific series
- `GET /api/macro/yields` - US Treasury yield curve
- `GET /api/macro/centralbanks` - Central bank rates and policies

### Intelligence & News
- `GET /api/news` - News feed with sentiment analysis
- `GET /api/intelligence/conflicts` - UCDP conflict events
- `GET /api/intelligence/geopolitical` - Geopolitical alerts
- `GET /api/intelligence/displacement` - UNHCR displacement data

### AI Analysis
- `POST /api/ai/analyze` - Get AI analysis for market data
- `POST /api/ai/predict` - Get AI predictions for assets
- `GET /api/ai/insights` - Streaming AI insights

### WebSocket
- `WS /api/ws` - WebSocket connection for real-time updates

## Implementation Notes

### Authentication
All endpoints require authentication (to be implemented with NextAuth.js or Supabase Auth)

### Rate Limiting
- Public endpoints: 100 requests/min
- Authenticated endpoints: 1000 requests/min

### Caching Strategy
- Market data: 30 seconds
- Crypto data: 15 seconds
- Macro data: 5 minutes
- News: 1 minute

### External API Integration
The data provider supports integration with:
- **CoinGecko API** - Cryptocurrency prices
- **Alpha Vantage** - Stock market data
- **FRED API** - Economic data
- **NewsAPI** - News aggregation
- **OpenAI API** - AI analysis

## WebSocket Real-time Updates

```javascript
const ws = new WebSocket('wss://your-domain.com/api/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['markets', 'crypto', 'news']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time update:', data);
};
```

## Example Requests

### Get Market Data
```bash
curl http://localhost:3000/api/markets
```

### Get Crypto Data
```bash
curl http://localhost:3000/api/crypto
```

### Get AI Analysis
```bash
curl -X POST http://localhost:3000/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"asset": "BTC", "period": "24h"}'
```

## Database Schema

Key tables for API data:
- `market_prices` - Historical market data
- `crypto_prices` - Historical crypto prices
- `macro_indicators` - Economic indicators
- `news_items` - News articles with sentiment
- `alerts` - Risk alerts and notifications
- `user_dashboards` - Saved dashboard configurations
