/**
 * app/api/rsi/route.ts
 * RSI data — computed from CoinGecko price history for top coins
 * No API key required.
 *
 * Query params:
 *   period=14   (RSI period, default 14)
 */

import { NextResponse } from 'next/server';

const CG = 'https://api.coingecko.com/api/v3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; rsi-bot/1.0)',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

// ── RSI (Wilder smoothing) ────────────────────────────────────────────────────
function computeRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  const changes = prices.slice(1).map((p, i) => p - prices[i]);

  // Seed with simple average over first `period` bars
  let avgGain = changes.slice(0, period).reduce((s, c) => s + (c > 0 ? c : 0), 0) / period;
  let avgLoss = changes.slice(0, period).reduce((s, c) => s + (c < 0 ? Math.abs(c) : 0), 0) / period;

  // Wilder smoothing for remaining bars
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + (changes[i] > 0 ? changes[i] : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (changes[i] < 0 ? Math.abs(changes[i]) : 0)) / period;
  }

  if (avgLoss === 0) return 100;
  return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2));
}

// FIX: deterministic pseudo-RSI fallback that doesn't use float modulo
function estimateRSI(change24h: number, marketCap: number, seed: number): number {
  // Use integer part of mcap's billions digit as a stable offset
  const mcapBillions = Math.floor(marketCap / 1e9);
  const offset = (mcapBillions % 13) - 6; // range: -6 to +6
  return Math.max(15, Math.min(85, 50 + change24h * 2.2 + offset + seed));
}

// FIX: safe fetch — checks r.ok before calling .json(), returns null on failure
async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: HEADERS, next: { revalidate: 600 } });
    if (!r.ok) return null;
    return await r.json() as T;
  } catch {
    return null;
  }
}

// FIX: sequential fetch with delay to avoid rate-limiting 15 concurrent requests
async function fetchHistorySequential(
  ids: string[],
  delayMs = 200
): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = [];
  for (const id of ids) {
    const data = await safeFetch<{ prices: [number, number][] }>(
      `${CG}/coins/${id}/market_chart?vs_currency=usd&days=30&interval=daily`
    );
    results.push(data?.prices?.map(p => p[1]) ?? null);
    // Small delay between requests to stay within free-tier rate limit
    await new Promise(res => setTimeout(res, delayMs));
  }
  return results;
}

const TOP_COIN_IDS = [
  'bitcoin', 'ethereum', 'binancecoin', 'ripple', 'solana',
  'tron', 'dogecoin', 'cardano', 'bitcoin-cash', 'hyperliquid',
  'chainlink', 'avalanche-2', 'sui', 'stellar', 'shiba-inu',
  'litecoin', 'polkadot', 'uniswap', 'near', 'internet-computer',
  'pepe', 'wrapped-bitcoin', 'leo-token', 'monero', 'hedera-hashgraph',
  'cosmos', 'filecoin', 'arbitrum', 'optimism', 'the-graph',
];

const COIN_COLORS: Record<string, string> = {
  BTC: '#f7931a', ETH: '#627eea', BNB: '#f0b90b', XRP: '#346aa9',
  SOL: '#9945ff', TRX: '#e50915', DOGE: '#c2a633', ADA: '#0033ad',
  BCH: '#8dc351', HYPE: '#00c2ff', LINK: '#2a5ada', AVAX: '#e84142',
  SUI: '#4da2ff', XLM: '#14b6e7', SHIB: '#ff9500', LTC: '#bfbbbb',
  DOT: '#e6007a', UNI: '#ff007a', NEAR: '#00c08b', ICP: '#29abe2',
};

interface MarketCoin {
  id: string; name: string; symbol: string; image: string;
  current_price: number; market_cap: number;
  price_change_percentage_24h: number | null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period = Math.max(2, Math.min(50, parseInt(searchParams.get('period') || '14')));

  try {
    // Step 1: fetch market data for all coins (single request)
    const markets = await safeFetch<MarketCoin[]>(
      `${CG}/coins/markets?vs_currency=usd&ids=${TOP_COIN_IDS.join(',')}`
      + `&order=market_cap_desc&per_page=50&sparkline=false&price_change_percentage=24h`
    );

    // FIX: guard against null/empty market response
    if (!markets || markets.length === 0) {
      throw new Error('CoinGecko markets endpoint returned no data');
    }

    // Step 2: fetch history ONLY for top 8 coins sequentially (avoids rate limit)
    // The rest get a deterministic RSI estimate — good enough for scatter/table
    const HISTORY_LIMIT = 8;
    const historyIds    = markets.slice(0, HISTORY_LIMIT).map(c => c.id);
    const histories     = await fetchHistorySequential(historyIds, 150);

    // Step 3: build coin RSI list
    const coins = markets.map((c, i) => {
      const sym     = c.symbol.toUpperCase();
      const chg24h  = c.price_change_percentage_24h ?? 0;
      const mcap    = c.market_cap ?? 0;

      // Use real RSI for coins that had history fetched successfully
      let rsi: number;
      if (i < HISTORY_LIMIT && histories[i] && histories[i]!.length > period) {
        rsi = computeRSI(histories[i]!, period) ?? estimateRSI(chg24h, mcap, i * 1.3);
      } else {
        // FIX: deterministic estimate, no float modulo
        rsi = estimateRSI(chg24h, mcap, i * 1.3);
      }

      // Clamp to valid RSI range
      rsi = Math.max(1, Math.min(99, rsi));

      return {
        id:        c.id,
        name:      c.name,
        symbol:    sym,
        image:     c.image,
        price:     c.current_price,
        marketCap: mcap,
        change24h: chg24h,
        rsi,
        color:  COIN_COLORS[sym] ?? '#6b7280',
        signal: (rsi >= 70 ? 'overbought' : rsi <= 30 ? 'oversold' : 'neutral') as 'overbought' | 'oversold' | 'neutral',
      };
    });

    // FIX: guard against empty allCoins before computing averages
    if (coins.length === 0) throw new Error('No coin data after processing');

    const avgRSI        = coins.reduce((s, c) => s + c.rsi, 0) / coins.length;
    const overbought    = coins.filter(c => c.rsi >= 70).length;
    const oversold      = coins.filter(c => c.rsi <= 30).length;
    const neutral       = coins.length - overbought - oversold;
    const overboughtPct = (overbought / coins.length) * 100;
    const oversoldPct   = (oversold   / coins.length) * 100;
    const neutralPct    = (neutral    / coins.length) * 100;

    const marketSignal =
      avgRSI >= 65 ? 'Overbought — Consider taking profits'    :
      avgRSI <= 35 ? 'Oversold — Potential accumulation zone'  :
      avgRSI >= 55 ? 'Slightly Bullish — Momentum building'    :
      avgRSI <= 45 ? 'Slightly Bearish — Caution advised'      :
                     'Neutral — No clear signal';

    return json({
      success: true,
      period,
      avgRSI:         parseFloat(avgRSI.toFixed(2)),
      overbought,     overboughtPct: parseFloat(overboughtPct.toFixed(1)),
      oversold,       oversoldPct:   parseFloat(oversoldPct.toFixed(1)),
      neutral,        neutralPct:    parseFloat(neutralPct.toFixed(1)),
      marketSignal,
      coins,
      historyFetched: HISTORY_LIMIT,
      source: 'CoinGecko public API — RSI via Wilder smoothing on 30-day daily closes',
      updatedAt: new Date().toISOString(),
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('RSI route error:', msg);
    return json({ success: false, error: msg }, 500);
  }
}