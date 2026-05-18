'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Settings, GitCompare, Download } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { createExchangeConnector } from '@/services/exchangeConnector';
import { Kline, ExchangeConfig } from '@/lib/types';

interface ComparisonSettings {
  exchanges: Array<{
    exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx';
    symbol: string;
    color: string;
    label: string;
  }>;
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  limit: number;
  normalizePercent: boolean;
}

interface ComparisonPoint {
  time: number;
  timeStr: string;
  [key: string]: number | string;
}

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
const DEFAULT_EXCHANGES: ComparisonSettings['exchanges'] = [
  { exchange: 'binance', symbol: 'BTCUSDT', color: '#3b82f6', label: 'BTC' },
  { exchange: 'binance', symbol: 'ETHUSDT', color: '#10b981', label: 'ETH' },
];

export default function ComparisonDashboard() {
  const [settings, setSettings] = useState<ComparisonSettings>({
    exchanges: DEFAULT_EXCHANGES,
    interval: '1h',
    limit: 100,
    normalizePercent: true,
  });

  const [comparisonData, setComparisonData] = useState<ComparisonPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newExchange, setNewExchange] = useState<ComparisonSettings['exchanges'][0]>({
    exchange: 'binance',
    symbol: 'SOLUSDT',
    color: '#a855f7',
    label: 'SOL',
  });

  const fetchComparison = useCallback(async () => {
    setLoading(true);
    try {
      const allKlines = await Promise.all(
        settings.exchanges.map(async (ex) => {
          const config: ExchangeConfig = {
            name: ex.exchange,
          };

          const connector = createExchangeConnector(config);
          await connector.connect();

          const klines = await connector.getKlines(
            ex.symbol,
            settings.interval,
            settings.limit
          );

          connector.disconnect();
          return { ...ex, klines };
        })
      );

      // Merge all klines by time
      const dataMap = new Map<number, ComparisonPoint>();

      allKlines.forEach(({ klines, symbol, label }) => {
        const basePrice = klines[0]?.close || 1;

        klines.forEach((kline) => {
          const timeKey = kline.openTime;
          if (!dataMap.has(timeKey)) {
            dataMap.set(timeKey, {
              time: timeKey,
              timeStr: new Date(timeKey).toLocaleTimeString(),
            });
          }

          const point = dataMap.get(timeKey)!;
          const normalized = settings.normalizePercent
            ? ((kline.close - basePrice) / basePrice) * 100
            : kline.close;

          point[label] = normalized;
        });
      });

      const sortedData = Array.from(dataMap.values()).sort(
        (a, b) => (a.time as number) - (b.time as number)
      );

      setComparisonData(sortedData);
    } catch (error) {
      console.error('Error fetching comparison data:', error);
    } finally {
      setLoading(false);
    }
  }, [settings]);

  useEffect(() => {
    fetchComparison();
    const interval = setInterval(fetchComparison, 60000);
    return () => clearInterval(interval);
  }, [fetchComparison]);

  const addExchange = () => {
    if (settings.exchanges.length < 4) {
      setSettings({
        ...settings,
        exchanges: [...settings.exchanges, newExchange],
      });
      setNewExchange({
        exchange: 'binance',
        symbol: 'DOGEUSDT',
        color: DEFAULT_COLORS[settings.exchanges.length],
        label: 'New',
      });
    }
  };

  const removeExchange = (index: number) => {
    setSettings({
      ...settings,
      exchanges: settings.exchanges.filter((_, i) => i !== index),
    });
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload) {
      return (
        <div className="bg-black/80 text-white p-3 rounded border border-blue-500/30 text-xs">
          <p className="font-mono text-gray-300 mb-2">
            {payload[0]?.payload?.timeStr}
          </p>
          {payload.map((entry: any, idx: number) => (
            <p key={idx} style={{ color: entry.color }} className="font-mono">
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
              {settings.normalizePercent ? '%' : ''}
            </p>
          ))}
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
            <GitCompare className="h-5 w-5 text-blue-400" />
            Comparison Chart
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Compare multiple assets normalized by {settings.normalizePercent ? 'percentage' : 'absolute'} price change
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
            onClick={() => fetchComparison()}
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
        <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-300">Interval</label>
              <select
                value={settings.interval}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    interval: e.target.value as any,
                  })
                }
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
              >
                <option>1m</option>
                <option>5m</option>
                <option>15m</option>
                <option>1h</option>
                <option>4h</option>
                <option>1d</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-300">Limit</label>
              <input
                type="number"
                value={settings.limit}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    limit: parseInt(e.target.value),
                  })
                }
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.normalizePercent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    normalizePercent: e.target.checked,
                  })
                }
              />
              <span className="text-sm">Normalize %</span>
            </label>
          </div>

          {/* Exchange List */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-2">
              Tracked Assets
            </label>
            <div className="space-y-2">
              {settings.exchanges.map((ex, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={ex.label}
                      onChange={(e) => {
                        const updated = [...settings.exchanges];
                        updated[idx].label = e.target.value;
                        setSettings({ ...settings, exchanges: updated });
                      }}
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
                      placeholder="Label"
                    />
                    <input
                      type="text"
                      value={ex.symbol}
                      onChange={(e) => {
                        const updated = [...settings.exchanges];
                        updated[idx].symbol = e.target.value;
                        setSettings({ ...settings, exchanges: updated });
                      }}
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
                      placeholder="Symbol"
                    />
                  </div>
                  <button
                    onClick={() => removeExchange(idx)}
                    className="px-3 py-1 bg-red-900/50 hover:bg-red-900 rounded text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {settings.exchanges.length < 4 && (
              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={newExchange.symbol}
                  onChange={(e) =>
                    setNewExchange({ ...newExchange, symbol: e.target.value })
                  }
                  className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
                  placeholder="New Symbol"
                />
                <button
                  onClick={addExchange}
                  className="px-4 py-1 bg-emerald-900/50 hover:bg-emerald-900 rounded text-xs"
                >
                  Add Asset
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 bg-slate-900 border border-slate-700 rounded p-4">
        {comparisonData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="timeStr"
                tick={{ fontSize: 12 }}
                interval={Math.floor(comparisonData.length / 10)}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                label={{
                  value: settings.normalizePercent ? 'Change (%)' : 'Price',
                  angle: -90,
                  position: 'insideLeft',
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {settings.exchanges.map((ex) => (
                <Line
                  key={ex.label}
                  type="monotone"
                  dataKey={ex.label}
                  stroke={ex.color}
                  dot={false}
                  strokeWidth={2}
                  name={ex.label}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            {loading ? 'Loading comparison data...' : 'No data available'}
          </div>
        )}
      </div>
    </div>
  );
}
