# Getting Started with Malik's Quantum Terminal

Welcome to the production-ready intelligence platform! This guide will get you up and running in 10 minutes.

---

## ⚡ Quick Start (5 minutes)

### 1. Install & Setup

```bash
# Clone (or extract from archive)
git clone https://github.com/malik-quantum/terminal.git
cd maliks-quantum-terminal

# Install dependencies
pnpm install

# Create environment file
cp .env.example .env.local

# Generate Prisma client
pnpm run db:generate

# Start development server
pnpm run dev
```

Visit `http://localhost:3000` - You'll see the full terminal loaded with mock data!

### 2. Stop Here or Continue?

- **Just demoing?** → Stop! The terminal works with mock data out of the box
- **Want real data?** → Continue to "Add Real Data" section
- **Deploy now?** → Skip to "Deployment" section

---

## 📊 Understanding the Interface

### Main Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│  ⚡ MALIK'S QUANTUM TERMINAL | Status: OPERATIONAL  │ ← Top Bar
├──────────┬────────────────────────────┬──────────────┤
│          │                            │              │
│  GLOBAL  │     MAIN CONTENT AREA      │  AI INSIGHTS │
│  STATUS  │                            │              │
│          │   Shows active dashboard   │  Risk Score  │
│  Markets │   (Map by default)         │  Sentiment   │
│  Feeds   │                            │  Alerts      │
│  AI      │   Use left sidebar to      │              │
│  Etc     │   navigate between tabs    │  Latest Intel│
│          │                            │              │
└──────────┴────────────────────────────┴──────────────┘
```

### Navigation Tabs (Left Sidebar)

1. **🗺️ Global Map** - Intelligence hotspots, conflicts, infrastructure
2. **📊 Markets & Equities** - SPX, NASDAQ, sectors, correlations
3. **⚡ Digital Assets** - BTC/ETH dominance, crypto analysis
4. **💰 Macro & Economics** - FRED data, yields, central banks
5. **📰 Intelligence** - News feeds, sentiment analysis
6. **⚠️ Risk Dashboard** - Cascading risk analysis
7. **🧠 AI Analysis** - Powered insights and predictions

---

## 🗺️ Using the Global Map

### Toggle Layers

1. Click **"Map Layers"** button (top right of map)
2. Check/uncheck layers in categories:
   - Intelligence (Hotspots, Conflicts, Military)
   - Infrastructure (Nuclear, Cables, Pipelines)
   - Transportation (Ships, Flights)
   - Events (Protests, Displacement)
   - Natural (Weather, Earthquakes)

### Layer Colors

- **Cyan** - Active monitoring
- **Red** - High threat/conflict
- **Amber** - Medium alert
- **Green** - Normal activity

### Example: Find Conflict Zones

1. Open layer control
2. Expand "Intelligence" category
3. Check "Conflict Zones"
4. Red dots appear on map at conflict locations
5. Hover for details

---

## 💹 Markets Dashboard

### Access It

Left sidebar → **Markets & Equities** → Choose sub-tab

### Sub-Tabs

1. **Summary** - Global indices, commodities, correlations
2. **Sector Map** - Sector heatmap visualization
3. **Heatmap** - S&P 500 component performance
4. **Screener** - Filter stocks by sector/performance

### Try This

Go to **Screener** tab:
- Filter by sector: "Technology"
- Sort by: "Gainers"
- See top tech stocks with % changes

---

## ₿ Crypto Dashboard

### Access It

Left sidebar → **Digital Assets** → Choose sub-tab

### Two Tabs

1. **Crypto Pro**
   - BTC/ETH dominance
   - Stablecoin flows
   - Liquidation heatmap (by price level)
   - Whale tracker

2. **Order Flow**
   - Bitcoin ETF tracker
   - Order flow charts

### Try This

Go to **Crypto Pro**:
- See BTC dominance percentage at top
- Scroll to liquidation heatmap
- Red = BTC longs liquidation, Green = shorts
- Hover on price levels to see volumes

---

## 📈 Economics Dashboard

### Access It

Left sidebar → **Macro & Economics** → Choose sub-tab

### Four Sub-Tabs

1. **Summary** - Key macro indicators + Fed rates
2. **FRED Data** - Economic data series
3. **Yields** - Treasury curve
4. **Central Banks** - Rate decisions + policy

### Try This

Go to **Summary**:
- See CPI, unemployment, wage growth
- Color coded: Green (improving), Red (worsening)
- Central bank policy table below

---

## 🧠 AI & Risk Scoring

### Access AI Insights

Look at **Right Panel** (always visible unless toggled off):

- **Risk Score** (0-10) with color coding
- **Market Sentiment** breakdown (Bullish/Neutral/Bearish)
- **Critical Alerts** list
- **Latest Intel** feed

### Understanding Risk Score

```
0-3:      LOW (Green) - Safe conditions
3-5:      MODERATE (Amber) - Standard caution
5-7.5:    ELEVATED (Orange) - Increased monitoring
7.5-10:   CRITICAL (Red) - Emergency protocols
```

### Alerts

Critical alerts show in right panel with:
- Event name
- Brief description
- Severity badge

---

## 🔧 Add Real Data (Optional)

### Step 1: Get API Keys

Free options:
```
CoinGecko  - Free tier, no key needed (or get at coingecko.com)
FRED       - Free at fred.stlouisfed.org
NewsAPI    - Free at newsapi.org
Alpha Vantage - Free tier (limited) at alphavantage.co
```

### Step 2: Update .env.local

```env
COINGECKO_API_KEY="your-key-here"
FRED_API_KEY="your-key-here"
NEWSAPI_KEY="your-key-here"
ALPHA_VANTAGE_KEY="your-key-here"
```

### Step 3: Uncomment API Calls

In `services/dataProvider.ts`:

```typescript
// Uncomment CoinGecko integration
async fetchFromCoinGecko(ids: string[]) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`
  );
  return response.json();
}
```

### Step 4: Restart Server

```bash
pnpm run dev
```

---

## 💾 Setup Database (Optional)

### If Using Local PostgreSQL

```bash
# Create database
createdb quantum_terminal

# Set environment
export DATABASE_URL="postgresql://user:password@localhost:5432/quantum_terminal"

# Run migrations
pnpm run db:migrate

# Optional: Seed data
pnpm run db:seed
```

### If Using Railway (Recommended for Production)

1. Create account at railway.app
2. Create new project
3. Add PostgreSQL
4. Copy connection string
5. Update `.env.local`:
   ```env
   DATABASE_URL="postgresql://railway...@..."
   ```
6. Run migrations:
   ```bash
   pnpm run db:migrate
   ```

---

## 🚀 Deploy to Vercel

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Initial quantum terminal deployment"
git push origin main
```

### Step 2: Connect to Vercel

```bash
vercel link
```

### Step 3: Add Environment Variables

```bash
vercel env add DATABASE_URL
vercel env add OPENAI_API_KEY
vercel env add COINGECKO_API_KEY
# ... add others
```

### Step 4: Deploy

```bash
vercel deploy --prod
```

Your terminal will be live at `your-project.vercel.app`

---

## 🎮 Common Tasks

### Change Default Tab

In `app/page.tsx`:
```typescript
const [activeTab, setActiveTab] = useState<TabType>('map'); // Change this
```

### Adjust Colors

Edit `app/globals.css`:
```css
:root {
  --primary: #00D9FF;        /* Change cyan to your color */
  --glow-cyan: 180 100% 50%; /* Adjust hue/saturation/lightness */
}
```

### Add New Dashboard Tab

1. Create `components/dashboards/NewTabName.tsx`
2. Add to navigation in `components/layout/LeftSidebar.tsx`
3. Add case in `app/page.tsx` switch statement
4. Import component

### Connect New API Endpoint

1. Create `app/api/new-feature/route.ts`
2. Add fetch call in `services/dataProvider.ts`
3. Subscribe with React Query or Zustand
4. Display in component

---

## 🐛 Troubleshooting

### "Cannot find module" error
```bash
pnpm install
pnpm run db:generate
```

### "DATABASE_URL not set"
```bash
cp .env.example .env.local
# Edit .env.local and add your database connection
```

### Map not loading
- Check browser console for errors
- MapLibre GL loads by default (no API key needed)
- If using Mapbox, add API key to `.env.local`

### Port 3000 already in use
```bash
pnpm run dev -- -p 3001  # Use different port
```

### Build errors
```bash
rm -rf .next node_modules
pnpm install
pnpm run build
```

---

## 📊 Data Structure

### How to Query Market Data

```typescript
// In a component or API route
import { dataProvider } from '@/services/dataProvider';

const markets = await dataProvider.getMarketData();
// Returns: [
//   { symbol: 'SPX', price: 4782.61, change: 1.24, ... },
//   { symbol: 'BTC', price: 42156.78, change: 3.45, ... },
// ]
```

### How to Calculate Risk Score

```typescript
import { calculateRiskScore } from '@/services/riskScorer';

const assessment = calculateRiskScore({
  marketVolatility: 5.2,
  geopoliticalTension: 4.5,
  macroEconomic: 4.8,
  cryptoLiquidity: 6.2,
  technicalBreakdown: 4.1,
  liquidationRisk: 3.2,
});

console.log(assessment.overallScore);  // 4.8
console.log(assessment.level);         // 'MODERATE'
console.log(assessment.recommendations); // ['...', '...']
```

---

## 🔌 Real-time Updates (Advanced)

### Subscribe to WebSocket

```typescript
const ws = new WebSocket('ws://localhost:3000/api/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['markets', 'crypto', 'news']
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Update received:', message);
};
```

---

## 📚 File Reference

Quick find guide:

| I want to... | File |
|---|---|
| Change theme colors | `app/globals.css` |
| Modify layout | `components/layout/` |
| Add new dashboard | `components/dashboards/` |
| Change navigation | `components/layout/LeftSidebar.tsx` |
| Add API endpoint | `app/api/` |
| Add database table | `prisma/schema.prisma` |
| Modify state | `store/` |
| Add utility function | `lib/` |

---

## 💡 Pro Tips

1. **Dark mode is always on** - No toggle needed, it's the theme
2. **Hover for details** - Most elements have tooltip/hover states
3. **Use browser DevTools** - Check Console for errors, Network tab for API calls
4. **Mock data updates** - Refresh page to get new mock data variations
5. **Database optional** - App works great with mock data, DB adds persistence

---

## 🎓 Next Learning Steps

1. **Modify a component** - Try changing MarketsTab styling
2. **Connect an API** - Add CoinGecko to fetch real crypto prices
3. **Add a new layer** - Create new GeoJSON layer in map
4. **Create custom alert** - Add new alert type in alertStore
5. **Deploy version** - Push to Vercel and share link

---

## 📞 Getting Help

1. **Check docs**: README.md, SETUP.md, ARCHITECTURE.md
2. **Review examples**: Look at similar components for patterns
3. **Read comments**: Code has inline documentation
4. **Test incrementally**: Make one small change at a time

---

## ✅ You're Ready!

Your Quantum Terminal is now:
- ✅ Running locally with mock data
- ✅ Fully styled with cyberpunk theme
- ✅ Ready for real data integration
- ✅ Ready for production deployment

**Next steps**: Pick a task from "Next Learning Steps" or deploy to production!

---

**Welcome aboard, intelligence officer. Your quantum terminal is operational.**
