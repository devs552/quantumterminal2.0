/**
 * app/api/liquidations/route.ts
 * Free liquidations data — approximated from CoinGecko open interest + derivatives data
 * No API key required.
 *
 * Query params:
 *   type=summary|table|history   (default: summary)
 *   days=1|7|30                  (default: 30, for history)
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

const FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; liquidations-bot/1.0)',
};

async function cgFetch(url: string) {
  const res = await fetch(url, { headers: FETCH_HEADERS, next: { revalidate: 300 } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`CoinGecko ${res.status}: ${body.slice(0, 120)}`);
  }
  return res.json();
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

// Top coins to show liquidation data for
const LIQD_COIN_IDS = [
  'bitcoin', 'ethereum', 'solana', 'hyperliquid', 'ripple',
  'binancecoin', 'dogecoin', 'cardano', 'avalanche-2', 'near',
  'chainlink', 'polkadot', 'sui', 'aptos', 'arbitrum',
];

interface CgCoin {
  id: string; name: string; symbol: string; image: string;
  current_price: number; market_cap: number;
  price_change_percentage_24h: number;
  total_volume: number;
}

// Derive estimated liquidations from 24h volume + price change
// (No free real-time liquidations API exists; we approximate from derivatives volume)
function estimateLiquidations(coin: CgCoin) {
  const vol      = coin.total_volume ?? 0;
  const chg      = coin.price_change_percentage_24h ?? 0;

  // Liq ≈ 2–8% of daily volume depending on volatility
  const liqFactor = Math.min(0.08, Math.abs(chg) * 0.004 + 0.02);
  const total  = vol * liqFactor;
  // Long liq rises when price drops; short liq rises when price pumps
  const longRatio  = chg >= 0 ? 0.35 : 0.65;
  const shortRatio = 1 - longRatio;

  return {
    long:  total * longRatio,
    short: total * shortRatio,
    total,
  };
}

// Open interest ~ 15-25% of market cap for major coins
function estimateOpenInterest(coin: CgCoin) {
  const oiRatio = 0.05 + Math.random() * 0.10; // 5-15% of mcap
  return (coin.market_cap ?? 0) * oiRatio;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'summary';
  const days = parseInt(searchParams.get('days') || '30');

  try {
    if (type === 'history') {
      // Historical chart: BTC price + synthetic liq bars from BTC price history
      const btcHist = await cgFetch(
        `${CG}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`
      ) as { prices: [number, number][]; total_volumes: [number, number][] };

      const prices  = btcHist.prices ?? [];
      const volumes = btcHist.total_volumes ?? [];
      const len     = Math.min(prices.length, volumes.length);

      const history = Array.from({ length: len }, (_, i) => {
        const ts    = prices[i][0];
        const price = prices[i][1];
        const vol   = volumes[i][1];
        // Simulate daily liq: vol * random factor, seeded by index for reproducibility
        const seed  = (i * 7 + 13) % 100 / 100;
        const total = vol * (0.015 + seed * 0.03);
        const longPct  = 0.3 + seed * 0.4;
        return {
          timestamp: ts,
          date: new Date(ts).toISOString().split('T')[0],
          btcPrice: price,
          longLiq:  total * longPct,
          shortLiq: total * (1 - longPct),
          total,
        };
      });

      return json({ success: true, days, count: history.length, history });
    }

    // Live coin data
    const coins: CgCoin[] = await cgFetch(
      `${CG}/coins/markets?vs_currency=usd&ids=${LIQD_COIN_IDS.join(',')}&order=market_cap_desc` +
      `&per_page=20&sparkline=false&price_change_percentage=24h`
    );

    const rows = coins.map((c, i) => {
      const liq = estimateLiquidations(c);
      const oi  = estimateOpenInterest(c);
      return {
        rank: i + 1,
        id:   c.id,
        name: c.name,
        symbol: c.symbol.toUpperCase(),
        image:  c.image,
        price:  c.current_price,
        change24h: c.price_change_percentage_24h ?? 0,
        marketCap: c.market_cap ?? 0,
        openInterest: oi,
        longLiq:  liq.long,
        shortLiq: liq.short,
        totalLiq: liq.total,
      };
    });

    const totalLong  = rows.reduce((s, r) => s + r.longLiq,  0);
    const totalShort = rows.reduce((s, r) => s + r.shortLiq, 0);
    const total24h   = totalLong + totalShort;

    // Top historical events (static — no free API provides this)
    const topEvents = [
      { date: '2025-10-10', amount: 19_160_000_000, headline: 'Trump threatens 100% tariffs on China', coin: 'BTC' },
      { date: '2021-04-18', amount:  9_940_000_000, headline: 'Rumors of AML crackdowns and mining …', coin: 'BTC' },
      { date: '2021-05-19', amount:  9_010_000_000, headline: "Tesla's reversal on BTC payments and C…", coin: 'BTC' },
      { date: '2022-06-13', amount:  7_220_000_000, headline: 'Three Arrows Capital contagion fears',   coin: 'ETH' },
      { date: '2024-08-05', amount:  6_800_000_000, headline: 'Japan rate hike global unwind',          coin: 'BTC' },
    ];

    if (type === 'table') {
      return json({ success: true, rows, updatedAt: new Date().toISOString() });
    }

    // summary (default)
    return json({
      success: true,
      summary: { total24h, totalLong, totalShort },
      rows,
      topEvents,
      source: 'CoinGecko public API (liquidations estimated from volume + volatility)',
      updatedAt: new Date().toISOString(),
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('liquidations route error:', msg);
    return json({ success: false, error: msg }, 500);
  }
}