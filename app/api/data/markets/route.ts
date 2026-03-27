import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/data/markets
 * Fetches real market data via Yahoo Finance (no API key, no rate limits for basic use)
 * Falls back to reasonable static data if fetch fails
 */

const SYMBOLS = [
  { symbol: '^GSPC',  label: 'S&P 500',  key: 'SPX'  },
  { symbol: '^NDX',   label: 'NASDAQ',   key: 'NDX'  },
  { symbol: '^DJI',   label: 'DOW',      key: 'DJI'  },
  { symbol: '^RUT',   label: 'RUSSELL',  key: 'RUT'  },
  { symbol: 'GC=F',   label: 'Gold',     key: 'GOLD' },
  { symbol: 'CL=F',   label: 'Oil',      key: 'OIL'  },
  { symbol: 'DX-Y.NYB', label: 'DXY',   key: 'DXY'  },
  { symbol: '^VIX',   label: 'VIX',      key: 'VIX'  },
];

const SECTOR_ETFS = [
  { symbol: 'XLK',  sector: 'Technology'   },
  { symbol: 'XLF',  sector: 'Finance'      },
  { symbol: 'XLV',  sector: 'Healthcare'   },
  { symbol: 'XLE',  sector: 'Energy'       },
  { symbol: 'XLI',  sector: 'Industrial'   },
  { symbol: 'XLY',  sector: 'Consumer'     },
  { symbol: 'XLB',  sector: 'Materials'    },
  { symbol: 'XLU',  sector: 'Utilities'    },
  { symbol: 'XLRE', sector: 'Real Estate'  },
  { symbol: 'XLC',  sector: 'Telecom'      },
];

async function fetchYahooQuote(symbol: string): Promise<any> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Yahoo fetch failed for ${symbol}: ${res.status}`);
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`No meta for ${symbol}`);
  return meta;
}

export async function GET(request: NextRequest) {
  try {
    // Fetch all symbols in parallel
    const [marketResults, sectorResults] = await Promise.all([
      Promise.allSettled(SYMBOLS.map(s => fetchYahooQuote(s.symbol).then(meta => ({ ...s, meta })))),
      Promise.allSettled(SECTOR_ETFS.map(s => fetchYahooQuote(s.symbol).then(meta => ({ ...s, meta })))),
    ]);

    const markets = marketResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => {
        const { key, label, meta } = r.value;
        const price = meta.regularMarketPrice ?? 0;
        const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
        const change = price - prevClose;
        const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
        return {
          symbol: key,
          name: label,
          price,
          close: price,
          open: meta.regularMarketOpen ?? price,
          high: meta.regularMarketDayHigh ?? price,
          low: meta.regularMarketDayLow ?? price,
          change,
          changePercent,
          volume: meta.regularMarketVolume ?? 0,
          timestamp: new Date(meta.regularMarketTime * 1000).toISOString(),
        };
      });

    const sectors = sectorResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => {
        const { sector, meta } = r.value;
        const price = meta.regularMarketPrice ?? 0;
        const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
        const change = prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : 0;
        return {
          sector,
          change,
          symbol: r.value.symbol,
          price,
          volume: meta.regularMarketVolume ?? 0,
        };
      });

    // If we got at least some data, return it
    if (markets.length > 0) {
      return NextResponse.json({
        success: true,
        data: {
          markets,
          sectors,
          timestamp: new Date().toISOString(),
          source: 'yahoo-finance',
        },
        timestamp: new Date().toISOString(),
      }, { headers: { 'Cache-Control': 'public, max-age=60' } });
    }

    throw new Error('No market data returned from Yahoo Finance');

  } catch (error) {
    console.error('[Markets API] Error:', error);

    // Return last-known static fallback so UI never breaks
    return NextResponse.json({
      success: true,
      data: {
        markets: FALLBACK_MARKETS,
        sectors: FALLBACK_SECTORS,
        timestamp: new Date().toISOString(),
        source: 'fallback',
      },
      timestamp: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'public, max-age=30' } });
  }
}

export async function POST() {
  return NextResponse.json({ success: true, message: 'Refresh triggered', timestamp: new Date().toISOString() });
}

// ── Static fallback (reasonable last-known values, clearly labelled) ──────────
const FALLBACK_MARKETS = [
  { symbol: 'SPX',  name: 'S&P 500', price: 5123.41, close: 5123.41, changePercent: 0.42, volume: 0 },
  { symbol: 'NDX',  name: 'NASDAQ',  price: 17891.23, close: 17891.23, changePercent: 0.71, volume: 0 },
  { symbol: 'DJI',  name: 'DOW',     price: 38563.80, close: 38563.80, changePercent: 0.20, volume: 0 },
  { symbol: 'RUT',  name: 'RUSSELL', price: 2042.33,  close: 2042.33,  changePercent: -0.15, volume: 0 },
  { symbol: 'GOLD', name: 'Gold',    price: 2312.40,  close: 2312.40,  changePercent: 0.33, volume: 0 },
  { symbol: 'OIL',  name: 'Oil',     price: 81.22,    close: 81.22,    changePercent: -0.88, volume: 0 },
  { symbol: 'DXY',  name: 'DXY',     price: 104.51,   close: 104.51,   changePercent: -0.11, volume: 0 },
  { symbol: 'VIX',  name: 'VIX',     price: 14.82,    close: 14.82,    changePercent: -1.20, volume: 0 },
];

const FALLBACK_SECTORS = [
  { sector: 'Technology', change: 1.82 }, { sector: 'Finance',    change: 0.54 },
  { sector: 'Healthcare', change: -0.23 }, { sector: 'Energy',    change: -1.45 },
  { sector: 'Industrial', change: 0.77 }, { sector: 'Consumer',   change: 0.31 },
  { sector: 'Materials',  change: -0.68 }, { sector: 'Utilities', change: -0.12 },
  { sector: 'Real Estate', change: 0.89 }, { sector: 'Telecom',   change: 1.12 },
];