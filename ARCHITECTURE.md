# System Architecture - Malik's Quantum Terminal

## 🏗️ High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Vercel Edge)                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Next.js 16 (App Router)                                      │  │
│  │ ├─ React 19 Components                                       │  │
│  │ ├─ TailwindCSS + Design Tokens                               │  │
│  │ ├─ State: Zustand + React Query                              │  │
│  │ └─ Real-time: WebSocket Client                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           ↓↑                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ API Routes & Server Components                               │  │
│  │ ├─ /api/markets - Market data                                │  │
│  │ ├─ /api/crypto - Crypto data                                 │  │
│  │ ├─ /api/macro - Economic indicators                          │  │
│  │ ├─ /api/ai/analyze - AI analysis                             │  │
│  │ └─ /api/ws - WebSocket handler                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                             ↓↑
        ┌────────────────────┼────────────────────┐
        ↓                    ↓                    ↓
   ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
   │  PostgreSQL │   │ External API │   │    Redis     │
   │  (Railway)  │   │  Integrations│   │   (Cache)    │
   │             │   │              │   │   (Optional) │
   │ - Users     │   │ - CoinGecko  │   │              │
   │ - Markets   │   │ - FRED       │   │ Stores:      │
   │ - Crypto    │   │ - NewsAPI    │   │ - Sessions   │
   │ - News      │   │ - OpenAI     │   │ - Cache Data │
   │ - Events    │   │ - Alpha Vantage  │              │
   │ - Alerts    │   │              │   │              │
   └─────────────┘   └──────────────┘   └──────────────┘
```

## 🔄 Data Flow Architecture

### Market Data Pipeline

```
┌─────────────────┐
│ External APIs   │
│ (CoinGecko,     │
│  Alpha Vantage, │
│  FRED)          │
└────────┬────────┘
         │
         ↓ (30-60 sec intervals)
┌─────────────────┐
│  Data Provider  │ (dataProvider.ts)
│  - Polling      │
│  - Validation   │
│  - Transformation│
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Cache Layer    │ (Redis/Memory)
│  - TTL: 30s     │
│  - Invalidation │
└────────┬────────┘
         │
         ├──→ Database  (Historical)
         ├──→ WebSocket (Real-time)
         └──→ API Route (On-demand)
              │
              ↓
          Frontend (React)
```

### Real-time Update Flow

```
User Action
    ↓
[WebSocket Manager]
    ├─ Subscribe to channels
    ├─ Receive updates
    └─ Broadcast to clients
    ↓
[Data Generator Service]
    ├─ Market Updates (5s)
    ├─ Crypto Updates (3s)
    ├─ News Updates (30s)
    └─ Alert Triggers (Real-time)
    ↓
[Client WebSocket Handler]
    ├─ Parse message
    ├─ Zustand store update
    └─ UI re-render
```

### AI Analysis Pipeline

```
Market Data + News + Events
    ↓
[Risk Scorer]
    ├─ Calculate risk factors
    ├─ Identify cascading risks
    └─ Generate recommendations
    ↓
[OpenAI Integration]
    ├─ Send prompt with context
    ├─ Stream response
    └─ Format analysis
    ↓
[Cache & Store]
    ├─ Store in DB (TTL: 30m)
    ├─ Cache in Redis
    └─ Send to client
    ↓
[Frontend]
    ├─ Display AI insights
    ├─ Update risk score
    └─ Show recommendations
```

## 🗄️ Database Architecture

### Core Tables

```
┌──────────────┐
│    Users     │ (Auth & Sessions)
├──────────────┤
│ id (PK)      │
│ email        │
│ username     │
│ tier         │
│ createdAt    │
└────┬─────────┘
     │
     ├─→ ┌──────────────────┐
     │   │   Dashboards     │ (User Configs)
     │   ├──────────────────┤
     │   │ userId (FK)      │
     │   │ layout           │
     │   │ visibleLayers    │
     │   └──────────────────┘
     │
     ├─→ ┌──────────────────┐
     │   │   Watchlists     │ (Asset Tracking)
     │   ├──────────────────┤
     │   │ userId (FK)      │
     │   │ assets[]         │
     │   └──────────────────┘
     │
     └─→ ┌──────────────────┐
         │   UserAlerts     │ (Notifications)
         ├──────────────────┤
         │ userId (FK)      │
         │ severity         │
         │ triggered        │
         └──────────────────┘

┌──────────────────────┐
│   Market Data        │ (Time-series)
├──────────────────────┤
│ symbol (INDEX)       │
│ price                │
│ change               │
│ volume               │
│ timestamp (INDEX)    │
└──────────────────────┘

┌──────────────────────┐
│   News Articles      │ (Intelligence)
├──────────────────────┤
│ title                │
│ sentiment            │
│ region (INDEX)       │
│ impact               │
│ publishedAt (INDEX)  │
└──────────────────────┘

┌──────────────────────┐
│   Conflict Events    │ (Geopolitical)
├──────────────────────┤
│ location             │
│ severity (INDEX)     │
│ type                 │
│ timestamp (INDEX)    │
└──────────────────────┘
```

### Indexing Strategy

```
Critical Indexes:
├─ market_prices(symbol, timestamp) - Query by asset & date
├─ crypto_prices(symbol, timestamp) - Frequent lookups
├─ news_articles(sentiment, publishedAt) - Filter & sort
├─ conflict_events(severity, eventDate) - Risk queries
├─ users(email) - Auth lookups
└─ dashboards(userId, isDefault) - User configs
```

## 🔌 API Architecture

### Endpoint Layers

```
Level 1: Public Endpoints (Cached, Rate Limited)
├─ GET /api/markets
├─ GET /api/crypto
├─ GET /api/macro
└─ GET /api/news

Level 2: Authenticated Endpoints
├─ GET /api/user/dashboards
├─ POST /api/user/watchlist
├─ GET /api/user/alerts
└─ POST /api/alerts/subscribe

Level 3: Premium Features (Rate Limited Strict)
├─ POST /api/ai/analyze (Streaming)
├─ POST /api/ai/predict
├─ GET /api/ai/insights
└─ WS /api/ws (WebSocket)

Level 4: Admin Endpoints
├─ POST /api/admin/sync-data
├─ POST /api/admin/cache-clear
└─ GET /api/admin/stats
```

### Request/Response Pattern

```
Request:
┌─ Headers
│  ├─ Authorization: Bearer {token}
│  ├─ Content-Type: application/json
│  └─ X-Request-ID: {uuid}
├─ Query Parameters
│  ├─ ?symbol=BTC
│  ├─ ?period=24h
│  └─ ?sort=change
└─ Body (if POST/PUT)
   └─ { asset: "BTC", period: "24h" }

Response:
┌─ Status: 200 | 400 | 401 | 429 | 500
├─ Headers
│  ├─ Content-Type: application/json
│  ├─ Cache-Control: max-age=30
│  └─ X-RateLimit-Remaining: 95
└─ Body
   ├─ success: true
   ├─ data: { ... }
   ├─ timestamp: 1708943923
   └─ cacheAge: 5
```

## 🎯 State Management Architecture

### Zustand Stores

```
DashboardStore
├─ activeTab: 'map' | 'markets' | 'crypto' | ...
├─ sidebarOpen: boolean
├─ rightPanelOpen: boolean
└─ setActiveTab, toggleSidebar, toggleRightPanel

MapStore
├─ visibleLayers: Record<string, boolean>
├─ zoom: number
├─ selectedFeature: Feature | null
├─ hoverFeature: Feature | null
└─ toggleLayer, setZoom, selectFeature

AlertStore
├─ alerts: Alert[]
├─ getCriticalCount: () => number
└─ addAlert, removeAlert, clearAlerts

UserStore (Future)
├─ user: User | null
├─ isAuthenticated: boolean
├─ preferences: UserPreferences
└─ logout, updatePreferences
```

### React Query Setup

```
Markets Query
├─ queryKey: ['markets', { symbol, period }]
├─ queryFn: () => fetch('/api/markets')
├─ staleTime: 30000
├─ cacheTime: 300000
└─ refetchInterval: 30000

Crypto Query
├─ queryKey: ['crypto']
├─ queryFn: () => fetch('/api/crypto')
├─ staleTime: 15000
├─ cacheTime: 300000
└─ refetchInterval: 15000

News Query
├─ queryKey: ['news', { region, sentiment }]
├─ queryFn: () => fetch('/api/news')
├─ staleTime: 60000
├─ cacheTime: 600000
└─ refetchInterval: 60000
```

## 🔐 Security Architecture

### Authentication Flow (Planned)

```
User
  ↓
[Login Page]
  ├─ Email/Password or OAuth
  ↓
[NextAuth Handler]
  ├─ Validate credentials
  ├─ Generate session
  ├─ Set HttpOnly cookie
  ↓
[Protected API Routes]
  ├─ Check session
  ├─ Verify JWT
  └─ Execute endpoint
```

### Rate Limiting Strategy

```
Per User Per Minute:
├─ Public endpoints: 100 requests
├─ Authenticated: 1000 requests
├─ Premium: 10000 requests
└─ Admin: Unlimited

Per IP Per Hour:
├─ All endpoints: 5000 requests
└─ Auth endpoint: 20 requests
```

### Data Security

```
Encryption:
├─ API Keys: Encrypted at rest
├─ Passwords: Bcrypt hashing
└─ Sessions: JWT signing

Network:
├─ HTTPS/TLS 1.3
├─ CORS configuration
└─ CSRF protection

Database:
├─ Row Level Security (RLS)
├─ Parameterized queries
└─ Input validation
```

## 📊 Performance Architecture

### Caching Strategy

```
                    Time to Live
┌────────────────────────────────────┐
│ Layer 1: Browser Cache             │ 5 min
│ └─ Service Worker / Local Cache    │
├────────────────────────────────────┤
│ Layer 2: CDN/Edge Cache (Vercel)   │ 1 min
│ └─ Automatic for static/ISR        │
├────────────────────────────────────┤
│ Layer 3: Application Cache (Redis) │ 30 sec
│ └─ Market data, crypto prices      │
├────────────────────────────────────┤
│ Layer 4: Database Cache            │ 1 hour
│ └─ Query result caching            │
└────────────────────────────────────┘
```

### Database Optimization

```
Query Patterns:
├─ Time-series queries (IndexScan)
│  └─ WHERE symbol='BTC' AND timestamp > now()-24h
├─ Aggregation queries (GROUP BY)
│  └─ SELECT sector, AVG(change) FROM prices GROUP BY sector
├─ Full-text search (GiST Index)
│  └─ WHERE title @@ plainto_tsquery('crisis')
└─ Geographic queries (PostGIS)
   └─ WHERE ST_DWithin(location, point, 10000)

Batch Operations:
├─ Bulk inserts: INSERT INTO prices (VALUES...) 1000x
├─ Bulk updates: UPDATE prices SET change=... WHERE date=...
└─ Parallel queries: Multi-connection pooling
```

## 🔄 WebSocket Architecture

### Connection Management

```
Client                              Server
  │                                  │
  ├─ WebSocket handshake ────────────→
  │                                  │ Create connection
  │ ←────────── Connection ACK ──────┤
  │                                  │
  ├─ Subscribe message ──────────────→
  │ { type: 'subscribe',             │
  │   channels: ['markets','crypto']}│ Register subscriptions
  │                                  │
  │ ←─── Update (every 3-5s) ─────────┤
  │ { type: 'update',                │
  │   data: {...} }                  │
  │                                  │
  │ ←─── Alert (real-time) ───────────┤
  │ { type: 'alert',                 │
  │   severity: 'critical' }         │
  │                                  │
  └─ Ping message ───────────────────→
    Heartbeat every 30s
```

### Message Format

```
Subscribe:
{
  "type": "subscribe",
  "channels": ["markets", "crypto", "news"]
}

Update:
{
  "type": "update",
  "channels": ["crypto"],
  "data": {
    "symbol": "BTC",
    "price": 42156.78,
    "change": 3.45,
    "timestamp": 1708943923
  }
}

Alert:
{
  "type": "alert",
  "severity": "critical",
  "message": "USD/CHF correlation break",
  "timestamp": 1708943923
}
```

## 🚀 Deployment Architecture

### Vercel Frontend Deployment

```
GitHub Repository
    ↓ (On Push to Main)
[Vercel Build]
├─ Install Dependencies
├─ Run Type Check
├─ Build Next.js App
└─ Generate Static Files
    ↓
[Vercel Edge Network]
├─ Region 1 (US East)
├─ Region 2 (EU)
└─ Region 3 (APAC)
    ↓
[API Routes]
├─ Serverless Functions
└─ Edge Middleware
    ↓
Database
└─ Railway PostgreSQL
```

### Railway Backend Deployment

```
GitHub Repository
    ↓ (Linked to Railway)
[Railway Build]
├─ Install Node dependencies
├─ Run Database Migrations
└─ Start Server
    ↓
[Railway Deployment]
├─ Environment Variables
├─ PostgreSQL Instance
├─ Resource Limits
└─ Auto-scaling
```

## 📈 Scalability Considerations

### Horizontal Scaling

```
Load Balancer
    ↓
┌───┴───┬───────┬────────┐
│       │       │        │
v       v       v        v
[API-1] [API-2] [API-3] [API-N]
  ↓       ↓       ↓       ↓
  └───────┴───────┴───────┘
           ↓
      PostgreSQL
      (Connection Pool)
           ↓
    ┌──────┴──────┐
    ↓             ↓
  [Redis]   [Replicas]
```

### Database Scaling

```
Single Server (Development)
    ↓ (Traffic Increases)
Read Replicas
├─ Primary: Write operations
└─ Replicas: Read operations
    ↓
Sharding (Future)
├─ Shard 1: Users A-M
├─ Shard 2: Users N-Z
└─ Distributed transactions
```

---

This architecture supports millions of requests/day while maintaining sub-100ms latency for critical paths.
