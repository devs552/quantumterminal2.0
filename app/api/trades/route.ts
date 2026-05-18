import { NextRequest, NextResponse } from 'next/server';
import { createExchangeConnector } from '@/services/exchangeConnector';
import { ExchangeConfig, TradeHistoryConfig } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const exchange = searchParams.get('exchange') || 'binance';
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const limit = parseInt(searchParams.get('limit') || '500', 10);
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');

    const config: ExchangeConfig = {
      name: exchange as any,
      testnet: searchParams.get('testnet') === 'true',
    };

    const connector = createExchangeConnector(config);
    await connector.connect();

    let trades;

    // If historical trade parameters are provided
    if (startTime && endTime) {
      const historyConfig: TradeHistoryConfig = {
        exchange: exchange as any,
        symbol,
        startTime: parseInt(startTime, 10),
        endTime: parseInt(endTime, 10),
        limit,
        method: searchParams.get('method') as 'binance-vision' | 'rest-api' | undefined,
      };
      trades = await connector.getHistoricalTrades(historyConfig);
    } else {
      trades = await connector.getTrades(symbol, limit);
    }

    connector.disconnect();

    return NextResponse.json({
      success: true,
      data: trades,
      exchange,
      symbol,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Trades API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch trades',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trades
 * 
 * Query Parameters:
 * - exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx' (default: 'binance')
 * - symbol: Trading pair (default: 'BTCUSDT')
 * - limit: Number of trades to fetch (default: 500)
 * - startTime: Timestamp for historical trades (ms)
 * - endTime: Timestamp for historical trades (ms)
 * - method: For Binance, 'binance-vision' | 'rest-api'
 * - testnet: Set to 'true' to use testnet
 * 
 * Example:
 * GET /api/trades?exchange=binance&symbol=BTCUSDT&limit=1000
 * GET /api/trades?exchange=binance&symbol=BTCUSDT&startTime=1700000000000&endTime=1700086400000
 */
