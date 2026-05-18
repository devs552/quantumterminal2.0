import { createExchangeConnector } from '@/services/exchangeConnector';
import { ExchangeConfig } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const exchange = searchParams.get('exchange') || 'binance';
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const interval = searchParams.get('interval') || '1h';
    const limit = parseInt(searchParams.get('limit') || '500', 10);

    const config: ExchangeConfig = {
      name: exchange as any,
      testnet: searchParams.get('testnet') === 'true',
    };

    const connector = createExchangeConnector(config);
    await connector.connect();

    const klines = await connector.getKlines(symbol, interval, limit);

    connector.disconnect();

    return NextResponse.json({
      success: true,
      data: klines,
      exchange,
      symbol,
      interval,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Klines API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch klines',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/klines
 * 
 * Query Parameters:
 * - exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx' (default: 'binance')
 * - symbol: Trading pair (default: 'BTCUSDT')
 * - interval: Kline interval like '1m', '5m', '1h', '1d' (default: '1h')
 * - limit: Number of klines to fetch (default: 500)
 * - testnet: Set to 'true' to use testnet
 * 
 * Example:
 * GET /api/klines?exchange=binance&symbol=BTCUSDT&interval=15m&limit=288
 */
