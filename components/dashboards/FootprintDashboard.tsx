'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Settings, BarChart3, Download } from 'lucide-react';
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
import { Trade, Kline, ExchangeConfig } from '@/lib/types';

interface FootprintSettings {
  exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx';
  symbol: string;
  interval: '1m' | '5m' | '15m' | '1h';
  priceGrouping: number;
  clusteringMethod: 'order-book' | 'delta' | 'imbalance';
  showNakedPOC: boolean;
  showImbalance: boolean;
}

interface FootprintBar {
  time: number;
  timeStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  pointOfControl?: number;
  imbalance: number;
  profiles: Record<number, number>;
}

export default function FootprintDashboard({ selectedSymbol }: { selectedSymbol?: string }) {
  const [settings, setSettings] = useState<FootprintSettings>({
    exchange: 'binance',
    symbol: 'BTCUSDT',
    interval: '5m',
    priceGrouping: 10,
    clusteringMethod: 'delta',
    showNakedPOC: true,
    showImbalance: true,
  });

  const [footprintData, setFootprintData] = useState<FootprintBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Aggregate trades into footprint bars
  const generateFootprints = useCallback(async () => {
    setLoading(true);
    try {
      const config: ExchangeConfig = {
        name: settings.exchange,
      };

      const connector = createExchangeConnector(config);
      await connector.connect();

      const [trades, klines] = await Promise.all([
        connector.getTrades(settings.symbol, 1000),
        connector.getKlines(settings.symbol, settings.interval, 50),
      ]);

      connector.disconnect();

      if (!trades.length || !klines.length) {
        setFootprintData([]);
        return;
      }

      // Create footprint bars
      const footprints: FootprintBar[] = klines.map((kline) => {
        const barTrades = trades.filter(
          (t) =>
            t.timestamp >= kline.openTime &&
            t.timestamp <= kline.closeTime
        );

        const profiles: Record<number, number> = {};
        let buyVolume = 0;
        let sellVolume = 0;

        barTrades.forEach((trade) => {
          const groupedPrice =
            Math.floor(trade.price / settings.priceGrouping) *
            settings.priceGrouping;
          profiles[groupedPrice] =
            (profiles[groupedPrice] || 0) + trade.quantity;

          if (trade.side === 'buy') {
            buyVolume += trade.quantity;
          } else {
            sellVolume += trade.quantity;
          }
        });

        // Find Point of Control (price level with highest volume)
        const poc = Object.entries(profiles).sort(
          ([, v1], [, v2]) => v2 - v1
        )[0]?.[0];

        const imbalance =
          buyVolume + sellVolume > 0
            ? buyVolume / (buyVolume + sellVolume)
            : 0.5;

        return {
          time: kline.openTime,
          timeStr: new Date(kline.openTime).toLocaleTimeString(),
          open: kline.open,
          high: kline.high,
          low: kline.low,
          close: kline.close,
          volume: kline.volume,
          buyVolume,
          sellVolume,
          pointOfControl: poc ? parseFloat(poc) : undefined,
          imbalance,
          profiles,
        };
      });

      setFootprintData(footprints);
    } catch (error) {
      console.error('Error generating footprints:', error);
    } finally {
      setLoading(false);
    }
  }, [settings]);

  useEffect(() => {
    generateFootprints();
    const interval = setInterval(generateFootprints, 30000);
    return () => clearInterval(interval);
  }, [generateFootprints]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-black/80 text-white p-3 rounded border border-orange-500/30 text-xs">
          <p className="font-mono">{data.timeStr}</p>
          <p className="font-mono">OHLC: {data.open.toFixed(2)} / {data.high.toFixed(2)} / {data.low.toFixed(2)} / {data.close.toFixed(2)}</p>
          <p className="font-mono text-green-400">Buy: {data.buyVolume.toFixed(2)}</p>
          <p className="font-mono text-red-400">Sell: {data.sellVolume.toFixed(2)}</p>
          <p className="font-mono text-yellow-400">Imbalance: {(data.imbalance * 100).toFixed(1)}%</p>
          {data.pointOfControl && (
            <p className="font-mono text-purple-400">POC: ${data.pointOfControl.toFixed(2)}</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full bg-slate-950 text-white p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-orange-400" />
            Footprint Chart - {settings.symbol}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Price-grouped trades with imbalance and POC studies
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
            onClick={() => generateFootprints()}
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
                setSettings({ ...settings, exchange: e.target.value as any })
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
            <label className="text-xs font-semibold text-gray-300">Interval</label>
            <select
              value={settings.interval}
              onChange={(e) =>
                setSettings({ ...settings, interval: e.target.value as any })
              }
              className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
            >
              <option>1m</option>
              <option>5m</option>
              <option>15m</option>
              <option>1h</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-300">Price Grouping</label>
            <input
              type="number"
              value={settings.priceGrouping}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  priceGrouping: parseFloat(e.target.value),
                })
              }
              className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-300">Clustering</label>
            <select
              value={settings.clusteringMethod}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  clusteringMethod: e.target.value as any,
                })
              }
              className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
            >
              <option value="order-book">Order Book</option>
              <option value="delta">Delta</option>
              <option value="imbalance">Imbalance</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showNakedPOC}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  showNakedPOC: e.target.checked,
                })
              }
            />
            <span className="text-sm">Naked POC</span>
          </label>
        </div>
      )}

      {/* Chart */}
      <div className="bg-slate-900 border border-slate-700 rounded p-4 flex-1">
        {footprintData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={footprintData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="timeStr" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="buyVolume"
                name="Buy Volume"
                fill="#10b981"
                stackId="volume"
              />
              <Bar
                yAxisId="left"
                dataKey="sellVolume"
                name="Sell Volume"
                fill="#ef4444"
                stackId="volume"
              />
              <Bar
                yAxisId="right"
                dataKey="imbalance"
                name="Imbalance"
                fill="#f59e0b"
                opacity={0.5}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-96 flex items-center justify-center text-gray-400">
            {loading ? 'Loading footprint data...' : 'No data available'}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Total Buy Volume</p>
          <p className="text-lg font-bold text-green-400">
            {footprintData.reduce((sum, d) => sum + d.buyVolume, 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Total Sell Volume</p>
          <p className="text-lg font-bold text-red-400">
            {footprintData.reduce((sum, d) => sum + d.sellVolume, 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Avg Imbalance</p>
          <p className="text-lg font-bold text-yellow-400">
            {(footprintData.reduce((sum, d) => sum + d.imbalance, 0) / Math.max(footprintData.length, 1) * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Bars Analyzed</p>
          <p className="text-lg font-bold text-blue-400">{footprintData.length}</p>
        </div>
      </div>
    </div>
  );
}
