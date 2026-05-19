'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Settings, Download, X } from 'lucide-react';
import CandlestickDashboard from './CandlestickDashboard';
import HeatmapDOMDashboard from './HeatmapDOMDashboard';
import FootprintDashboard from './FootprintDashboard';
import TimeAndSalesDashboard from './TimeAndSalesDashboard';
import DOMDashboard from './DOMDashboard';
import ComparisonDashboard from './ComparisonDashboard';

interface UnifiedSettings {
  exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx';
  symbol: string;
  autoRefresh: boolean;
  refreshInterval: number;
  theme: 'dark' | 'light';
  layout: 'wide' | 'compact' | 'custom';
}

type LayoutMode = 'all' | 'candlestick-dom-heatmap' | 'footprint-timesales' | 'comparison' | 'single';
type ActiveComponent = 'candlestick' | 'heatmap' | 'footprint' | 'timesales' | 'dom' | 'comparison';

interface PanelConfig {
  id: ActiveComponent;
  title: string;
  visible: boolean;
  width: string;
  height: string;
}

const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'candlestick', title: 'Candlestick Chart', visible: true, width: 'w-1/2', height: 'h-1/2' },
  { id: 'heatmap', title: 'DOM Heatmap', visible: true, width: 'w-1/4', height: 'h-1/2' },
  { id: 'dom', title: 'DOM Ladder', visible: true, width: 'w-1/4', height: 'h-1/2' },
  { id: 'footprint', title: 'Footprint', visible: true, width: 'w-1/2', height: 'h-1/2' },
  { id: 'timesales', title: 'Time & Sales', visible: true, width: 'w-1/2', height: 'h-1/2' },
  { id: 'comparison', title: 'Comparison', visible: true, width: 'w-full', height: 'h-1/3' },
];

export default function UnifiedTradingDashboard() {
  const [settings, setSettings] = useState<UnifiedSettings>({
    exchange: 'binance',
    symbol: 'BTCUSDT',
    autoRefresh: true,
    refreshInterval: 5000,
    theme: 'dark',
    layout: 'wide',
  });

  const [showSettings, setShowSettings] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('all');
  const [panels, setPanels] = useState<PanelConfig[]>(DEFAULT_PANELS);
  const [singlePanelMode, setSinglePanelMode] = useState<ActiveComponent | null>(null);

  // Toggle panel visibility
  const togglePanel = useCallback((panelId: ActiveComponent) => {
    setPanels(prev =>
      prev.map(p =>
        p.id === panelId ? { ...p, visible: !p.visible } : p
      )
    );
  }, []);

  // Switch to single panel view
  const viewSinglePanel = (panelId: ActiveComponent) => {
    setSinglePanelMode(panelId);
    setLayoutMode('single');
  };

  // Exit single panel view
  const exitSinglePanel = () => {
    setSinglePanelMode(null);
    setLayoutMode('all');
  };

  // Render component based on type
  const renderComponent = (componentId: ActiveComponent) => {
    switch (componentId) {
      case 'candlestick':
        return <CandlestickDashboard />;
      case 'heatmap':
        return <HeatmapDOMDashboard />;
      case 'footprint':
        return <FootprintDashboard />;
      case 'timesales':
        return <TimeAndSalesDashboard />;
      case 'dom':
        return <DOMDashboard />;
      case 'comparison':
        return <ComparisonDashboard />;
      default:
        return null;
    }
  };

  const getPanelTitle = (id: ActiveComponent): string => {
    const panel = panels.find(p => p.id === id);
    return panel?.title || id;
  };

  // Layout: Single Panel (Full Screen)
  if (layoutMode === 'single' && singlePanelMode) {
    return (
      <div className="w-full h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{getPanelTitle(singlePanelMode)}</h2>
            <span className="text-xs px-2 py-1 bg-slate-800 rounded text-slate-300">
              {settings.symbol} • {settings.exchange}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="p-2 hover:bg-slate-700 rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={exitSinglePanel}
              className="p-2 hover:bg-slate-700 rounded transition-colors"
              title="Exit full screen"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {renderComponent(singlePanelMode)}
        </div>
      </div>
    );
  }

  // Layout: All Panels (Default Dashboard)
  return (
    <div className="w-full h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">Trading Dashboard</h1>
            <span className="text-xs px-2 py-1 bg-blue-900/40 text-blue-300 rounded border border-blue-700/50">
              {settings.symbol}
            </span>
            <span className="text-xs px-2 py-1 bg-slate-800 rounded text-slate-300">
              {settings.exchange.toUpperCase()}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="p-2 hover:bg-slate-700 rounded transition-colors"
              title="Refresh all"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-slate-700 rounded transition-colors"
              title="Settings"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Panel Toggles */}
        <div className="flex flex-wrap gap-2">
          {panels.map(panel => (
            <button
              key={panel.id}
              onClick={() => togglePanel(panel.id)}
              className={`px-3 py-1 text-xs rounded transition-all ${
                panel.visible
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {panel.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout - Professional Trading Terminal Style */}
      <div className="flex-1 overflow-hidden flex flex-col p-2 gap-2">
        {/* Top Row: Candlestick | Heatmap | DOM Ladder | Time & Sales */}
        <div className="flex-1 flex gap-2 min-h-0">
          {/* Candlestick Chart - 40% width */}
          {panels.find(p => p.id === 'candlestick')?.visible && (
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden hover:border-slate-700 transition-colors group" style={{ flexBasis: '40%' }}>
              <div className="flex items-center justify-between p-2 bg-slate-800/50 border-b border-slate-800">
                <span className="text-sm font-medium">Candlestick Chart</span>
                <button
                  onClick={() => viewSinglePanel('candlestick')}
                  className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-all"
                >
                  Expand
                </button>
              </div>
              <div className="h-[calc(100%-2rem)] overflow-hidden">
                {renderComponent('candlestick')}
              </div>
            </div>
          )}

          {/* Heatmap - 20% width */}
          {panels.find(p => p.id === 'heatmap')?.visible && (
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden hover:border-slate-700 transition-colors group" style={{ flexBasis: '20%' }}>
              <div className="flex items-center justify-between p-2 bg-slate-800/50 border-b border-slate-800">
                <span className="text-sm font-medium">DOM Heatmap</span>
                <button
                  onClick={() => viewSinglePanel('heatmap')}
                  className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-all"
                >
                  Expand
                </button>
              </div>
              <div className="h-[calc(100%-2rem)] overflow-hidden">
                {renderComponent('heatmap')}
              </div>
            </div>
          )}

          {/* DOM Ladder - 15% width */}
          {panels.find(p => p.id === 'dom')?.visible && (
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden hover:border-slate-700 transition-colors group" style={{ flexBasis: '15%' }}>
              <div className="flex items-center justify-between p-2 bg-slate-800/50 border-b border-slate-800">
                <span className="text-sm font-medium">DOM/Ladder</span>
                <button
                  onClick={() => viewSinglePanel('dom')}
                  className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-all"
                >
                  Expand
                </button>
              </div>
              <div className="h-[calc(100%-2rem)] overflow-hidden">
                {renderComponent('dom')}
              </div>
            </div>
          )}

          {/* Time & Sales - 25% width */}
          {panels.find(p => p.id === 'timesales')?.visible && (
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden hover:border-slate-700 transition-colors group" style={{ flexBasis: '25%' }}>
              <div className="flex items-center justify-between p-2 bg-slate-800/50 border-b border-slate-800">
                <span className="text-sm font-medium">Time & Sales</span>
                <button
                  onClick={() => viewSinglePanel('timesales')}
                  className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-all"
                >
                  Expand
                </button>
              </div>
              <div className="h-[calc(100%-2rem)] overflow-hidden">
                {renderComponent('timesales')}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Row: Footprint (left) | Comparison (right) */}
        <div className="flex-1 flex gap-2 min-h-0">
          {/* Footprint - left side */}
          {panels.find(p => p.id === 'footprint')?.visible && (
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden hover:border-slate-700 transition-colors group">
              <div className="flex items-center justify-between p-2 bg-slate-800/50 border-b border-slate-800">
                <span className="text-sm font-medium">Footprint Analysis</span>
                <button
                  onClick={() => viewSinglePanel('footprint')}
                  className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-all"
                >
                  Expand
                </button>
              </div>
              <div className="h-[calc(100%-2rem)] overflow-hidden">
                {renderComponent('footprint')}
              </div>
            </div>
          )}

          {/* Comparison - right side */}
          {panels.find(p => p.id === 'comparison')?.visible && (
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden hover:border-slate-700 transition-colors group" style={{ flexBasis: '45%' }}>
              <div className="flex items-center justify-between p-2 bg-slate-800/50 border-b border-slate-800">
                <span className="text-sm font-medium">Comparison Charts</span>
                <button
                  onClick={() => viewSinglePanel('comparison')}
                  className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-all"
                >
                  Expand
                </button>
              </div>
              <div className="h-[calc(100%-2rem)] overflow-hidden">
                {renderComponent('comparison')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-t border-slate-800 bg-slate-900/70 p-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-2">Exchange</label>
              <select
                value={settings.exchange}
                onChange={(e) => setSettings({ ...settings, exchange: e.target.value as any })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
              >
                <option value="binance">Binance</option>
                <option value="bybit">Bybit</option>
                <option value="hyperliquid">Hyperliquid</option>
                <option value="okx">OKX</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-2">Symbol</label>
              <input
                type="text"
                value={settings.symbol}
                onChange={(e) => setSettings({ ...settings, symbol: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                placeholder="BTCUSDT"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-2">Refresh Interval (ms)</label>
              <input
                type="number"
                value={settings.refreshInterval}
                onChange={(e) => setSettings({ ...settings, refreshInterval: parseInt(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                min="1000"
                step="1000"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-2">Auto Refresh</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoRefresh}
                  onChange={(e) => setSettings({ ...settings, autoRefresh: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Enabled</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}