import { NextRequest, NextResponse } from 'next/server';
import { generateCryptoData, getUpdatedCryptoData } from '@/lib/mockData';

export const revalidate = 15; // Cache for 15 seconds (shorter for crypto)

export async function GET(request: NextRequest) {
  try {
    let cryptoData = generateCryptoData();

    // Optional filters
    const minMarketCap = request.nextUrl.searchParams.get('minMarketCap');
    const sortBy = request.nextUrl.searchParams.get('sort') || 'dominance';

    // Apply sorting
    if (sortBy === 'change') {
      cryptoData.sort((a, b) => b.change24h - a.change24h);
    } else if (sortBy === 'dominance') {
      cryptoData.sort((a, b) => b.dominance - a.dominance);
    }

    return NextResponse.json({
      success: true,
      data: cryptoData,
      timestamp: Date.now(),
      summary: {
        totalMarketCap: cryptoData.reduce((sum, c) => sum + c.volume24h, 0),
        btcDominance: cryptoData.find((c) => c.symbol === 'BTC')?.dominance || 0,
        top3Change: cryptoData.slice(0, 3).map((c) => c.change24h),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch crypto data',
      },
      { status: 500 }
    );
  }
}
