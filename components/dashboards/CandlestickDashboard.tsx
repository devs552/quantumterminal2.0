'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Settings,
  Zap,
  Download,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { createExchangeConnector } from '@/services/exchangeConnector';
import { Kline, ExchangeConfig } from '@/lib/types';

interface CandlestickSettings {
  exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx';
  symbol: string;
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  limit: number;
  showVolume: boolean;
  showMA: boolean;
  ma1?: number;
  ma2?: number;
}

export default function CandlestickDashboard() {
  const [settings, setSettings] = useState<CandlestickSettings>({
    exchange: 'binance',
    symbol: 'BTCUSDT',
    interval: '1h',
    limit: 100,
    showVolume: true,
    showMA: true,
    ma1: 7,
    ma2: 25,
  });

  const [klineData, setKlineData] = useState<
    (Kline & {
      normalizedVolume: number;
      ma1?: number;
      ma2?: number;
    })[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState({
    high: 0,
    low: 0,
    change: 0,
    changePercent: 0,
  });

  // Calculate moving averages
  const calculateMA = (data: Kline[], period: number): number[] => {
    const ma: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        ma.push(0);
      } else {
        const sum = data
          .slice(i - period + 1, i + 1)
          .reduce((acc, k) => acc + k.close, 0);
        ma.push(sum / period);
      }
    }
    return ma;
  };

  // Fetch kline data
  const fetchKlines = useCallback(async () => {
    setLoading(true);
    try {
      const config: ExchangeConfig = {
        name: settings.exchange,
      };

      const connector = createExchangeConnector(config);
      await connector.connect();

      const klines = await connector.getKlines(
        settings.symbol,
        settings.interval,
        settings.limit
      );
      connector.disconnect();

      if (!klines.length) {
        setKlineData([]);
        return;
      }

      // Calculate moving averages
      const ma1Values = settings.showMA ? calculateMA(klines, settings.ma1 || 7) : [];
      const ma2Values = settings.showMA ? calculateMA(klines, settings.ma2 || 25) : [];

      // Find max volume for normalization
      const maxVolume = Math.max(...klines.map((k) => k.volume));

      const processedData = klines.map((kline, index) => ({
        ...kline,
        normalizedVolume: (kline.volume / maxVolume) * 100,
        ma1: ma1Values[index],
        ma2: ma2Values[index],
      }));

      setKlineData(processedData);

      // Calculate stats
      const high = Math.max(...klines.map((k) => k.high));
      const low = Math.min(...klines.map((k) => k.low));
      const open = klines[0].open;
      const close = klines[klines.length - 1].close;
      const change = close - open;
      const changePercent = (change / open) * 100;

      setStats({ high, low, change, changePercent });
    } catch (error) {
      console.error('Error fetching klines:', error);
    } finally {
      setLoading(false);
    }
  }, [settings]);

  useEffect(() => {
    fetchKlines();
    const interval = setInterval(fetchKlines, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchKlines]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      const isGreen = data.close >= data.open;
      return (
        <div className="bg-black/80 text-white p-3 rounded border border-blue-500/30 text-xs">
          <p className="font-mono text-gray-300">
            {new Date(data.openTime).toLocaleString()}
          </p>
          <p className="font-mono">Open: ${data.open.toFixed(2)}</p>
          <p className="font-mono">High: ${data.high.toFixed(2)}</p>
          <p className="font-mono">Low: ${data.low.toFixed(2)}</p>
          <p className={`font-mono ${isGreen ? 'text-green-400' : 'text-red-400'}`}>
            Close: ${data.close.toFixed(2)}
          </p>
          <p className="font-mono text-yellow-400">
            Volume: {(data.volume / 1000).toFixed(2)}K
          </p>
          {data.ma1 > 0 && <p className="font-mono text-blue-400">MA7: ${data.ma1.toFixed(2)}</p>}
          {data.ma2 > 0 && <p className="font-mono text-purple-400">MA25: ${data.ma2.toFixed(2)}</p>}
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
            <TrendingUp className="h-5 w-5 text-blue-400" />
            Candlestick Chart - {settings.symbol}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Traditional OHLC candlestick with optional moving averages
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
            onClick={() => fetchKlines()}
            disabled={loading}
            className="p-2 rounded bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="p-2 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
            title="Export"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
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
              placeholder="BTCUSDT"
            />
          </div>
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
            <label className="text-xs font-semibold text-gray-300">Limit (candles)</label>
            <input
              type="number"
              value={settings.limit}
              onChange={(e) =>
                setSettings({ ...settings, limit: parseInt(e.target.value) })
              }
              className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
              min="1"
              max="1000"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-300">MA1 Period</label>
            <input
              type="number"
              value={settings.ma1}
              onChange={(e) =>
                setSettings({ ...settings, ma1: parseInt(e.target.value) })
              }
              className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
              disabled={!settings.showMA}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-300">MA2 Period</label>
            <input
              type="number"
              value={settings.ma2}
              onChange={(e) =>
                setSettings({ ...settings, ma2: parseInt(e.target.value) })
              }
              className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
              disabled={!settings.showMA}
            />
          </div>
          <label className="col-span-1 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showVolume}
              onChange={(e) =>
                setSettings({ ...settings, showVolume: e.target.checked })
              }
            />
            <span className="text-sm">Show Volume</span>
          </label>
          <label className="col-span-1 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showMA}
              onChange={(e) =>
                setSettings({ ...settings, showMA: e.target.checked })
              }
            />
            <span className="text-sm">Show Moving Averages</span>
          </label>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">High</p>
          <p className="text-lg font-bold text-emerald-400">
            ${stats.high.toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Low</p>
          <p className="text-lg font-bold text-red-400">
            ${stats.low.toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Change</p>
          <p
            className={`text-lg font-bold flex items-center gap-1 ${
              stats.change >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {stats.change >= 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            ${Math.abs(stats.change).toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Change %</p>
          <p
            className={`text-lg font-bold ${
              stats.changePercent >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {stats.changePercent >= 0 ? '+' : ''}{stats.changePercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-slate-900 border border-slate-700 rounded p-4 flex-1">
        {klineData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={klineData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="openTime"
                tickFormatter={(time) =>
                  new Date(time).toLocaleTimeString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                }
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                tickFormatter={(val) => `$${val.toFixed(0)}`}
              />
              {settings.showVolume && (
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              )}
              <Tooltip content={<CustomTooltip />} />

              {/* Candlesticks */}
              {klineData.map((data, idx) => {
                const isGreen = data.close >= data.open;
                const wickColor = isGreen ? '#10b981' : '#ef4444';
                return (
                  <Bar
                    key={`candle-${idx}`}
                    yAxisId="left"
                    dataKey="close"
                    fill={isGreen ? '#10b981' : '#ef4444'}
                    radius={2}
                  />
                );
              })}

              {/* Volume */}
              {settings.showVolume && (
                <Bar
                  yAxisId="right"
                  dataKey="normalizedVolume"
                  fill="#6366f1"
                  opacity={0.3}
                />
              )}

              {/* Moving Averages */}
              {settings.showMA && klineData.some((d) => d.ma1 && d.ma1 > 0) && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="ma1"
                  stroke="#3b82f6"
                  dot={false}
                  strokeWidth={1.5}
                  name={`MA${settings.ma1}`}
                />
              )}
              {settings.showMA && klineData.some((d) => d.ma2 && d.ma2 > 0) && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="ma2"
                  stroke="#a855f7"
                  dot={false}
                  strokeWidth={1.5}
                  name={`MA${settings.ma2}`}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-96 flex items-center justify-center text-gray-400">
            {loading ? 'Loading candlestick data...' : 'No data available'}
          </div>
        )}
      </div>
    </div>
  );
}
