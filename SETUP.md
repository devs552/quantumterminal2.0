# Malik's Quantum Terminal - Setup & Installation Guide

## Prerequisites

- Node.js 18+ and npm/pnpm
- PostgreSQL 14+ (for local development or Railway for production)
- Git

## Quick Start

### 1. Clone & Install

```bash
git clone <repository-url>
cd maliks-quantum-terminal
pnpm install
```

### 2. Environment Setup

Create `.env.local`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/quantum_terminal"

# API Keys (Optional - for external integrations)
NEXT_PUBLIC_API_URL="http://localhost:3000"
OPENAI_API_KEY="sk-your-key-here"
COINGECKO_API_KEY="your-key"
ALPHA_VANTAGE_KEY="your-key"
FRED_API_KEY="your-key"
NEWSAPI_KEY="your-key"

# NextAuth Configuration (for future auth implementation)
NEXTAUTH_SECRET="generate-random-string"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Database Setup

#### Option A: Local PostgreSQL

```bash
# Create database
createdb quantum_terminal

# Run migrations
pnpm run db:migrate

# Seed data (optional)
pnpm run db:seed
```

#### Option B: Railway (Production)

1. Create Railway project
2. Add PostgreSQL database
3. Copy connection string to `DATABASE_URL`

```bash
# Apply migrations to production
pnpm run db:migrate -- --production
```

### 4. Generate Prisma Client

```bash
pnpm run db:generate
```

### 5. Start Development Server

```bash
pnpm run dev
```

Navigate to `http://localhost:3000`

## Project Structure

```
├── app/
│   ├── api/                 # Next.js API routes
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Main terminal page
│   └── globals.css          # Design tokens
│
├── components/
│   ├── layout/              # Main layout components
│   ├── map/                 # Map & geospatial
│   ├── dashboards/          # Dashboard tabs
│   ├── charts/              # Chart components
│   ├── ai/                  # AI analysis components
│   ├── feeds/               # News & intel feeds
│   └── ui/                  # Reusable UI components
│
├── store/                   # Zustand state stores
├── services/                # Business logic services
├── lib/                     # Utilities & helpers
├── prisma/                  # Database schema
└── public/                  # Static assets
```

## Key Features Setup

### Real-time Updates with WebSocket

1. Ensure `websocketManager.ts` is properly initialized
2. Clients subscribe to channels: `markets`, `crypto`, `news`, `alerts`, `ai`, `map`
3. Updates broadcast every 3-5 seconds

### AI Analysis Integration

1. Add `OPENAI_API_KEY` to environment
2. Implement streaming in `/app/api/ai/analyze/route.ts`
3. Use `@ai-sdk/openai` for model calls

### External API Integration

#### CoinGecko (Free)
```typescript
// lib/integrations/coingecko.ts
const url = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd`;
```

#### Alpha Vantage (Equity Data)
```typescript
// lib/integrations/alpha-vantage.ts
const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${key}`;
```

#### FRED (Macro Data)
```typescript
// lib/integrations/fred.ts
const url = `https://api.stlouisfed.org/fred/series/observations?series_id=UNRATE&api_key=${key}`;
```

## Database Migrations

### Create a New Migration

```bash
pnpm run db:migrate:create --name add_user_preferences
```

### Apply Migrations

```bash
pnpm run db:migrate
```

### Reset Database (Dev Only)

```bash
pnpm run db:reset
```

## Deployment to Vercel

### 1. Connect Repository

```bash
vercel link
```

### 2. Add Environment Variables

```bash
vercel env add DATABASE_URL
vercel env add OPENAI_API_KEY
vercel env add NEXTAUTH_SECRET
```

### 3. Deploy

```bash
vercel deploy --prod
```

### 4. Run Migrations on Production

```bash
# Via Vercel CLI
vercel env pull
pnpm run db:migrate -- --production
```

## Database on Railway

### 1. Create PostgreSQL

1. Go to Railway.app
2. Create new project
3. Add PostgreSQL database
4. Copy `DATABASE_URL`

### 2. Set Environment Variables in Railway

```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
```

### 3. Deploy

Railway can auto-deploy from GitHub or use:

```bash
railway login
railway link
railway deploy
```

## Development Commands

```bash
# Start dev server
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm run start

# Database commands
pnpm run db:generate    # Generate Prisma client
pnpm run db:migrate     # Run migrations
pnpm run db:seed        # Seed sample data
pnpm run db:reset       # Reset database
pnpm run db:studio      # Open Prisma Studio

# Linting & Testing
pnpm run lint
pnpm run type-check
pnpm run test

# Format code
pnpm run format
```

## API Testing

### Test Market Data Endpoint

```bash
curl http://localhost:3000/api/markets
```

### Test Crypto Data Endpoint

```bash
curl http://localhost:3000/api/crypto
```

### Test AI Analysis

```bash
curl -X POST http://localhost:3000/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"asset":"BTC","period":"24h"}'
```

### WebSocket Connection Test

```javascript
const ws = new WebSocket('ws://localhost:3000/api/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['markets', 'crypto']
  }));
};
ws.onmessage = (event) => console.log(event.data);
```

## Troubleshooting

### Database Connection Error

- Check `DATABASE_URL` in `.env.local`
- Ensure PostgreSQL is running: `psql -U postgres`
- Verify network access if using remote database

### Build Errors

```bash
# Clear cache and rebuild
rm -rf .next node_modules
pnpm install
pnpm run build
```

### WebSocket Connection Failed

- Ensure API route exists at `/app/api/ws/route.ts`
- Check browser console for errors
- Verify environment supports WebSocket (Vercel does)

### Missing Types

```bash
pnpm run db:generate
pnpm run type-check
```

## Performance Optimization

### Caching Strategy

- Market data: 30 seconds
- Crypto data: 15 seconds
- Macro data: 5 minutes
- News: 1 minute

### Database Indexing

Key indexes already defined on:
- `market_prices(symbol, timestamp)`
- `crypto_price(symbol, timestamp)`
- `news_articles(sentiment, publishedAt)`
- `conflict_events(severity, eventDate)`

### Frontend Optimization

- Image optimization with Next.js Image component
- Code splitting via dynamic imports
- React Query for client-side caching
- Zustand for lightweight state management

## Security Checklist

- [ ] Set strong `NEXTAUTH_SECRET`
- [ ] Enable HTTPS in production
- [ ] Rotate API keys regularly
- [ ] Enable Row Level Security (RLS) on PostgreSQL
- [ ] Use environment variables for all secrets
- [ ] Implement rate limiting on API endpoints
- [ ] Add CORS configuration

## Monitoring & Logging

### Enable Vercel Analytics

```typescript
import { Analytics } from '@vercel/analytics/next';

export default function RootLayout() {
  return (
    <>
      {children}
      <Analytics />
    </>
  );
}
```

### Database Monitoring

Use Railway or PostgreSQL Dashboard to monitor:
- Query performance
- Connection count
- Disk usage

## Support & Resources

- Docs: https://docs.quantum-terminal.local
- GitHub Issues: [Your repo]
- Discord Community: [Your server]
- Email: support@quantum-terminal.local
