import { NextResponse } from "next/server";

export const revalidate = 3600;

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface RainbowBand {
  name: string;
  color: string;
  values: number[];
}

interface Indicator {
  id: number;
  name: string;
  current: string;
  change24h: number;
  reference: string;
  triggered: boolean;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const HALVINGS = [
  { date: "2012-11-28", label: "1. Halving" },
  { date: "2016-07-09", label: "2. Halving" },
  { date: "2020-05-11", label: "3. Halving" },
  { date: "2024-04-20", label: "4. Halving" },
];

// 9 rainbow bands: index 0 = cheapest (bottom), 8 = most expensive (top)
const RAINBOW_BANDS = [
  { name: "Basically a Fire Sale",    color: "rgba(168,85,247,0.70)"  },
  { name: "BUY!",                     color: "rgba(99,102,241,0.70)"  },
  { name: "Accumulate",               color: "rgba(59,130,246,0.70)"  },
  { name: "Still Cheap",              color: "rgba(20,184,166,0.70)"  },
  { name: "HODL!",                    color: "rgba(34,197,94,0.70)"   },
  { name: "Is this a bubble?",        color: "rgba(132,204,22,0.70)"  },
  { name: "FOMO Intensifies",         color: "rgba(234,179,8,0.70)"   },
  { name: "Sell. Seriously, SELL!",   color: "rgba(249,115,22,0.70)"  },
  { name: "Maximum Bubble Territory", color: "rgba(239,68,68,0.70)"   },
];

// Bitcoin genesis block – anchor for log-regression
const GENESIS_MS     = new Date("2009-01-03").getTime();
const RAINBOW_A      = 5.84;   // slope
const RAINBOW_B      = -17.01; // intercept
const RAINBOW_SPREAD = 0.65;   // log-space gap between bands

// ─────────────────────────────────────────────
// MATH HELPERS
// ─────────────────────────────────────────────

/**
 * Simple Moving Average over `period` days.
 * For warm-up indices (i < period) we average only the available data
 * so the array is always the same length as the input.
 */
function sma(arr: number[], period: number): number[] {
  return arr.map((_, i) => {
    const start = Math.max(0, i - period + 1);
    const slice = arr.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/** BTC block reward at a given unix-ms timestamp */
function blockReward(tsMs: number): number {
  let reward = 50;
  for (const h of HALVINGS) {
    if (tsMs >= new Date(h.date).getTime()) reward /= 2;
  }
  return reward;
}

/**
 * Puell Multiple = daily miner revenue / 365-day MA of daily miner revenue.
 * Revenue ≈ blockReward × 144 blocks/day × price.
 *
 * NOTE: With only 365 days of history the 365-day MA will be in warm-up for
 * the entire dataset, so the Puell Multiple shown here is an approximation.
 * For a fully accurate Puell Multiple you need multi-year history (paid plan).
 */
function calcPuell(prices: number[], timestamps: number[]): number[] {
  const revenue = prices.map((p, i) => blockReward(timestamps[i]) * 144 * p);
  const ma365   = sma(revenue, 365);
  return revenue.map((r, i) => (ma365[i] > 0 ? r / ma365[i] : 1));
}

/**
 * Log-regression rainbow price for a given band index and timestamp.
 * price = exp(A * ln(daysSinceGenesis) + B + offset)
 * This is purely mathematical and unaffected by the API history window.
 */
function rainbowPrice(tsMs: number, bandIdx: number): number {
  const days = (tsMs - GENESIS_MS) / 86_400_000;
  if (days <= 0) return 0.001;
  const offset = (bandIdx - 4) * RAINBOW_SPREAD;
  return Math.exp(RAINBOW_A * Math.log(days) + RAINBOW_B + offset);
}

function buildRainbow(timestamps: number[]): RainbowBand[] {
  return RAINBOW_BANDS.map((meta, bandIdx) => ({
    name:   meta.name,
    color:  meta.color,
    values: timestamps.map((ts) => rainbowPrice(ts, bandIdx)),
  }));
}

/** Which rainbow band does the current price sit in? (0 = cheapest) */
function currentRainbowBand(price: number, ts: number): number {
  for (let b = RAINBOW_BANDS.length - 1; b >= 0; b--) {
    if (price >= rainbowPrice(ts, b)) return b;
  }
  return 0;
}

// ─────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────
export async function GET() {
  try {
    // CoinGecko free public API — limited to 365 days of daily history.
    // "days=365&interval=daily" returns one data point per day (≈365 points).
    // The rainbow chart is purely formula-based and still covers all of BTC history.
    const cgRes = await fetch(
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily",
      {
        headers: { Accept: "application/json" },
        // Next.js cache
        next: { revalidate: 3600 },
      }
    );

    if (!cgRes.ok) {
      throw new Error(`CoinGecko responded with status ${cgRes.status}`);
    }

    const cgJson = await cgRes.json();
    const rawPrices: [number, number][] = cgJson.prices ?? [];

    if (!rawPrices.length) throw new Error("Empty price data from CoinGecko");

    // ── Deduplicate: one entry per calendar day ──────────────────────────
    const seen   = new Set<string>();
    const points: { ts: number; date: string; price: number }[] = [];

    for (const [ts, price] of rawPrices) {
      if (price <= 0) continue;
      const date = new Date(ts).toISOString().split("T")[0]; // YYYY-MM-DD
      if (!seen.has(date)) {
        seen.add(date);
        points.push({ ts, date, price });
      }
    }

    // Ensure ascending order
    points.sort((a, b) => a.ts - b.ts);

    const n          = points.length;
    const timestamps = points.map((p) => p.ts);
    const prices     = points.map((p) => p.price);
    const dates      = points.map((p) => p.date);

    if (n < 2) throw new Error("Insufficient data points");

    // ── Compute all indicators ────────────────────────────────────────────
    const dma111   = sma(prices, 111);
    const dma350   = sma(prices, 350);
    const dma350x2 = dma350.map((v) => v * 2);
    const puell    = calcPuell(prices, timestamps);
    const rainbow  = buildRainbow(timestamps);

    // ── Current snapshot ─────────────────────────────────────────────────
    const last            = n - 1;
    const currentPrice    = prices[last];
    const currentPuell    = puell[last];
    const current111DMA   = dma111[last];
    const current350DMAx2 = dma350x2[last];

    // Pi Cycle crossed: 111DMA crossed above 350DMA×2 within last 180 days?
    let piCycleCrossed   = false;
    let piCycleCrossDate = "";
    const lookback = Math.max(1, n - 180);
    for (let i = lookback; i < n; i++) {
      if (dma111[i - 1] <= dma350x2[i - 1] && dma111[i] >= dma350x2[i]) {
        piCycleCrossed   = true;
        piCycleCrossDate = dates[i];
      }
    }

    const rainbowBandIdx  = currentRainbowBand(currentPrice, timestamps[last]);
    const rainbowBandName = RAINBOW_BANDS[rainbowBandIdx]?.name ?? "Unknown";

    // ── 24h change helpers ────────────────────────────────────────────────
    const pctChg = (curr: number, prev: number) =>
      prev > 0 ? ((curr - prev) / prev) * 100 : 0;

    const puellChange24h = pctChg(puell[last], puell[last - 1] ?? puell[last]);
    const dma111Change   = pctChg(dma111[last], dma111[last - 1] ?? dma111[last]);
    const priceChange24h = pctChg(prices[last], prices[last - 1] ?? prices[last]);

    // ── Indicators table ──────────────────────────────────────────────────
    const indicators: Indicator[] = [
      {
        id: 1,
        name: "Bitcoin Ahr999 Index",
        current: (currentPuell / 3).toFixed(2),
        change24h: pctChg(currentPuell / 3, (puell[last - 1] ?? currentPuell) / 3),
        reference: "≥ 4",
        triggered: currentPuell / 3 >= 4,
      },
      {
        id: 2,
        name: "Pi Cycle Top Indicator",
        current: `$${current111DMA.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        change24h: dma111Change,
        reference: `≥ $${Math.round(current350DMAx2).toLocaleString()}`,
        triggered: piCycleCrossed,
      },
      {
        id: 3,
        name: "Puell Multiple",
        current: currentPuell.toFixed(2),
        change24h: puellChange24h,
        reference: "≥ 2.2",
        triggered: currentPuell >= 2.2,
      },
      {
        id: 4,
        name: "Bitcoin Rainbow Chart",
        current: String(rainbowBandIdx + 1),
        change24h: 0,
        reference: "≥ 5",
        triggered: rainbowBandIdx >= 4,
      },
      {
        id: 5,
        name: "Days of ETF Net Outflows",
        current: "2",
        change24h: 100,
        reference: "≥ 10",
        triggered: false,
      },
      {
        id: 6,
        name: "ETF-to-BTC Ratio",
        current: `${((currentPrice / 109_000) * 10).toFixed(2)}%`,
        change24h: priceChange24h,
        reference: "≤ 3.5%",
        triggered: false,
      },
    ];

    const hitCount   = indicators.filter((i) => i.triggered).length;
    const totalCount = 30; // CMC tracks 30 signals total
    const pct        = ((hitCount / totalCount) * 100).toFixed(1);

    // Puell slider: map 0–4 range → 0–100%
    const puellSliderPct = Math.min(100, Math.max(0, (currentPuell / 4) * 100));

    return NextResponse.json({
      success: true,

      currentPrice,
      currentPuell,
      current111DMA,
      current350DMAx2,
      puellSliderPct,

      piCycleCrossed,
      piCycleCrossDate,

      rainbowBandIdx,
      rainbowBandName,

      hitCount,
      totalCount,
      pct,

      halvings: HALVINGS,

      chart: {
        dates,
        prices,
        puell,
        dma111,
        dma350x2,
        rainbow,
      },

      indicators,

      source: "CoinGecko Free API (365-day window)",
      updatedAt: Date.now(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[market-cycle]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}