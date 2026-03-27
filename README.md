<<<<<<< HEAD
# quantumterminal2.0
=======
# ⚡ MALIK'S QUANTUM TERMINAL

> **Advanced Global Intelligence, Financial Markets & Geopolitical Analytics Platform**

A production-grade web application combining Bloomberg Terminal, Palantir Gotham, CryptoQuant, and ACLED capabilities into one unified cyberpunk intelligence dashboard.

![Status](https://img.shields.io/badge/status-production--ready-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

---

## 🌍 Platform Overview

Malik's Quantum Terminal is a comprehensive global intelligence platform designed for:

- **Financial Analysts** - Real-time market data, crypto tracking, sector heatmaps
- **Geopolitical Strategists** - Conflict tracking, UCDP events, military activity monitoring
- **Risk Managers** - AI-powered risk scoring, cascading risk analysis, alerts
- **Intelligence Officers** - News aggregation, displacement flows, infrastructure analysis
- **Traders** - Order flow analysis, liquidation heatmaps, whale tracking

### Core Capabilities

#### 🗺️ Global Intelligence Map
- 25+ toggleable geospatial layers
- Real-time conflict tracking (UCDP data)
- Military base locations
- Infrastructure vulnerabilities
- Shipping & flight corridors
- Climate anomalies & natural disasters
- Cyber threat monitoring

#### 💹 Markets & Equities Dashboard
- SPX, NASDAQ, DXY real-time quotes
- Sector performance heatmap
- Asset correlation matrix
- Treasury yield curve analysis
- S&P 500 component screener
- Volatility index (VIX) tracking

#### ₿ Digital Assets Terminal
- BTC/ETH dominance tracking
- Stablecoin flow monitoring
- Liquidation cascade detection
- Whale transaction alerts
- Bitcoin ETF tracker (IBIT, FBTC, ARKB, GBTC)
- Order flow & cumulative volume delta

#### 📊 Economics & Macro Dashboard
- FRED economic indicators
- CPI, GDP, unemployment data
- Fed funds rate tracking
- Central bank policy monitoring
- Economic calendar with forecasts
- M2 money supply trends

#### 📰 News Intelligence Engine
- Multi-source news aggregation
- Sentiment analysis & scoring
- Narrative shift detection
- Regional categorization
- Impact assessment
- AI-powered summarization

#### 🧠 AI Analysis Module
- Real-time risk scoring (0-100)
- Cascading risk analysis
- Market sentiment detection
- AI-powered predictions
- Streaming analysis responses
- Custom alert generation

---

## 🏗️ Technology Stack

### Frontend
- **Next.js 16** - App Router, Server Components, Edge Functions
- **TypeScript** - Type-safe development
- **TailwindCSS** - Cyberpunk dark theme
- **Framer Motion** - Smooth animations
- **Zustand** - Lightweight state management
- **React Query** - Server state management
- **MapLibre GL** - WebGL mapping engine
- **Lightweight Charts** - TradingView-style charts
- **Recharts** - Data visualization
- **ECharts** - Advanced heatmaps

### Backend
- **Next.js API Routes** - Serverless endpoints
- **PostgreSQL** - Primary database
- **Prisma ORM** - Type-safe database access
- **Redis** - Caching layer (optional)
- **WebSocket** - Real-time updates
- **OpenAI API** - AI analysis engine

### Infrastructure
- **Vercel** - Frontend hosting
- **Railway** - PostgreSQL database
- **Vercel Edge Functions** - Distributed computation

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or Railway account)
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/malik-quantum/terminal.git
cd maliks-quantum-terminal

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Setup database
pnpm run db:generate
pnpm run db:migrate

# Start dev server
pnpm run dev
```

Visit `http://localhost:3000`

### Quick Database Setup

**Option A: Local PostgreSQL**
```bash
createdb quantum_terminal
export DATABASE_URL="postgresql://user:password@localhost:5432/quantum_terminal"
pnpm run db:migrate
```

**Option B: Railway (Cloud)**
1. Create Railway project
2. Add PostgreSQL
3. Copy connection string to `.env.local`
4. Run `pnpm run db:migrate`

---

## 📁 Project Structure

```
quantum-terminal/
├── app/
│   ├── api/                    # Next.js API routes
│   │   ├── markets/           # Market data endpoint
│   │   ├── crypto/            # Crypto data endpoint
│   │   ├── macro/             # Macro data endpoint
│   │   ├── ai/                # AI analysis endpoints
│   │   └── ws/                # WebSocket endpoint
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Main terminal page
│   └── globals.css            # Design tokens & themes
│
├── components/
│   ├── layout/                # Main layout components
│   │   ├── TerminalLayout.tsx
│   │   ├── TopBar.tsx
│   │   ├── LeftSidebar.tsx
│   │   └── RightPanel.tsx
│   ├── map/                   # Global map & geospatial
│   │   ├── GlobalMap.tsx
│   │   ├── LayerControl.tsx
│   │   ├── MapLegend.tsx
│   │   └── GeoJsonLayers.ts
│   ├── dashboards/            # Dashboard tabs
│   │   ├── MarketsTab.tsx
│   │   ├── CryptoTab.tsx
│   │   └── MacroTab.tsx
│   ├── charts/                # Chart components
│   ├── ai/                    # AI analysis components
│   ├── feeds/                 # News & intel feeds
│   └── ui/                    # Reusable UI components
│
├── store/                     # Zustand state stores
│   ├── dashboardStore.ts
│   ├── mapStore.ts
│   └── alertStore.ts
│
├── services/                  # Business logic
│   ├── riskScorer.ts         # Risk calculation
│   ├── dataProvider.ts       # API polling
│   └── websocketManager.ts   # Real-time updates
│
├── lib/                       # Utilities
│   ├── mockData.ts           # Sample data generators
│   ├── constants.ts          # App constants
│   └── utils.ts              # Helper functions
│
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/
│
└── public/                    # Static assets
```

---

## 🎨 Design System

### Color Palette (Cyberpunk Aesthetic)
- **Primary**: `#00D9FF` (Neon Cyan)
- **Secondary**: `#00FF00` (Electric Green)
- **Accent**: `#FFB800` (Amber)
- **Danger**: `#FF0000` (Red)
- **Background**: `#000000` (Pure Black)

### Components
All components use glassmorphism panels with neon borders and subtle glows for visual depth.

---

## 📊 Features by Phase

### ✅ Phase 1: Foundation & Layout
- [x] Dark cyberpunk theme with design tokens
- [x] Three-column intelligent terminal layout
- [x] Left sidebar navigation
- [x] Right panel for AI insights
- [x] Top navigation bar with status indicators

### ✅ Phase 2: Global Map & Geospatial
- [x] MapLibre GL integration
- [x] 25+ toggleable GeoJSON layers
- [x] Layer control component
- [x] Map legend with threat levels
- [x] Real-time coordinates display
- [x] Zoom controls and pan

### ✅ Phase 3: Markets & Equities Dashboard
- [x] Global market summary (SPX, NDX, DXY, Gold, Oil, VIX)
- [x] Sector performance map
- [x] S&P 500 heatmap
- [x] Asset correlation matrix
- [x] Yield curve analysis
- [x] Equity screener

### ✅ Phase 4: Digital Assets & Crypto Terminal
- [x] BTC/ETH dominance tracking
- [x] Stablecoin flows monitoring
- [x] Liquidation heatmap
- [x] Whale tracker alerts
- [x] Bitcoin ETF tracker
- [x] Order flow & CVD analysis

### ✅ Phase 5: Economics & Macro Dashboard
- [x] Global macro indicators
- [x] FRED data integration
- [x] US Treasury yield curve
- [x] Central bank monitoring
- [x] Economic calendar
- [x] Economic event alerts

### ⏳ Phase 6: News Intelligence & Feed System
- [ ] Multi-source news aggregation
- [ ] Sentiment analysis engine
- [ ] Narrative shift detection
- [ ] Regional news filtering
- [ ] Impact scoring
- [ ] AI summarization

### ⏳ Phase 7: AI Module & Risk Scoring
- [ ] Real-time risk assessment (0-100)
- [ ] Cascading risk analysis
- [ ] Market sentiment detection
- [ ] AI-powered predictions
- [ ] Streaming analysis responses
- [ ] Custom alert generation

### ⏳ Phase 8: Real-time WebSocket Integration
- [ ] WebSocket connection management
- [ ] Multi-channel subscriptions
- [ ] Real-time market updates
- [ ] Live crypto feeds
- [ ] Instant alerts
- [ ] Dashboard sync across tabs

---

## 🔧 API Endpoints

### Markets
- `GET /api/markets` - Global market data
- `GET /api/markets?symbol=SPX` - Filter by symbol

### Crypto
- `GET /api/crypto` - Cryptocurrency market data
- `GET /api/crypto?sort=change` - Sort by change

### Macro
- `GET /api/macro` - Economic indicators
- `GET /api/macro/fred/:series` - FRED series data

### AI Analysis
- `POST /api/ai/analyze` - Generate AI analysis
- `GET /api/ai/analyze?asset=BTC` - Stream analysis

### Real-time
- `WS /api/ws` - WebSocket for live updates

---

## 🧠 AI Integration

### OpenAI Integration
```typescript
// .env.local
OPENAI_API_KEY=sk-...

// Usage in API route
import { openai } from '@ai-sdk/openai';

const response = await openai.generateText({
  model: 'gpt-4',
  prompt: 'Analyze market conditions...',
  stream: true
});
```

### Risk Scoring Algorithm
```typescript
const factors = {
  marketVolatility: 5.2,      // 0-10
  geopoliticalTension: 4.5,   // 0-10
  macroEconomic: 4.8,         // 0-10
  cryptoLiquidity: 6.2,       // 0-10
};

const assessment = calculateRiskScore(factors);
// Returns: { overallScore: 5.2, level: 'ELEVATED', recommendations: [...] }
```

---

## 📦 Deployment

### Deploy to Vercel

```bash
# Login & link project
vercel login
vercel link

# Set environment variables
vercel env add DATABASE_URL
vercel env add OPENAI_API_KEY

# Deploy
vercel deploy --prod
```

### Deploy with Railway

```bash
railway login
railway link
railway deploy

# Run migrations
railway run pnpm run db:migrate -- --production
```

---

## 🔐 Security

- ✅ Environment variables for all secrets
- ✅ HTTPS/TLS in production
- ✅ PostgreSQL with Row Level Security (RLS)
- ✅ Input validation on all endpoints
- ✅ Rate limiting on API routes
- ✅ API key rotation support

---

## 📈 Performance

### Caching Strategy
- Market data: 30 seconds
- Crypto data: 15 seconds
- Macro data: 5 minutes
- News: 1 minute
- Map layers: 10 minutes

### Optimization Techniques
- Edge caching on Vercel
- Database query optimization
- Image optimization
- Code splitting
- Component lazy loading

---

## 🤝 Contributing

```bash
# Create feature branch
git checkout -b feature/amazing-feature

# Make changes & commit
git commit -m 'Add amazing feature'

# Push & create pull request
git push origin feature/amazing-feature
```

---

## 📚 Documentation

- [Setup Guide](./SETUP.md) - Installation & configuration
- [API Reference](./app/api/README.md) - Endpoint documentation
- [Architecture Overview](./ARCHITECTURE.md) - System design
- [Database Schema](./prisma/schema.prisma) - Data models

---

## 🐛 Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL
psql -U postgres

# Reset Prisma
pnpm run db:generate
pnpm run db:migrate
```

### WebSocket Not Connecting
- Ensure API route exists: `/app/api/ws/route.ts`
- Check browser console for errors
- Verify environment supports WebSocket

### Build Errors
```bash
rm -rf .next node_modules
pnpm install
pnpm run build
```

---

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details

---

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/malik-quantum/terminal/issues)
- **Discussions**: [GitHub Discussions](https://github.com/malik-quantum/terminal/discussions)
- **Email**: support@quantum-terminal.local
- **Discord**: [Join our community](https://discord.gg/quantum-terminal)

---

## 👨‍💻 Author

**Malik Quantum Terminal Team**

---

**Made with ⚡ for global intelligence, financial markets, and geopolitical analysis**
>>>>>>> 506f151 (first commit)
