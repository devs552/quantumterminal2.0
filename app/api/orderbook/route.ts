import { NextRequest, NextResponse } from 'next/server';
import { createExchangeConnector } from '@/services/exchangeConnector';
import { ExchangeConfig } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const exchange = searchParams.get('exchange') || 'binance';
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const depth = parseInt(searchParams.get('depth') || '20', 10);

    const config: ExchangeConfig = {
      name: exchange as any,
      testnet: searchParams.get('testnet') === 'true',
    };

    const connector = createExchangeConnector(config);
    await connector.connect();

    const orderbook = await connector.getOrderBook(symbol, depth);

    connector.disconnect();

    return NextResponse.json({
      success: true,
      data: orderbook,
      exchange,
      symbol,
      depth,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('OrderBook API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch orderbook',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orderbook
 * 
 * Query Parameters:
 * - exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx' (default: 'binance')
 * - symbol: Trading pair (default: 'BTCUSDT')
 * - depth: Orderbook depth, typically 5, 10, 20, 50, 100 (default: 20)
 * - testnet: Set to 'true' to use testnet
 * 
 * Example:
 * GET /api/orderbook?exchange=binance&symbol=BTCUSDT&depth=50
 */
