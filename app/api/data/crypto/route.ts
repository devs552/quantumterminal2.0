import { NextRequest, NextResponse } from 'next/server';
import { generateCryptoData } from '@/lib/mock-data-generator';
import { coinGeckoAPI, transformCoinGeckoToCrypto } from '@/lib/external-apis';

/**
 * GET /api/data/crypto
 * Returns real-time crypto market data from CoinGecko with fallback to mock
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const useRealData  = searchParams.get('real') !== 'false';
    const detailed     = searchParams.get('detailed') === 'true';
    const sort         = searchParams.get('sort') ?? 'dominance'; // 'dominance' | 'change'

    if (useRealData) {
      const realData = await fetchRealCryptoData();
      if (realData && realData.length > 0) {
        // Sort server-side too
        const sorted = [...realData].sort((a, b) =>
          sort === 'change'
            ? (b.change24h ?? 0) - (a.change24h ?? 0)
            : (b.marketCap ?? 0) - (a.marketCap ?? 0)
        );

        // Compute summary
        const totalMarketCap = sorted.reduce((s, c) => s + (c.marketCap ?? 0), 0);
        const btc = sorted.find(c => c.symbol?.toUpperCase() === 'BTC');
        const btcDominance = totalMarketCap > 0 && btc?.marketCap
          ? (btc.marketCap / totalMarketCap) * 100
          : 0;

        return NextResponse.json(
          {
            success: true,
            data: {
              cryptos: sorted,
              timestamp: new Date().toISOString(),
              source: 'coingecko',
              detailed,
            },
            summary: {
              totalMarketCap,
              btcDominance,
              top3Change: sorted.slice(0, 3).map(c => c.change24h ?? 0),
            },
            timestamp: new Date().toISOString(),
          },
          { headers: { 'Cache-Control': 'public, max-age=30' } }
        );
      }
    }

    // ── Fallback: mock data ──────────────────────────────────────────────────
    const mockCryptos = generateCryptoData();

    const totalMarketCap = mockCryptos.reduce((s: number, c: any) => s + (c.marketCap ?? 0), 0);
    const btc = mockCryptos.find((c: any) => c.symbol?.toUpperCase() === 'BTC');
    const btcDominance = totalMarketCap > 0 && btc?.marketCap
      ? (btc.marketCap / totalMarketCap) * 100
      : btc?.dominance ?? 0;

    return NextResponse.json(
      {
        success: true,
        data: {
          cryptos: mockCryptos,
          timestamp: new Date().toISOString(),
          source: 'mock',
          detailed,
        },
        summary: {
          totalMarketCap,
          btcDominance,
          top3Change: mockCryptos.slice(0, 3).map((c: any) => c.change24h ?? 0),
        },
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'public, max-age=30' } }
    );
  } catch (error) {
    console.error('[Crypto API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch crypto data',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch from CoinGecko — free tier, no API key needed
 */
async function fetchRealCryptoData() {
  try {
    const data = await coinGeckoAPI.getMarketData('market_cap_desc', 100);
    if (!data || data.length === 0) return null;
    return transformCoinGeckoToCrypto(data);
  } catch (error) {
    console.warn('[Crypto API] CoinGecko fetch failed, falling back to mock:', error);
    return null;
  }
}

/**
 * POST /api/data/crypto  — watchlist filter
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbols } = body;

    if (!Array.isArray(symbols)) {
      return NextResponse.json(
        { success: false, error: 'symbols must be an array', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const upper = symbols.map((s: string) => s.toUpperCase());

    // Try real data first, filter to requested symbols
    const realData = await fetchRealCryptoData();
    const source   = realData ? 'coingecko' : 'mock';
    const allData  = realData ?? generateCryptoData();
    const filtered = allData.filter((c: any) => upper.includes(c.symbol?.toUpperCase()));

    return NextResponse.json(
      {
        success: true,
        data: {
          cryptos: filtered,
          watchlist: symbols,
          source,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-cache' } }
    );
  } catch (error) {
    console.error('[Crypto API POST] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}