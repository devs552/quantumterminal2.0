'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Settings, List, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { createExchangeConnector } from '@/services/exchangeConnector';
import { Trade, ExchangeConfig } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TimeSalesSettings {
  exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx';
  symbol: string;
  limit: number;
  highlightLargeVolume: boolean;
  largeVolumeThreshold: number;
  autoRefresh: boolean;
}

interface TimeSalesEntry extends Trade {
  displayPrice: string;
  displayQuantity: string;
  displayTime: string;
}

export default function TimeAndSalesDashboard({ selectedSymbol }: { selectedSymbol?: string }) {
  const [settings, setSettings] = useState<TimeSalesSettings>({
    exchange: 'binance',
    symbol: 'BTCUSDT',
    limit: 100,
    highlightLargeVolume: true,
    largeVolumeThreshold: 10,
    autoRefresh: true,
  });

  const [trades, setTrades] = useState<TimeSalesEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState({
    buyCount: 0,
    sellCount: 0,
    totalVolume: 0,
    avgPrice: 0,
  });

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const config: ExchangeConfig = {
        name: settings.exchange,
      };

      const connector = createExchangeConnector(config);
      await connector.connect();

      const fetchedTrades = await connector.getTrades(
        settings.symbol,
        settings.limit
      );

      connector.disconnect();

      const formatted: TimeSalesEntry[] = fetchedTrades
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((trade) => ({
          ...trade,
          displayPrice: `$${trade.price.toFixed(2)}`,
          displayQuantity: trade.quantity.toFixed(4),
          displayTime: new Date(trade.timestamp).toLocaleTimeString(),
        }));

      setTrades(formatted);

      // Calculate stats
      const buyCount = formatted.filter((t) => t.side === 'buy').length;
      const sellCount = formatted.filter((t) => t.side === 'sell').length;
      const totalVolume = formatted.reduce((sum, t) => sum + t.quantity, 0);
      const avgPrice =
        formatted.reduce((sum, t) => sum + t.price * t.quantity, 0) /
        Math.max(totalVolume, 1);

      setStats({ buyCount, sellCount, totalVolume, avgPrice });
    } catch (error) {
      console.error('Error fetching trades:', error);
    } finally {
      setLoading(false);
    }
  }, [settings]);

  useEffect(() => {
    fetchTrades();
    if (settings.autoRefresh) {
      const interval = setInterval(fetchTrades, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchTrades, settings.autoRefresh]);

  const isLargeVolume = (quantity: number): boolean => {
    const maxVolume = Math.max(...(trades.map((t) => t.quantity) || [1]));
    return quantity > maxVolume * (settings.largeVolumeThreshold / 100);
  };

  return (
    <div className="w-full h-full bg-slate-950 text-white p-6 space-y-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <List className="h-5 w-5 text-teal-400" />
            Time & Sales - {settings.symbol}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Live trades scrollable list with volume highlighting
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => fetchTrades()}
            disabled={loading}
            className="p-2 rounded bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="p-2 rounded bg-slate-800 hover:bg-slate-700 transition-colors">
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="bg-slate-900 border border-slate-700 rounded p-4 grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-300">Exchange</label>
            <select
              value={settings.exchange}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  exchange: e.target.value as any,
                })
              }
              className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
            >
              <option>binance</option>
              <option>bybit</option>
              <option>hyperliquid</option>
              <option>okx</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-300">Symbol</label>
            <input
              type="text"
              value={settings.symbol}
              onChange={(e) =>
                setSettings({ ...settings, symbol: e.target.value })
              }
              className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-300">Limit</label>
            <input
              type="number"
              value={settings.limit}
              onChange={(e) =>
                setSettings({ ...settings, limit: parseInt(e.target.value) })
              }
              className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
              min="10"
              max="1000"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-300">Large Volume Threshold (%)</label>
            <input
              type="number"
              value={settings.largeVolumeThreshold}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  largeVolumeThreshold: parseInt(e.target.value),
                })
              }
              className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
            />
          </div>
          <label className="col-span-2 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoRefresh}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autoRefresh: e.target.checked,
                })
              }
            />
            <span className="text-sm">Auto Refresh (5s)</span>
          </label>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Buys</p>
          <p className="text-lg font-bold text-green-400">{stats.buyCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Sells</p>
          <p className="text-lg font-bold text-red-400">{stats.sellCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Total Volume</p>
          <p className="text-lg font-bold text-blue-400">
            {stats.totalVolume.toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Avg Price</p>
          <p className="text-lg font-bold text-purple-400">
            ${stats.avgPrice.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Trades List */}
      <div className="flex-1 bg-slate-900 border border-slate-700 rounded overflow-hidden flex flex-col">
        <div className="sticky top-0 grid grid-cols-5 gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700 text-xs font-semibold text-gray-300 z-10">
          <div>Time</div>
          <div>Side</div>
          <div className="text-right">Price</div>
          <div className="text-right">Quantity</div>
          <div className="text-right">Value</div>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-4 space-y-1 py-2">
            {trades.length > 0 ? (
              trades.map((trade, idx) => {
                const isBuy = trade.side === 'buy';
                const isLarge = settings.highlightLargeVolume && isLargeVolume(trade.quantity);
                return (
                  <div
                    key={`${trade.id}-${idx}`}
                    className={`grid grid-cols-5 gap-2 py-2 px-2 rounded text-xs font-mono ${
                      isLarge
                        ? isBuy
                          ? 'bg-green-500/20'
                          : 'bg-red-500/20'
                        : ''
                    }`}
                  >
                    <div className="text-gray-400">{trade.displayTime}</div>
                    <div className={isBuy ? 'text-green-400' : 'text-red-400'}>
                      {isBuy ? (
                        <TrendingUp className="inline h-3 w-3" />
                      ) : (
                        <TrendingDown className="inline h-3 w-3" />
                      )}{' '}
                      {isBuy ? 'BUY' : 'SELL'}
                    </div>
                    <div className="text-right text-white">{trade.displayPrice}</div>
                    <div className="text-right text-gray-300">
                      {trade.displayQuantity}
                    </div>
                    <div className="text-right text-gray-400">
                      ${(trade.price * trade.quantity).toFixed(2)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-500">
                {loading ? 'Loading trades...' : 'No trades available'}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
