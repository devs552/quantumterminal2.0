// app/api/risk-data/route.ts
import { NextResponse } from 'next/server';

// ── Tickers ───────────────────────────────────────────────────────────────────
const TICKERS = ['^VIX', '^TNX', '^IRX', 'DX-Y.NYB', 'GC=F', 'HYG', '^GSPC', 'BTC-USD'];

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

// ── Server-side session cache (survives across requests in same process) ───────
interface YahooSession {
  cookie: string;
  crumb: string;
  fetchedAt: number;
}

// Module-level singleton — shared across all incoming requests
let sessionCache: YahooSession | null = null;
const SESSION_TTL_MS = 50 * 60 * 1000; // 50 minutes (Yahoo sessions last ~1h)

// ── Step 1: Get session cookie from fc.yahoo.com ──────────────────────────────
async function fetchCookie(): Promise<string> {
  const res = await fetch('https://fc.yahoo.com', {
    headers: HEADERS,
    redirect: 'follow',
  });

  // Cookie comes back in Set-Cookie header
  const raw = res.headers.get('set-cookie') ?? '';

  // Extract the A1 or B cookie — either works as the session token
  // Format: "A1=d=AQABB...; Max-Age=...; Domain=.yahoo.com; ..."
  const match = raw.match(/A1=([^;]+)/);
  if (match) return `A1=${match[1]}`;

  // Fallback: try to grab any Set-Cookie value
  const fallback = raw.split(';')[0];
  if (fallback) return fallback;

  throw new Error('Could not extract session cookie from fc.yahoo.com');
}

// ── Step 2: Exchange cookie for crumb ─────────────────────────────────────────
async function fetchCrumb(cookie: string): Promise<string> {
  const res = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: {
      ...HEADERS,
      Cookie: cookie,
    },
  });

  if (!res.ok) {
    throw new Error(`Crumb endpoint returned ${res.status}`);
  }

  const text = (await res.text()).trim();

  if (!text || text.toLowerCase().includes('unauthorized')) {
    throw new Error('Empty or invalid crumb returned');
  }

  return text;
}

// ── Step 3: Fetch quotes with cookie + crumb ──────────────────────────────────
interface YahooQuote {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketPreviousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

interface YahooQuoteResponse {
  quoteResponse: {
    result: YahooQuote[];
    error: null | string;
  };
}

async function fetchQuotes(cookie: string, crumb: string): Promise<YahooQuote[]> {
  const symbols = TICKERS.join(',');
  const url =
    `https://query2.finance.yahoo.com/v7/finance/quote` +
    `?symbols=${encodeURIComponent(symbols)}&crumb=${encodeURIComponent(crumb)}` +
    `&fields=regularMarketPrice,regularMarketChangePercent,regularMarketPreviousClose,fiftyTwoWeekHigh,fiftyTwoWeekLow`;

  const res = await fetch(url, {
    headers: {
      ...HEADERS,
      Cookie: cookie,
    },
  });

  if (res.status === 401) {
    // Session expired — caller should retry with a fresh session
    throw new Error('SESSION_EXPIRED');
  }

  if (!res.ok) {
    throw new Error(`Quote endpoint returned ${res.status}`);
  }

  const data = (await res.json()) as YahooQuoteResponse;
  const results = data?.quoteResponse?.result;

  if (!Array.isArray(results)) {
    throw new Error('Unexpected response shape from Yahoo Finance');
  }

  return results;
}

// ── Session manager: get a valid session, refreshing if stale ─────────────────
async function getValidSession(): Promise<YahooSession> {
  const now = Date.now();

  if (sessionCache && now - sessionCache.fetchedAt < SESSION_TTL_MS) {
    return sessionCache;
  }

  // Fetch fresh cookie + crumb
  const cookie = await fetchCookie();
  const crumb  = await fetchCrumb(cookie);

  sessionCache = { cookie, crumb, fetchedAt: now };
  return sessionCache;
}

// ── Normalise raw market values into 0–100 risk scores ───────────────────────
function normalise(value: number, min: number, max: number): number {
  return Math.min(100, Math.max(0, Math.round(((value - min) / (max - min)) * 100)));
}

function buildRiskFactors(quotes: YahooQuote[]) {
  const q = (sym: string) => quotes.find(r => r.symbol === sym);

  const vix  = q('^VIX');
  const tnx  = q('^TNX');
  const irx  = q('^IRX');
  const dxy  = q('DX-Y.NYB');
  const gold = q('GC=F');
  const hyg  = q('HYG');
  const spx  = q('^GSPC');

  // VIX: 10=calm, 20=normal, 30=stressed, 50+=extreme
  const vixPrice  = vix?.regularMarketPrice ?? 20;
  const vixScore  = normalise(vixPrice, 10, 50);

  // Yield curve: 10yr minus 13wk. Negative=inverted=high risk
  const tnxPrice  = tnx?.regularMarketPrice ?? 4;
  const irxPrice  = irx?.regularMarketPrice ?? 5;
  const spread    = tnxPrice - irxPrice;
  // Invert: more negative spread → higher risk score
  const yieldScore = normalise(-spread, -2.5, 2.5);

  // HYG: lower price = credit stress. Typical range 70–90
  const hygPrice  = hyg?.regularMarketPrice ?? 80;
  const hygScore  = normalise(100 - hygPrice, 10, 30);

  // VIX day change magnitude as fear momentum
  const vixChgPct = Math.abs(vix?.regularMarketChangePercent ?? 0);
  const pcScore   = normalise(vixChgPct, 0, 15);

  // DXY: >104 = tight conditions = bearish for risk assets
  const dxyPrice  = dxy?.regularMarketPrice ?? 102;
  const dxyScore  = normalise(dxyPrice, 90, 115);

  // Gold: high gold = flight to safety
  const goldPrice = gold?.regularMarketPrice ?? 2000;
  const goldScore = normalise(goldPrice, 1800, 3200);

  // S&P 500: negative day → risk-off
  const spxChg    = spx?.regularMarketChangePercent ?? 0;
  const spxScore  = normalise(-spxChg, -3, 3);

  const factors = [
    {
      id: 'vix',
      name: 'VIX Volatility Index',
      category: 'market' as const,
      value: vixScore,
      rawValue: vixPrice,
      rawDisplay: vixPrice.toFixed(2),
      delta: parseFloat((vix?.regularMarketChangePercent ?? 0).toFixed(2)),
      weight: 0.22,
      direction: (vixScore >= 55 ? 'bearish' : vixScore >= 35 ? 'neutral' : 'bullish') as 'bearish' | 'neutral' | 'bullish',
      description: 'CBOE implied volatility for S&P 500 options — primary fear gauge',
      ticker: '^VIX',
    },
    {
      id: 'yield',
      name: 'Yield Curve (10yr − 13wk)',
      category: 'macro' as const,
      value: yieldScore,
      rawValue: spread,
      rawDisplay: `${spread > 0 ? '+' : ''}${spread.toFixed(2)}%`,
      delta: parseFloat(((tnx?.regularMarketChangePercent ?? 0) - (irx?.regularMarketChangePercent ?? 0)).toFixed(2)),
      weight: 0.18,
      direction: (spread < -0.1 ? 'bearish' : spread > 0.5 ? 'bullish' : 'neutral') as 'bearish' | 'neutral' | 'bullish',
      description: 'Inverted yield curve historically predicts recession — negative spread = elevated risk',
      ticker: '^TNX / ^IRX',
    },
    {
      id: 'credit',
      name: 'High Yield Bond ETF (HYG)',
      category: 'credit' as const,
      value: hygScore,
      rawValue: hygPrice,
      rawDisplay: `$${hygPrice.toFixed(2)}`,
      delta: parseFloat((hyg?.regularMarketChangePercent ?? 0).toFixed(2)),
      weight: 0.18,
      direction: (hygScore >= 60 ? 'bearish' : hygScore >= 35 ? 'neutral' : 'bullish') as 'bearish' | 'neutral' | 'bullish',
      description: 'HYG price proxy for credit risk — falling price signals spread widening and default risk',
      ticker: 'HYG',
    },
    {
      id: 'pcr',
      name: 'VIX Momentum (Fear Velocity)',
      category: 'market' as const,
      value: pcScore,
      rawValue: vixChgPct,
      rawDisplay: `${(vix?.regularMarketChangePercent ?? 0) > 0 ? '+' : ''}${(vix?.regularMarketChangePercent ?? 0).toFixed(1)}%`,
      delta: 0,
      weight: 0.14,
      direction: (pcScore >= 55 ? 'bearish' : 'neutral') as 'bearish' | 'neutral' | 'bullish',
      description: 'Rate of VIX change — rapid spikes indicate acute and accelerating market fear',
      ticker: '^VIX Δ%',
    },
    {
      id: 'dxy',
      name: 'US Dollar Index (DXY)',
      category: 'macro' as const,
      value: dxyScore,
      rawValue: dxyPrice,
      rawDisplay: dxyPrice.toFixed(2),
      delta: parseFloat((dxy?.regularMarketChangePercent ?? 0).toFixed(2)),
      weight: 0.10,
      direction: (dxyScore >= 60 ? 'bearish' : dxyScore <= 35 ? 'bullish' : 'neutral') as 'bearish' | 'neutral' | 'bullish',
      description: 'Strong dollar tightens global financial conditions and pressures risk assets globally',
      ticker: 'DX-Y.NYB',
    },
    {
      id: 'gold',
      name: 'Gold Futures (Safe Haven)',
      category: 'geopolitical' as const,
      value: goldScore,
      rawValue: goldPrice,
      rawDisplay: `$${goldPrice.toFixed(0)}`,
      delta: parseFloat((gold?.regularMarketChangePercent ?? 0).toFixed(2)),
      weight: 0.10,
      direction: (goldScore >= 65 ? 'bearish' : goldScore <= 30 ? 'bullish' : 'neutral') as 'bearish' | 'neutral' | 'bullish',
      description: 'Elevated gold signals flight to safety and systemic or geopolitical risk appetite',
      ticker: 'GC=F',
    },
    {
      id: 'spx',
      name: 'S&P 500 Daily Momentum',
      category: 'market' as const,
      value: spxScore,
      rawValue: spxChg,
      rawDisplay: `${spxChg > 0 ? '+' : ''}${spxChg.toFixed(2)}%`,
      delta: parseFloat(spxChg.toFixed(2)),
      weight: 0.08,
      direction: (spxScore >= 55 ? 'bearish' : spxScore <= 30 ? 'bullish' : 'neutral') as 'bearish' | 'neutral' | 'bullish',
      description: 'S&P 500 intraday return — negative days signal deteriorating broad market risk appetite',
      ticker: '^GSPC',
    },
  ];

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const score = Math.round(
    factors.reduce((s, f) => s + (f.value * f.weight) / totalWeight, 0),
  );

  const level =
    score >= 80 ? 'CRITICAL' :
    score >= 60 ? 'HIGH' :
    score >= 40 ? 'MEDIUM' : 'LOW';

  const hotFactors = factors
    .filter(f => f.direction === 'bearish' && f.value > 55)
    .map(f => `${f.name} elevated at ${Math.round(f.value)}/100 (${f.rawDisplay})`);

  const cascadingRisks = hotFactors.length
    ? hotFactors
    : ['No material cascading risks at current thresholds'];

  const recommendations =
    score >= 80
      ? ['Immediately reduce risk-on exposure', 'Hedge tail risk with options or inverse ETFs', 'Raise cash buffer above 25%']
      : score >= 60
      ? ['Trim high-beta positions', 'Review stop-loss levels closely', 'Diversify across uncorrelated assets']
      : score >= 40
      ? ['Maintain allocation, monitor macro developments', 'Consider mild defensive rotation on deterioration']
      : ['Conditions favour risk-on positioning', 'Look for growth exposure on dips'];

  return { factors, score, level, cascadingRisks, recommendations };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  try {
    let session = await getValidSession();
    let quotes: YahooQuote[];

    try {
      quotes = await fetchQuotes(session.cookie, session.crumb);
    } catch (e) {
      if ((e as Error).message === 'SESSION_EXPIRED') {
        // Invalidate cache and retry once with a fresh session
        sessionCache = null;
        session = await getValidSession();
        quotes = await fetchQuotes(session.cookie, session.crumb);
      } else {
        throw e;
      }
    }

    const result = buildRiskFactors(quotes);

    return NextResponse.json({
      success: true,
      ...result,
      fetchedAt: Date.now(),
      source: 'Yahoo Finance (public endpoints)',
    });
  } catch (err) {
    console.error('[risk-data]', err);
    // Invalidate session on any error so next request tries fresh
    sessionCache = null;

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch data',
      },
      { status: 502 },
    );
  }
}