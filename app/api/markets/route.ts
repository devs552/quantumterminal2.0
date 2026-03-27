import { NextRequest, NextResponse } from 'next/server';
import { generateMarketData, getUpdatedMarketData } from '@/lib/mockData';

export const revalidate = 30; // Cache for 30 seconds

export async function GET(request: NextRequest) {
  try {
    // Get market data
    let marketData = generateMarketData();

    // Apply optional query parameters
    const symbol = request.nextUrl.searchParams.get('symbol');
    if (symbol) {
      marketData = marketData.filter((m) => m.symbol.includes(symbol.toUpperCase()));
    }

    // Get change preference
    const includeHistory = request.nextUrl.searchParams.get('history') === 'true';

    return NextResponse.json({
      success: true,
      data: marketData,
      timestamp: Date.now(),
      cacheAge: 0,
      ...(includeHistory && {
        history: {
          '1h': getUpdatedMarketData(marketData),
          '24h': getUpdatedMarketData(marketData),
        },
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch market data',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Save user's market preferences, watchlist, etc.
    // This would integrate with the database

    return NextResponse.json({
      success: true,
      message: 'Market preferences saved',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save market preferences',
      },
      { status: 400 }
    );
  }
}
