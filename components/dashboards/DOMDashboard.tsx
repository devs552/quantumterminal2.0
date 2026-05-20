'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Settings, GitBranch, Download, TrendingUp, TrendingDown } from 'lucide-react';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { createExchangeConnector } from '@/services/exchangeConnector';
import { OrderBook, ExchangeConfig } from '@/lib/types';

interface DOMSettings {
  exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx';
  symbol: string;
  depth: number;
  grouping: number;
  showSpread: boolean;
  autoRefresh: boolean;
}

interface DOMLevel {
  price: number;
  bidQuantity: number;
  askQuantity: number;
  spread: number;
  spreadPercent: number;
}

export default function DOMDashboard({ selectedSymbol }: { selectedSymbol?: string }) {
  const [settings, setSettings] = useState<DOMSettings>({
    exchange: 'binance',
    symbol: 'BTCUSDT',
    depth: 20,
    grouping: 1,
    showSpread: true,
    autoRefresh: true,
  });

  const [domData, setDOMData] = useState<DOMLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState({
    bidVolume: 0,
    askVolume: 0,
    spread: 0,
    spreadPercent: 0,
    midPrice: 0,
  });

  const fetchOrderBook = useCallback(async () => {
    setLoading(true);
    try {
      const config: ExchangeConfig = {
        name: settings.exchange,
      };

      const connector = createExchangeConnector(config);
      await connector.connect();

      const orderbook = await connector.getOrderBook(
        settings.symbol,
        settings.depth * 2
      );

      connector.disconnect();

      if (!orderbook.bids.length || !orderbook.asks.length) {
        setDOMData([]);
        return;
      }

      // Create merged view with grouping
      const domLevels: Record<number, DOMLevel> = {};

      orderbook.bids.forEach(({ price, quantity }) => {
        const groupedPrice =
          Math.floor(price / settings.grouping) * settings.grouping;
        if (!domLevels[groupedPrice]) {
          domLevels[groupedPrice] = {
            price: groupedPrice,
            bidQuantity: 0,
            askQuantity: 0,
            spread: 0,
            spreadPercent: 0,
          };
        }
        domLevels[groupedPrice].bidQuantity += quantity;
      });

      orderbook.asks.forEach(({ price, quantity }) => {
        const groupedPrice =
          Math.floor(price / settings.grouping) * settings.grouping;
        if (!domLevels[groupedPrice]) {
          domLevels[groupedPrice] = {
            price: groupedPrice,
            bidQuantity: 0,
            askQuantity: 0,
            spread: 0,
            spreadPercent: 0,
          };
        }
        domLevels[groupedPrice].askQuantity += quantity;
      });

      const data = Object.values(domLevels)
        .sort((a, b) => b.price - a.price)
        .slice(0, settings.depth);

      // Calculate spread
      const bestBid = Math.max(...data.map((d) => d.price).filter((p) => data.find((d) => d.price === p && d.bidQuantity > 0)));
      const bestAsk = Math.min(...data.map((d) => d.price).filter((p) => data.find((d) => d.price === p && d.askQuantity > 0)));
      const spread = bestAsk - bestBid;
      const spreadPercent = (spread / ((bestBid + bestAsk) / 2)) * 100;
      const midPrice = (bestBid + bestAsk) / 2;

      const bidVolume = data.reduce((sum, d) => sum + d.bidQuantity, 0);
      const askVolume = data.reduce((sum, d) => sum + d.askQuantity, 0);

      setDOMData(data);
      setStats({ bidVolume, askVolume, spread, spreadPercent, midPrice });
    } catch (error) {
      console.error('Error fetching orderbook:', error);
    } finally {
      setLoading(false);
    }
  }, [settings]);

  useEffect(() => {
    fetchOrderBook();
    if (settings.autoRefresh) {
      const interval = setInterval(fetchOrderBook, 2000);
      return () => clearInterval(interval);
    }
  }, [fetchOrderBook, settings.autoRefresh]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-black/80 text-white p-3 rounded border border-green-500/30 text-xs">
          <p className="font-mono">Price: ${data.price.toFixed(2)}</p>
          <p className="font-mono text-green-400">Bid: {data.bidQuantity.toFixed(2)}</p>
          <p className="font-mono text-red-400">Ask: {data.askQuantity.toFixed(2)}</p>
          <p className="font-mono text-gray-400">
            Ratio: {(data.bidQuantity / Math.max(data.askQuantity, 1)).toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full bg-slate-950 text-white p-6 space-y-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-green-400" />
            DOM / Ladder - {settings.symbol}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Depth of Market with bid/ask ladders and spread
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => fetchOrderBook()}
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
            <label className="text-xs font-semibold text-gray-300">Depth</label>
            <input
              type="number"
              value={settings.depth}
              onChange={(e) =>
                setSettings({ ...settings, depth: parseInt(e.target.value) })
              }
              className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-300">Price Grouping ($)</label>
            <input
              type="number"
              value={settings.grouping}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  grouping: parseFloat(e.target.value),
                })
              }
              className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
              step="0.1"
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
            <span className="text-sm">Auto Refresh (2s)</span>
          </label>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Bid Volume</p>
          <p className="text-lg font-bold text-green-400">
            {stats.bidVolume.toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Ask Volume</p>
          <p className="text-lg font-bold text-red-400">
            {stats.askVolume.toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Spread</p>
          <p className="text-lg font-bold text-blue-400">
            ${stats.spread.toFixed(4)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Spread %</p>
          <p className="text-lg font-bold text-purple-400">
            {stats.spreadPercent.toFixed(4)}%
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Mid Price</p>
          <p className="text-lg font-bold text-yellow-400">
            ${stats.midPrice.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 bg-slate-900 border border-slate-700 rounded p-4">
        {domData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={domData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="price"
                tickFormatter={(val) => `$${val.toFixed(0)}`}
                tick={{ fontSize: 12 }}
              />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="bidQuantity"
                name="Bid Volume"
                fill="#10b981"
                stackId="volume"
              />
              <Bar
                yAxisId="left"
                dataKey="askQuantity"
                name="Ask Volume"
                fill="#ef4444"
                stackId="volume"
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            {loading ? 'Loading orderbook...' : 'No data available'}
          </div>
        )}
      </div>
    </div>
  );
}
