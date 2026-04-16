import { NextResponse } from "next/server";

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
// HELPERS
// ─────────────────────────────────────────────

// ✅ Convert to YYYY-MM-DD (NO ISO TIME)
function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
}

// ✅ Moving Average (NO NULLS)
function movingAverage(arr: number[], period: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < arr.length; i++) {
    if (i < period) {
      result.push(arr[i]); // fallback
    } else {
      const slice = arr.slice(i - period, i);
      const avg = slice.reduce((a, b) => a + b, 0) / period;
      result.push(avg);
    }
  }

  return result;
}

// ✅ Puell (safe)
function calcPuell(prices: number[]): number[] {
  const ma365 = movingAverage(prices, 365);
  return prices.map((p, i) => p / (ma365[i] || p));
}

// ✅ Rainbow Bands
function buildRainbow(prices: number[]): RainbowBand[] {
  const bands = [
    { name: "Fire Sale", color: "rgba(34,197,94,0.6)", mul: 0.5 },
    { name: "Buy", color: "rgba(132,204,22,0.6)", mul: 0.7 },
    { name: "Accumulate", color: "rgba(234,179,8,0.6)", mul: 1 },
    { name: "HODL", color: "rgba(249,115,22,0.6)", mul: 1.5 },
    { name: "Sell", color: "rgba(239,68,68,0.6)", mul: 2 },
  ];

  return bands.map((b) => ({
    name: b.name,
    color: b.color,
    values: prices.map((p) => p * b.mul),
  }));
}

// ─────────────────────────────────────────────
// API
// ─────────────────────────────────────────────
export async function GET() {
  try {
    const res = await fetch(
      "https://api.coincap.io/v2/assets/bitcoin/history?interval=d1"
    );

    const json = await res.json();
    const raw = json.data;

    const prices: number[] = raw.map((d: any) => Number(d.priceUsd));

    // ✅ FIXED DATE FORMAT
    const dates: string[] = raw.map((d: any) =>
      formatDate(new Date(d.time))
    );

    // Indicators
    const dma111 = movingAverage(prices, 111);
    const dma350 = movingAverage(prices, 350);
    const dma350x2 = dma350.map((v) => v * 2);

    const puell = calcPuell(prices);

    const last = prices.length - 1;

    // ✅ SAFE VALUES (NO UNDEFINED)
    const currentPrice = prices[last] || 0;
    const current111DMA = dma111[last] || currentPrice;
    const current350DMAx2 = dma350x2[last] || currentPrice;
    const currentPuell = puell[last] || 1;

    const piCycleCrossed = current111DMA > current350DMAx2;

    // Rainbow
    const rainbow = buildRainbow(prices);

    // Indicators table
    const indicators: Indicator[] = [
      {
        id: 1,
        name: "Puell Multiple",
        current: currentPuell.toFixed(2),
        change24h: 0,
        reference: "<0.5 undervalued / >2 overvalued",
        triggered: currentPuell > 2,
      },
      {
        id: 2,
        name: "Pi Cycle",
        current: piCycleCrossed ? "Crossed" : "No Cross",
        change24h: 0,
        reference: "111DMA > 350DMAx2",
        triggered: piCycleCrossed,
      },
    ];

    const hitCount = indicators.filter((i) => i.triggered).length;
    const totalCount = indicators.length;
    const pct = ((hitCount / totalCount) * 100).toFixed(0);

    return NextResponse.json({
      success: true,

      currentPrice,
      currentPuell,
      current111DMA,
      current350DMAx2,

      piCycleCrossed,
      piCycleCrossDate: dates[last],

      rainbowBandIdx: 0,
      rainbowBandName: "Neutral",

      hitCount,
      totalCount,
      pct,

      halvings: [
        { date: "2012-11-28", label: "Halving 1" },
        { date: "2016-07-09", label: "Halving 2" },
        { date: "2020-05-11", label: "Halving 3" },
        { date: "2024-04-20", label: "Halving 4" },
      ],

      chart: {
        dates,
        prices,
        puell,
        dma111,
        dma350x2,
        rainbow,
      },

      indicators,

      source: "CoinCap FREE",
      updatedAt: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
    });
  }
}