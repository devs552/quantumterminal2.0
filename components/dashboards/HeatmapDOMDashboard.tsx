'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Settings, Zap, Download } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { createExchangeConnector } from '@/services/exchangeConnector';
import { Trade, ExchangeConfig } from '@/lib/types';

interface HeatmapSettings {
  exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx';
  symbol: string;
  priceGrouping: number;
  timeAggregation: '1m' | '5m' | '15m' | '1h';
  profileType: 'fixed-range' | 'visible-range';
  showBuySell: boolean;
  showImbalance: boolean;
}

interface HeatmapCell {
  id: string; // Add unique ID
  price: number;
  time: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  imbalance: number;
}

export default function HeatmapDOMDashboard() {
  const [settings, setSettings] = useState<HeatmapSettings>({
    exchange: 'binance',
    symbol: 'BTCUSDT',
    priceGrouping: 10,
    timeAggregation: '5m',
    profileType: 'visible-range',
    showBuySell: true,
    showImbalance: false,
  });

  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Helper function to get time aggregation in milliseconds
  const getTimeAggregationMs = (agg: string): number => {
    const map: Record<string, number> = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
    };
    return map[agg] || 300000;
  };

  // Helper function to get color based on volume intensity
  const getColorForVolume = (volume: number, maxVolume: number): string => {
    const intensity = volume / maxVolume;
    if (intensity > 0.8) return '#ef4444'; // Red (very high)
    if (intensity > 0.6) return '#f97316'; // Orange
    if (intensity > 0.4) return '#eab308'; // Yellow
    if (intensity > 0.2) return '#22c55e'; // Green (low)
    return '#3b82f6'; // Blue (very low)
  };

  // Fetch and process trade data into heatmap
  const generateHeatmap = useCallback(async () => {
    setLoading(true);
    try {
      const config: ExchangeConfig = {
        name: settings.exchange,
      };

      const connector = createExchangeConnector(config);
      await connector.connect();

      const trades = await connector.getTrades(settings.symbol, 1000);
      connector.disconnect();

      if (!trades.length) {
        setHeatmapData([]);
        return;
      }

      // Group trades by price and time
      const grouped = new Map<string, HeatmapCell>();
      const priceStep = settings.priceGrouping;
      const timeStep = getTimeAggregationMs(settings.timeAggregation);

      trades.forEach((trade) => {
        // Round price to nearest grouping
        const groupedPrice = Math.floor(trade.price / priceStep) * priceStep;
        const groupedTime = Math.floor(trade.timestamp / timeStep) * timeStep;
        const key = `${groupedPrice}-${groupedTime}`;

        const existing = grouped.get(key) || {
          id: key, // Use the key as unique ID
          price: groupedPrice,
          time: groupedTime,
          volume: 0,
          buyVolume: 0,
          sellVolume: 0,
          imbalance: 0.5,
        };

        existing.volume += trade.quantity;
        if (trade.side === 'buy') {
          existing.buyVolume += trade.quantity;
        } else {
          existing.sellVolume += trade.quantity;
        }

        const totalBuySell = existing.buyVolume + existing.sellVolume;
        existing.imbalance = totalBuySell > 0 ? existing.buyVolume / totalBuySell : 0.5;

        grouped.set(key, existing);
      });

      const data = Array.from(grouped.values()).sort((a, b) => a.time - b.time);
      setHeatmapData(data);
    } catch (error) {
      console.error('Error generating heatmap:', error);
    } finally {
      setLoading(false);
    }
  }, [settings]);

  // Calculate max volume for color scaling
  const maxVolume = Math.max(...(heatmapData.map((d) => d.volume) || [1]));

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-black/80 text-white p-3 rounded border border-emerald-500/30 text-xs">
          <p className="font-mono">Price: ${data.price.toFixed(2)}</p>
          <p className="font-mono text-blue-400">Volume: {data.volume.toFixed(2)}</p>
          <p className="font-mono text-green-400">Buy: {data.buyVolume.toFixed(2)}</p>
          <p className="font-mono text-red-400">Sell: {data.sellVolume.toFixed(2)}</p>
          <p className="font-mono text-yellow-400">
            Imbalance: {(data.imbalance * 100).toFixed(1)}%
          </p>
          <p className="font-mono text-gray-400">
            {new Date(data.time).toLocaleTimeString()}
          </p>
        </div>
      );
    }
    return null;
  };

  // Load initial data
  useEffect(() => {
    generateHeatmap();
  }, []);

  return (
    <div className="w-full h-full bg-slate-950 text-white p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            Heatmap DOM - {settings.symbol}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Time-series DOM heatmap with price grouping and volume profiles
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
            onClick={() => generateHeatmap()}
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
        <div className="bg-slate-900 border border-slate-700 rounded p-4 grid grid-cols-2 gap-4">
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
            <label className="text-xs font-semibold text-gray-300">
              Price Grouping ($)
            </label>
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
            <label className="text-xs font-semibold text-gray-300">
              Time Aggregation
            </label>
            <select
              value={settings.timeAggregation}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  timeAggregation: e.target.value as any,
                })
              }
              className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
            >
              <option>1m</option>
              <option>5m</option>
              <option>15m</option>
              <option>1h</option>
            </select>
          </div>
          <label className="col-span-2 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showBuySell}
              onChange={(e) =>
                setSettings({ ...settings, showBuySell: e.target.checked })
              }
            />
            <span className="text-sm">Show Buy/Sell Volumes</span>
          </label>
          <label className="col-span-2 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showImbalance}
              onChange={(e) =>
                setSettings({ ...settings, showImbalance: e.target.checked })
              }
            />
            <span className="text-sm">Show Imbalance Overlay</span>
          </label>
        </div>
      )}

      {/* Heatmap Chart */}
      <div className="bg-slate-900 border border-slate-700 rounded p-4 flex-1">
        {heatmapData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 60 }}>
              <XAxis
                type="number"
                dataKey="time"
                name="Time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(time) => new Date(time).toLocaleTimeString()}
              />
              <YAxis
                type="number"
                dataKey="price"
                name="Price"
                domain={['dataMin', 'dataMax']}
                label={{ value: 'Price ($)', angle: -90, position: 'insideLeft' }}
                tickFormatter={(price) => `$${price.toFixed(0)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter name="Volume Profile" data={heatmapData}>
                {heatmapData.map((entry, index) => (
                  <Cell
                    key={entry.id}
                    fill={getColorForVolume(entry.volume, maxVolume)}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-96 flex items-center justify-center text-gray-400">
            {loading ? 'Loading heatmap data...' : 'No data available'}
          </div>
        )}
      </div>

      {/* Legend and Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Total Volume</p>
          <p className="text-lg font-bold text-emerald-400">
            {heatmapData.reduce((sum, d) => sum + d.volume, 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Avg Buy Volume</p>
          <p className="text-lg font-bold text-green-400">
            {(
              heatmapData.reduce((sum, d) => sum + d.buyVolume, 0) /
              Math.max(heatmapData.length, 1)
            ).toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Avg Sell Volume</p>
          <p className="text-lg font-bold text-red-400">
            {(
              heatmapData.reduce((sum, d) => sum + d.sellVolume, 0) /
              Math.max(heatmapData.length, 1)
            ).toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded p-3">
          <p className="text-xs text-gray-400">Price Range</p>
          <p className="text-lg font-bold text-blue-400">
            {heatmapData.length > 0
              ? `$${Math.min(...heatmapData.map((d) => d.price)).toFixed(0)} - $${Math.max(
                  ...heatmapData.map((d) => d.price)
                ).toFixed(0)}`
              : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}