import { NextResponse } from 'next/server';

export const revalidate = 3600; // Cache 1 hour — F&G updates daily

const FNG_API   = 'https://api.alternative.me/fng/?limit=365&format=json';
const PRICE_API = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily';

interface FngEntry {
  value: string;
  value_classification: string;
  timestamp: string;
}

function classify(v: number): string {
  if (v <= 20) return 'Extreme Fear';
  if (v <= 40) return 'Fear';
  if (v <= 60) return 'Neutral';
  if (v <= 80) return 'Greed';
  return 'Extreme Greed';
}

export async function GET() {
  try {
    const [fngRes, priceRes] = await Promise.allSettled([
      fetch(FNG_API,   { next: { revalidate: 3600 } }),
      fetch(PRICE_API, { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } }),
    ]);

    // ── Fear & Greed data ──────────────────────────────────────────────────
    if (fngRes.status === 'rejected' || !fngRes.value.ok) {
      throw new Error('Failed to fetch Fear & Greed data');
    }
    const fngJson = await fngRes.value.json();
    const rawEntries: FngEntry[] = fngJson.data ?? [];

    // API returns newest-first → reverse to oldest-first for chart
    const fngEntries = [...rawEntries].reverse().map(e => ({
      date: new Date(parseInt(e.timestamp) * 1000).toISOString().split('T')[0],
      value: parseInt(e.value),
      label: e.value_classification,
    }));

    const current   = fngEntries[fngEntries.length - 1];
    const yesterday = fngEntries[fngEntries.length - 2] ?? current;
    const lastWeek  = fngEntries[fngEntries.length - 8] ?? fngEntries[0];
    const lastMonth = fngEntries[fngEntries.length - 31] ?? fngEntries[0];

    // Yearly high / low
    let highEntry = fngEntries[0];
    let lowEntry  = fngEntries[0];
    for (const e of fngEntries) {
      if (e.value > highEntry.value) highEntry = e;
      if (e.value < lowEntry.value)  lowEntry  = e;
    }

    // ── Bitcoin price history ──────────────────────────────────────────────
    let priceMap: Record<string, { price: number; volume: number }> = {};
    if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
      const priceJson = await priceRes.value.json();
      const prices:  [number, number][] = priceJson.prices  ?? [];
      const volumes: [number, number][] = priceJson.total_volumes ?? [];

      // Build date → price map
      for (const [ts, price] of prices) {
        const date = new Date(ts).toISOString().split('T')[0];
        priceMap[date] = { price, volume: 0 };
      }
      for (const [ts, vol] of volumes) {
        const date = new Date(ts).toISOString().split('T')[0];
        if (priceMap[date]) priceMap[date].volume = vol;
      }
    }

    // ── Merge chart data ───────────────────────────────────────────────────
    const chart = fngEntries.map(e => ({
      date:   e.date,
      fng:    e.value,
      label:  e.label,
      price:  priceMap[e.date]?.price  ?? null,
      volume: priceMap[e.date]?.volume ?? null,
    }));

    return NextResponse.json({
      success: true,
      current: {
        value:    current.value,
        label:    current.label,
        date:     current.date,
      },
      historical: {
        yesterday: { value: yesterday.value, label: yesterday.label },
        lastWeek:  { value: lastWeek.value,  label: lastWeek.label  },
        lastMonth: { value: lastMonth.value, label: lastMonth.label },
      },
      yearly: {
        high: { value: highEntry.value, label: highEntry.label, date: highEntry.date },
        low:  { value: lowEntry.value,  label: lowEntry.label,  date: lowEntry.date  },
      },
      chart,
      source: 'Alternative.me + CoinGecko',
      updatedAt: Date.now(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('fear-greed route error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}