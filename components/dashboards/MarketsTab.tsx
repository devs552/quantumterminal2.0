'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp, TrendingDown, RefreshCw, AlertTriangle,
  Terminal, Search, Bell, BellRing, Zap, BarChart2,
  ChevronRight, ChevronDown, Activity, Globe, Layers,
  Settings, Star, ExternalLink, ArrowUpRight, ArrowDownRight,
  SlidersHorizontal, Eye, BookOpen, PieChart, Target,
  Cpu, Radio, Database, Filter,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ComposedChart,
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MarketAsset {
  symbol: string; name?: string; price?: number; close?: number;
  open?: number; high?: number; low?: number; change?: number;
  changePercent?: number; volume?: number;
}
interface SectorData {
  sector: string; change: number; symbol?: string; price?: number; volume?: number;
}
interface MarketsApiResponse {
  success: boolean;
  data: { markets: MarketAsset[]; sectors: SectorData[]; timestamp: string; source: string; };
}

type Phase = 'command' | 'drilldown' | 'equity' | 'crossasset' | 'realtime' | 'proworkspace';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const INDEX_COLORS: Record<string, string> = {
  SPX: '#00D9FF', NDX: '#4CAF50', DJI: '#FFD700', RUT: '#FF9800',
  GOLD: '#FFD700', OIL: '#FF5722', DXY: '#9C27B0', VIX: '#E91E63',
};

const YIELD_DATA = [
  { tenor: '1M', current: 5.32, prev: 5.28 }, { tenor: '3M', current: 5.38, prev: 5.31 },
  { tenor: '6M', current: 5.44, prev: 5.40 }, { tenor: '1Y', current: 5.20, prev: 5.15 },
  { tenor: '2Y', current: 4.72, prev: 4.68 }, { tenor: '3Y', current: 4.45, prev: 4.40 },
  { tenor: '5Y', current: 4.22, prev: 4.19 }, { tenor: '7Y', current: 4.18, prev: 4.14 },
  { tenor: '10Y', current: 4.05, prev: 4.01 }, { tenor: '20Y', current: 4.35, prev: 4.30 },
  { tenor: '30Y', current: 4.25, prev: 4.21 },
];

const FX_VOL_DATA = [
  { pair: 'EUR/USD', vol1m: 6.2, vol3m: 6.8, vol1y: 7.1, spot: 1.0842 },
  { pair: 'USD/JPY', vol1m: 8.4, vol3m: 9.1, vol1y: 9.7, spot: 149.32 },
  { pair: 'GBP/USD', vol1m: 7.1, vol3m: 7.4, vol1y: 8.2, spot: 1.2634 },
  { pair: 'USD/CHF', vol1m: 5.8, vol3m: 6.2, vol1y: 6.9, spot: 0.9012 },
  { pair: 'AUD/USD', vol1m: 9.2, vol3m: 9.8, vol1y: 10.4, spot: 0.6521 },
];

const FUTURES_CURVE = [
  { month: 'Jul 24', price: 81.22 }, { month: 'Aug 24', price: 80.85 },
  { month: 'Sep 24', price: 80.41 }, { month: 'Oct 24', price: 79.92 },
  { month: 'Nov 24', price: 79.38 }, { month: 'Dec 24', price: 78.81 },
  { month: 'Jan 25', price: 78.22 }, { month: 'Feb 25', price: 77.60 },
];

const CORR = [
  { name: 'SPX', SPX: 1.00, DXY: -0.72, Gold: 0.15, Oil: 0.43, BTC: 0.68, VIX: -0.78 },
  { name: 'DXY', SPX: -0.72, DXY: 1.00, Gold: -0.45, Oil: -0.38, BTC: -0.52, VIX: 0.45 },
  { name: 'Gold', SPX: 0.15, DXY: -0.45, Gold: 1.00, Oil: 0.62, BTC: 0.34, VIX: -0.12 },
  { name: 'Oil', SPX: 0.43, DXY: -0.38, Gold: 0.62, Oil: 1.00, BTC: 0.51, VIX: -0.31 },
  { name: 'BTC', SPX: 0.68, DXY: -0.52, Gold: 0.34, Oil: 0.51, BTC: 1.00, VIX: -0.60 },
  { name: 'VIX', SPX: -0.78, DXY: 0.45, Gold: -0.12, Oil: -0.31, BTC: -0.60, VIX: 1.00 },
];

const MOCK_ALERTS = [
  { id: 1, type: 'price', symbol: 'SPX', msg: 'SPX crossed 5,100 resistance', time: '14:32', severity: 'high' },
  { id: 2, type: 'news', symbol: 'AAPL', msg: 'AAPL: Earnings beat by 8.3% — revenue $94.8B', time: '14:28', severity: 'medium' },
  { id: 3, type: 'vol', symbol: 'VIX', msg: 'VIX spike detected: +18% in 10 min', time: '14:15', severity: 'high' },
  { id: 4, type: 'news', symbol: 'FED', msg: 'Fed minutes: "patient on rate cuts" — hawkish tone', time: '14:00', severity: 'medium' },
  { id: 5, type: 'price', symbol: 'GOLD', msg: 'Gold ATH test: $2,389 — 3rd attempt', time: '13:44', severity: 'low' },
];

const MOCK_EQUITY_DETAIL = {
  symbol: 'AAPL', name: 'Apple Inc.', price: 189.42, changePercent: 1.34,
  pe: 29.2, eps: 6.48, marketCap: '2.93T', beta: 1.22, dividend: 0.96,
  revenueGrowth: 5.2, grossMargin: 44.1, debtToEquity: 1.8,
  optionsIV: 24.3, putCallRatio: 0.82, maxPain: 187.5,
  ownership: [
    { holder: 'Vanguard Group', pct: 8.54 }, { holder: 'BlackRock', pct: 6.82 },
    { holder: 'Berkshire Hathaway', pct: 5.73 }, { holder: 'State Street', pct: 3.91 },
    { holder: 'FMR LLC', pct: 2.14 },
  ],
  estimates: [
    { period: 'Q3 24E', rev: 89.4, eps: 1.41, revSurp: null },
    { period: 'Q4 24E', rev: 117.2, eps: 2.15, revSurp: null },
    { period: 'FY 24E', rev: 394.1, eps: 6.53, revSurp: null },
    { period: 'FY 25E', rev: 421.7, eps: 7.18, revSurp: null },
  ],
};

const SCREENER_DATA = [
  { symbol: 'NVDA', name: 'NVIDIA', price: 875.40, chg: 4.21, mcap: '2.16T', pe: 68.2, vol: '42.1M', sector: 'Tech' },
  { symbol: 'MSFT', name: 'Microsoft', price: 415.32, chg: 1.02, mcap: '3.09T', pe: 35.4, vol: '18.7M', sector: 'Tech' },
  { symbol: 'META', name: 'Meta', price: 513.84, chg: 2.34, mcap: '1.32T', pe: 27.1, vol: '14.2M', sector: 'Tech' },
  { symbol: 'AMZN', name: 'Amazon', price: 188.92, chg: -0.54, mcap: '1.97T', pe: 51.3, vol: '30.1M', sector: 'Consumer' },
  { symbol: 'TSLA', name: 'Tesla', price: 177.48, chg: -1.82, mcap: '565B', pe: 45.8, vol: '88.3M', sector: 'Auto' },
  { symbol: 'JPM', name: 'JPMorgan', price: 198.64, chg: 0.43, mcap: '574B', pe: 11.2, vol: '9.4M', sector: 'Finance' },
  { symbol: 'XOM', name: 'Exxon', price: 112.44, chg: -0.91, mcap: '451B', pe: 13.8, vol: '15.2M', sector: 'Energy' },
  { symbol: 'UNH', name: 'UnitedHealth', price: 491.32, chg: 0.77, mcap: '454B', pe: 21.4, vol: '4.1M', sector: 'Healthcare' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtPrice(n?: number | null): string {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toFixed(2);
}
function fmtPct(n?: number | null): string {
  if (n == null || isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function fmtVol(n?: number | null): string {
  if (!n) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
function corrColor(v: number) {
  if (v === 1) return '#7A8391';
  if (v > 0.5) return '#00D9FF';
  if (v > 0) return '#4CAF50';
  if (v > -0.5) return '#FF9800';
  return '#FF1744';
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

const CTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0F1432]/95 border border-[#00D9FF]/40 rounded p-2 text-xs font-mono">
      <p className="text-[#00D9FF] mb-1">{label}</p>
      {payload.map((e: any) => (
        <p key={e.dataKey} style={{ color: e.color }}>{e.name}: {typeof e.value === 'number' ? e.value.toFixed(2) : e.value}{e.unit ?? ''}</p>
      ))}
    </div>
  );
};

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const live = source === 'yahoo-finance';
  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ml-2 ${live ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
      {live ? '● LIVE' : 'FALLBACK'}
    </span>
  );
}

function PhasePill({ phase, label, icon: Icon, active, onClick }: {
  phase: Phase; label: string; icon: any; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-semibold transition-all whitespace-nowrap border ${
        active
          ? 'bg-primary/20 text-primary border-primary/60 shadow-[0_0_12px_rgba(0,217,255,0.15)]'
          : 'text-muted-foreground border-border/30 hover:border-primary/30 hover:text-foreground hover:bg-card/50'
      }`}>
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ─── Clickable MarketCard ────────────────────────────────────────────────────
// Now accepts an onClick so the parent can wire symbol selection.

function MarketCard({ asset, onClick }: { asset: MarketAsset; onClick?: () => void }) {
  const pct = asset.changePercent ?? 0;
  const price = asset.close ?? asset.price ?? 0;
  const pos = pct >= 0;
  const color = INDEX_COLORS[asset.symbol] ?? '#00D9FF';
  return (
    <div
      onClick={onClick}
      className="p-3 rounded-lg bg-card/50 border border-border/30 hover:border-primary/40 transition-all cursor-pointer group"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex justify-between items-start mb-1.5">
        <div>
          <div className="text-xs font-mono font-bold text-foreground">{asset.symbol}</div>
          {asset.name && <div className="text-[10px] text-muted-foreground">{asset.name}</div>}
        </div>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${pos ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
          {pos ? <TrendingUp className="inline h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="inline h-2.5 w-2.5 mr-0.5" />}
          {fmtPct(pct)}
        </span>
      </div>
      <div className="text-lg font-bold font-mono" style={{ color }}>{fmtPrice(price)}</div>
      <div className="flex justify-between mt-1 text-[9px] text-muted-foreground font-mono">
        {asset.high && asset.low && <span>H {fmtPrice(asset.high)} · L {fmtPrice(asset.low)}</span>}
        {asset.volume ? <span>{fmtVol(asset.volume)}</span> : null}
      </div>
      {/* Hover affordance */}
      <div className="mt-2 text-[9px] font-mono text-primary/0 group-hover:text-primary/60 transition-colors">
        Click to drill down →
      </div>
    </div>
  );
}

// TradingView embeds
function TVChart({ symbol, height = 220 }: { symbol: string; height?: number }) {
  const src = `https://s.tradingview.com/widgetembed/?frameElementId=tv_${symbol}`
    + `&symbol=${encodeURIComponent(symbol)}&interval=D&hidesidetoolbar=1`
    + `&hidetoptoolbar=0&saveimage=0&toolbarbg=0A0E27&theme=dark&style=2`
    + `&timezone=Etc%2FUTC&studies=STD%3BVolume&locale=en&allow_symbol_change=0`;
  return (
    <div style={{ height }} className="w-full rounded overflow-hidden bg-[#0A0E27]">
      <iframe key={symbol} src={src} style={{ width: '100%', height: '100%', border: 'none' }} title={symbol} />
    </div>
  );
}
function TVSPHeatmap({ height = 520 }: { height?: number }) {
  const cfg = encodeURIComponent(JSON.stringify({
    exchanges: [], dataSource: 'SPX500', grouping: 'sector',
    blockSize: 'market_cap_basic', blockColor: 'change',
    colorTheme: 'dark', hasTopBar: true, isZoomEnabled: true, hasSymbolTooltip: true,
  }));
  return (
    <div style={{ height }} className="w-full rounded overflow-hidden">
      <iframe src={`https://s.tradingview.com/embed-widget/stock-heatmap/?locale=en#${cfg}`}
        style={{ width: '100%', height: '100%', border: 'none' }} title="SP500 Heatmap" />
    </div>
  );
}
function TVScreenerEmbed({ height = 580 }: { height?: number }) {
  const cfg = encodeURIComponent(JSON.stringify({
    width: '100%', height: '100%', defaultColumn: 'overview',
    defaultScreen: 'most_capitalized', market: 'america',
    showToolbar: true, colorTheme: 'dark', locale: 'en',
  }));
  return (
    <div style={{ height }} className="w-full rounded overflow-hidden">
      <iframe src={`https://s.tradingview.com/embed-widget/screener/?locale=en#${cfg}`}
        style={{ width: '100%', height: '100%', border: 'none' }} title="Screener" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALL_ASSETS — unified pool used for search + drilldown
// ─────────────────────────────────────────────────────────────────────────────

function buildAllAssets(markets: MarketAsset[]): MarketAsset[] {
  const screener: MarketAsset[] = SCREENER_DATA.map(s => ({
    symbol: s.symbol, name: s.name, close: s.price, price: s.price,
    changePercent: s.chg, high: s.price * 1.015, low: s.price * 0.985,
    volume: parseFloat(s.vol) * 1e6,
  }));
  const seen = new Set(markets.map(m => m.symbol));
  return [...markets, ...screener.filter(s => !seen.has(s.symbol))];
}

// ─────────────────────────────────────────────────────────────────────────────
// SymbolDetailCard — full detail inline view shown after search/click
// ─────────────────────────────────────────────────────────────────────────────

function SymbolDetailCard({ symbol, asset, onClose, onGoDeep }: {
  symbol: string;
  asset?: MarketAsset;
  onClose: () => void;
  onGoDeep?: () => void;
}) {
  const [detailTab, setDetailTab] = useState<'overview' | 'chart' | 'options' | 'estimates'>('overview');
  const eq = MOCK_EQUITY_DETAIL;
  const price = asset?.close ?? asset?.price ?? eq.price;
  const pct   = asset?.changePercent ?? eq.changePercent;
  const name  = asset?.name ?? eq.name;
  const pos   = pct >= 0;
  const color = INDEX_COLORS[symbol] ?? '#00D9FF';

  return (
    <div className="glass-panel border border-primary/30 shadow-[0_0_24px_rgba(0,217,255,0.08)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/30 bg-primary/5">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs text-black"
            style={{ background: color }}>
            {symbol.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold font-mono text-primary">{symbol}</span>
              <span className="text-xs text-muted-foreground">{name}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xl font-bold font-mono text-foreground">${fmtPrice(price)}</span>
              <span className={`text-sm font-mono font-bold flex items-center gap-1 ${pos ? 'text-green-400' : 'text-red-400'}`}>
                {pos ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {fmtPct(pct)}
              </span>
              {asset?.high && asset?.low && (
                <span className="text-[10px] text-muted-foreground font-mono">H: {fmtPrice(asset.high)} · L: {fmtPrice(asset.low)}</span>
              )}
              {asset?.volume && (
                <span className="text-[10px] text-muted-foreground font-mono">Vol: {fmtVol(asset.volume)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onGoDeep && (
            <button onClick={onGoDeep}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary/20 border border-primary/40 text-xs font-mono text-primary hover:bg-primary/30 transition-colors">
              <ChevronRight className="h-3 w-3" /> Full Drilldown
            </button>
          )}
          <button onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors text-sm">
            ✕
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 px-5 pt-3 border-b border-border/20">
        {(['overview', 'chart', 'options', 'estimates'] as const).map(t => (
          <button key={t} onClick={() => setDetailTab(t)}
            className={`px-3 py-1.5 text-[11px] font-mono font-semibold rounded-t transition-colors border-b-2 -mb-px ${
              detailTab === t ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="p-5">
        {/* Overview */}
        {detailTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { label: 'P/E Ratio', value: eq.pe },
                { label: 'EPS (TTM)', value: `$${eq.eps}` },
                { label: 'Mkt Cap', value: eq.marketCap },
                { label: 'Beta', value: eq.beta },
                { label: 'Dividend', value: `$${eq.dividend}` },
                { label: 'Rev Growth', value: fmtPct(eq.revenueGrowth) },
              ].map(m => (
                <div key={m.label} className="p-2.5 rounded bg-card/60 border border-border/30 text-center">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">{m.label}</div>
                  <div className="text-sm font-bold font-mono text-foreground">{m.value}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Gross Margin', value: `${eq.grossMargin}%`, color: 'text-green-400' },
                { label: 'Debt/Equity', value: `${eq.debtToEquity}x`, color: 'text-amber-400' },
                { label: 'IV (30d)', value: `${eq.optionsIV}%`, color: 'text-cyan-400' },
              ].map(m => (
                <div key={m.label} className="p-3 rounded bg-card/50 border border-border/30 text-center">
                  <div className="text-[9px] text-muted-foreground uppercase mb-1">{m.label}</div>
                  <div className={`text-base font-bold font-mono ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground font-mono uppercase mb-2">Top Holders</div>
              <div className="space-y-1.5">
                {eq.ownership.slice(0, 3).map((o, i) => (
                  <div key={o.holder} className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-muted-foreground w-3">{i + 1}</span>
                    <span className="text-[11px] font-mono text-foreground flex-1">{o.holder}</span>
                    <div className="w-20 h-1 rounded-full bg-card overflow-hidden">
                      <div className="h-full rounded-full bg-primary/60" style={{ width: `${o.pct * 10}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-primary">{o.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chart */}
        {detailTab === 'chart' && (
          <TVChart symbol={symbol} height={300} />
        )}

        {/* Options */}
        {detailTab === 'options' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Implied Volatility', value: `${eq.optionsIV}%`, color: 'text-cyan-400' },
                { label: 'Put/Call Ratio', value: String(eq.putCallRatio), color: eq.putCallRatio < 1 ? 'text-green-400' : 'text-red-400' },
                { label: 'Max Pain', value: `$${eq.maxPain}`, color: 'text-amber-400' },
              ].map(m => (
                <div key={m.label} className="p-4 rounded-lg bg-card/60 border border-border/30 text-center">
                  <div className="text-[10px] text-muted-foreground font-mono mb-2 uppercase">{m.label}</div>
                  <div className={`text-xl font-bold font-mono ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-muted-foreground border-b border-border/30 text-[10px]">
                  <th className="text-right py-1.5 px-2">CALL OI</th>
                  <th className="text-right py-1.5 px-2">CALL IV</th>
                  <th className="text-center py-1.5 px-2 text-primary">STRIKE</th>
                  <th className="text-left py-1.5 px-2">PUT IV</th>
                  <th className="text-left py-1.5 px-2">PUT OI</th>
                </tr>
              </thead>
              <tbody>
                {[price * 0.975, price * 0.987, price, price * 1.013, price * 1.025].map((strike, idx) => (
                  <tr key={idx} className={`border-b border-border/20 ${idx === 2 ? 'bg-primary/5' : ''}`}>
                    <td className="text-right py-1.5 px-2 text-green-400">{(Math.random() * 5000 + 800 | 0)}</td>
                    <td className="text-right py-1.5 px-2 text-cyan-400">{(eq.optionsIV + (Math.random() - 0.5) * 4).toFixed(1)}%</td>
                    <td className="text-center py-1.5 px-2 font-bold text-primary">${fmtPrice(strike)}</td>
                    <td className="text-left py-1.5 px-2 text-cyan-400">{(eq.optionsIV + (Math.random() - 0.5) * 4).toFixed(1)}%</td>
                    <td className="text-left py-1.5 px-2 text-red-400">{(Math.random() * 5000 + 800 | 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Estimates */}
        {detailTab === 'estimates' && (
          <div className="space-y-3">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border/30 text-muted-foreground text-[10px]">
                  <th className="text-left py-2 px-3">PERIOD</th>
                  <th className="text-right py-2 px-3">REV EST</th>
                  <th className="text-right py-2 px-3">EPS EST</th>
                  <th className="text-right py-2 px-3">YoY REV</th>
                </tr>
              </thead>
              <tbody>
                {eq.estimates.map((e, i) => (
                  <tr key={e.period} className="border-b border-border/20 hover:bg-card/30">
                    <td className="py-2 px-3 font-bold text-foreground">{e.period}</td>
                    <td className="py-2 px-3 text-right text-cyan-400">${e.rev}B</td>
                    <td className="py-2 px-3 text-right text-green-400">${e.eps}</td>
                    <td className="py-2 px-3 text-right text-amber-400">+{(3 + i * 1.2).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded bg-card/50 border border-border/30">
                <div className="text-[9px] text-muted-foreground uppercase mb-1">Analyst Consensus</div>
                <div className="text-sm font-bold text-green-400">BUY</div>
                <div className="text-[10px] text-muted-foreground">28 buy · 5 hold · 1 sell</div>
              </div>
              <div className="p-3 rounded bg-card/50 border border-border/30">
                <div className="text-[9px] text-muted-foreground uppercase mb-1">12-Month PT</div>
                <div className="text-sm font-bold text-cyan-400">${fmtPrice(price * 1.18)}</div>
                <div className="text-[10px] text-muted-foreground">+{fmtPct(18)} upside</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — Command Spine
// Accepts onSelectSymbol + selectedSymbol to show inline detail card
// ─────────────────────────────────────────────────────────────────────────────

function CommandSpinePanel({
  markets, sectors, source, loading, onRefresh, onSelectSymbol,
  selectedSymbol, allAssets, onGoDeep,
}: {
  markets: MarketAsset[]; sectors: SectorData[];
  source?: string; loading: boolean; onRefresh: () => void;
  onSelectSymbol: (symbol: string) => void;
  selectedSymbol: string | null;
  allAssets: MarketAsset[];
  onGoDeep: (symbol: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [hotkeys] = useState([
    { key: 'G M', desc: 'Go to Markets' }, { key: 'G S', desc: 'Go to Sectors' },
    { key: 'G H', desc: 'Go to Heatmap' }, { key: '/', desc: 'Open search' },
    { key: 'R', desc: 'Refresh data' }, { key: 'ESC', desc: 'Close panel' },
  ]);

  // Unified search pool: live markets + screener data
  const searchPool: MarketAsset[] = [
    ...markets,
    ...SCREENER_DATA
      .filter(s => !markets.find(m => m.symbol === s.symbol))
      .map(s => ({ symbol: s.symbol, name: s.name, changePercent: s.chg, close: s.price })),
  ];

  const suggestions = query.length > 0
    ? searchPool
        .filter(a =>
          a.symbol.toLowerCase().includes(query.toLowerCase()) ||
          (a.name ?? '').toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 6)
    : [];

  // Find selected asset object for SymbolDetailCard
  const selectedAsset = selectedSymbol
    ? allAssets.find(a => a.symbol === selectedSymbol)
    : undefined;

  const handleSearchSelect = (symbol: string) => {
    onSelectSymbol(symbol);
    setQuery('');
    setCmdOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Command bar */}
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-primary font-mono">COMMAND BAR</h3>
          <SourceBadge source={source} />
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setCmdOpen(true); }}
            onFocus={() => setCmdOpen(true)}
            onBlur={() => setTimeout(() => setCmdOpen(false), 200)}
            placeholder="Search ticker, name, sector…  ( / )"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-card/80 border border-border/40 focus:border-primary/60 focus:outline-none text-sm font-mono placeholder-muted-foreground text-foreground transition-all"
          />
          {cmdOpen && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0A0E27] border border-primary/30 rounded-lg overflow-hidden z-50 shadow-2xl">
              {suggestions.map(s => {
                const pct = s.changePercent ?? 0;
                return (
                  <div
                    key={s.symbol}
                    onMouseDown={() => handleSearchSelect(s.symbol)}   // ← wired
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-primary/10 cursor-pointer transition-colors border-b border-border/20 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-primary w-14">{s.symbol}</span>
                      <span className="text-xs text-muted-foreground">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-foreground">{fmtPrice(s.close ?? (s as any).price)}</span>
                      <span className={`text-xs font-mono ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtPct(pct)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Security context strip — chips are clickable */}
        <div className="flex flex-wrap gap-2 mb-4">
          {markets.slice(0, 6).map(m => {
            const pct = m.changePercent ?? 0;
            const isActive = selectedSymbol === m.symbol;
            return (
              <button
                key={m.symbol}
                onClick={() => onSelectSymbol(m.symbol)}   // ← wired
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border cursor-pointer transition-all ${
                  isActive
                    ? 'border-primary/60 bg-primary/15 text-primary'
                    : 'border-border/30 bg-card/60 hover:border-primary/40 hover:bg-card/80'
                }`}
              >
                <span className="text-[10px] font-mono font-bold text-muted-foreground">{m.symbol}</span>
                <span className="text-[11px] font-mono text-foreground">{fmtPrice(m.close ?? m.price)}</span>
                <span className={`text-[10px] font-mono ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtPct(pct)}</span>
              </button>
            );
          })}
          <button onClick={onRefresh} disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-card/60 border border-border/30 text-[10px] font-mono text-muted-foreground hover:text-primary hover:border-primary/40 transition-all disabled:opacity-40">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
        </div>

        {/* Hotkeys */}
        <div>
          <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-widest">Keyboard Shortcuts</div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {hotkeys.map(h => (
              <div key={h.key} className="flex flex-col gap-0.5 p-2 rounded bg-card/40 border border-border/20">
                <kbd className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded w-fit">{h.key}</kbd>
                <span className="text-[9px] text-muted-foreground leading-tight">{h.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inline SymbolDetailCard — shown when a symbol is selected */}
      {selectedSymbol && (
        <SymbolDetailCard
          symbol={selectedSymbol}
          asset={selectedAsset}
          onClose={() => onSelectSymbol('')}   // empty string = deselect
          onGoDeep={() => onGoDeep(selectedSymbol)}
        />
      )}

      {/* Market overview cards */}
      <div className="glass-panel p-5">
        <h4 className="text-xs font-mono font-bold text-primary mb-3">MARKET OVERVIEW</h4>
        {loading ? (
          <div className="grid grid-cols-4 gap-3 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 rounded bg-card/50" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {markets.length > 0
              ? markets.map(m => (
                  <MarketCard
                    key={m.symbol}
                    asset={m}
                    onClick={() => onSelectSymbol(m.symbol)}   // ← wired
                  />
                ))
              : <p className="col-span-4 text-sm text-muted-foreground">No market data available.</p>
            }
          </div>
        )}
      </div>

      {/* Live index charts */}
      <div className="glass-panel p-5">
        <h4 className="text-xs font-mono font-bold text-primary mb-4">LIVE INDEX CHARTS</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['SPY', 'QQQ', 'GLD', 'VIX'].map(sym => (
            <div key={sym}>
              <div className="text-[10px] font-mono text-muted-foreground mb-1">{sym}</div>
              <TVChart symbol={sym} height={200} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — Click-through Drilldown
// Now driven by initialSymbol prop so parent can pre-select a symbol
// ─────────────────────────────────────────────────────────────────────────────

function DrilldownPanel({ markets, initialSymbol }: { markets: MarketAsset[]; initialSymbol?: string }) {
  const [selected, setSelected] = useState<string>(initialSymbol ?? 'AAPL');
  const eq = MOCK_EQUITY_DETAIL;

  // Sync if parent changes the initial symbol (e.g. user clicked from Command)
  useEffect(() => {
    if (initialSymbol) setSelected(initialSymbol);
  }, [initialSymbol]);

  // Build unified row list
  const rows = [
    ...markets,
    ...SCREENER_DATA
      .filter(s => !markets.find(m => m.symbol === s.symbol))
      .map(s => ({
        symbol: s.symbol, name: s.name, close: s.price,
        changePercent: s.chg, high: s.price * 1.015, low: s.price * 0.985,
        volume: parseFloat(s.vol) * 1e6,
      })),
  ].slice(0, 12);

  return (
    <div className="space-y-6">
      {/* Drillable index table */}
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-primary font-mono">DRILLABLE TICKERS & VALUES</h3>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono mb-4">Click any row to drill into full depth view</p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border/30 text-muted-foreground text-[10px]">
                <th className="text-left py-2 px-3">SYMBOL</th>
                <th className="text-left py-2 px-3">NAME</th>
                <th className="text-right py-2 px-3">PRICE</th>
                <th className="text-right py-2 px-3">CHG%</th>
                <th className="text-right py-2 px-3">HIGH</th>
                <th className="text-right py-2 px-3">LOW</th>
                <th className="text-right py-2 px-3">VOL</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(a => {
                const pct = a.changePercent ?? 0;
                const isSelected = selected === a.symbol;
                return (
                  <tr key={a.symbol}
                    onClick={() => setSelected(a.symbol)}
                    className={`border-b border-border/20 cursor-pointer transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-card/40'}`}>
                    <td className="py-2 px-3 font-bold text-primary">{a.symbol}</td>
                    <td className="py-2 px-3 text-muted-foreground">{a.name ?? '—'}</td>
                    <td className="py-2 px-3 text-right text-foreground">{fmtPrice(a.close ?? (a as any).price)}</td>
                    <td className={`py-2 px-3 text-right font-bold ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtPct(pct)}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{fmtPrice(a.high)}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{fmtPrice(a.low)}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{fmtVol(a.volume)}</td>
                    <td className="py-2 px-3">
                      <ChevronRight className={`h-3 w-3 transition-transform ${isSelected ? 'text-primary rotate-90' : 'text-muted-foreground'}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drilldown detail panel */}
      <div className="glass-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold font-mono text-primary">{eq.symbol}</span>
                <span className="text-sm text-muted-foreground">{eq.name}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-2xl font-bold font-mono text-foreground">${fmtPrice(eq.price)}</span>
                <span className={`text-sm font-mono font-bold ${eq.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPct(eq.changePercent)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-primary/10 border border-primary/30 text-xs font-mono text-primary hover:bg-primary/20 transition-colors">
              <Star className="h-3 w-3" /> Watchlist
            </button>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-card/50 border border-border/30 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="h-3 w-3" /> Full Page
            </button>
          </div>
        </div>

        {/* Key metrics grid */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
          {[
            { label: 'P/E', value: eq.pe },
            { label: 'EPS', value: `$${eq.eps}` },
            { label: 'Mkt Cap', value: eq.marketCap },
            { label: 'Beta', value: eq.beta },
            { label: 'Div Yield', value: `$${eq.dividend}` },
            { label: 'Rev Growth', value: fmtPct(eq.revenueGrowth) },
          ].map(m => (
            <div key={m.label} className="p-2.5 rounded bg-card/50 border border-border/30 text-center">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">{m.label}</div>
              <div className="text-sm font-bold font-mono text-foreground">{m.value}</div>
            </div>
          ))}
        </div>

        {/* TV chart for selected */}
        <TVChart symbol={selected} height={240} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — Equity Depth Data
// ─────────────────────────────────────────────────────────────────────────────

function EquityDepthPanel() {
  const [activeTab, setActiveTab] = useState<'options' | 'ownership' | 'estimates' | 'financials'>('options');
  const eq = MOCK_EQUITY_DETAIL;

  return (
    <div className="space-y-6">
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-primary font-mono">EQUITY DEPTH — {eq.symbol}</h3>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto">
          {(['options', 'ownership', 'estimates', 'financials'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold whitespace-nowrap transition-all border ${
                activeTab === t ? 'bg-primary/20 text-primary border-primary/50' : 'text-muted-foreground border-border/30 hover:bg-card/50'
              }`}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Options */}
        {activeTab === 'options' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Implied Volatility', value: `${eq.optionsIV}%`, color: 'text-cyan-400' },
                { label: 'Put/Call Ratio', value: eq.putCallRatio, color: eq.putCallRatio < 1 ? 'text-green-400' : 'text-red-400' },
                { label: 'Max Pain', value: `$${eq.maxPain}`, color: 'text-amber-400' },
              ].map(m => (
                <div key={m.label} className="p-4 rounded-lg bg-card/60 border border-border/30 text-center">
                  <div className="text-[10px] text-muted-foreground font-mono mb-2 uppercase">{m.label}</div>
                  <div className={`text-2xl font-bold font-mono ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>
            <div className="p-4 rounded-lg bg-card/40 border border-border/20">
              <div className="text-[10px] text-muted-foreground font-mono mb-3 uppercase">Options Chain Snapshot (ATM Strikes)</div>
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/30">
                    <th className="text-right py-1.5 px-2">CALL OI</th>
                    <th className="text-right py-1.5 px-2">CALL IV</th>
                    <th className="text-center py-1.5 px-2 text-primary">STRIKE</th>
                    <th className="text-left py-1.5 px-2">PUT IV</th>
                    <th className="text-left py-1.5 px-2">PUT OI</th>
                  </tr>
                </thead>
                <tbody>
                  {[185, 187.5, 190, 192.5, 195].map(strike => (
                    <tr key={strike} className={`border-b border-border/20 ${strike === 190 ? 'bg-primary/5' : ''}`}>
                      <td className="text-right py-1.5 px-2 text-green-400">{(Math.random() * 5000 + 1000).toFixed(0)}</td>
                      <td className="text-right py-1.5 px-2 text-cyan-400">{(eq.optionsIV + (Math.random() - 0.5) * 4).toFixed(1)}%</td>
                      <td className="text-center py-1.5 px-2 font-bold text-primary">${strike}</td>
                      <td className="text-left py-1.5 px-2 text-cyan-400">{(eq.optionsIV + (Math.random() - 0.5) * 4).toFixed(1)}%</td>
                      <td className="text-left py-1.5 px-2 text-red-400">{(Math.random() * 5000 + 1000).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ownership */}
        {activeTab === 'ownership' && (
          <div className="space-y-3">
            <div className="text-[10px] text-muted-foreground font-mono uppercase mb-3">Top Institutional Holders</div>
            {eq.ownership.map((o, i) => (
              <div key={o.holder} className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-muted-foreground w-4">{i + 1}</span>
                <span className="text-xs font-mono text-foreground flex-1">{o.holder}</span>
                <div className="w-32 h-1.5 rounded-full bg-card overflow-hidden">
                  <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${o.pct * 10}%` }} />
                </div>
                <span className="text-xs font-mono text-primary w-10 text-right">{o.pct}%</span>
              </div>
            ))}
            <div className="mt-4 p-3 rounded bg-card/40 border border-border/20">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><div className="text-[10px] text-muted-foreground mb-1">Gross Margin</div><div className="text-sm font-bold text-green-400">{eq.grossMargin}%</div></div>
                <div><div className="text-[10px] text-muted-foreground mb-1">Debt/Equity</div><div className="text-sm font-bold text-amber-400">{eq.debtToEquity}x</div></div>
                <div><div className="text-[10px] text-muted-foreground mb-1">Rev Growth</div><div className="text-sm font-bold text-cyan-400">{fmtPct(eq.revenueGrowth)}</div></div>
              </div>
            </div>
          </div>
        )}

        {/* Estimates */}
        {activeTab === 'estimates' && (
          <div>
            <div className="text-[10px] text-muted-foreground font-mono uppercase mb-3">Consensus Estimates</div>
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border/30 text-muted-foreground text-[10px]">
                  <th className="text-left py-2 px-3">PERIOD</th>
                  <th className="text-right py-2 px-3">REV EST ($B)</th>
                  <th className="text-right py-2 px-3">EPS EST</th>
                </tr>
              </thead>
              <tbody>
                {eq.estimates.map(e => (
                  <tr key={e.period} className="border-b border-border/20 hover:bg-card/30">
                    <td className="py-2 px-3 text-foreground font-bold">{e.period}</td>
                    <td className="py-2 px-3 text-right text-cyan-400">${e.rev}B</td>
                    <td className="py-2 px-3 text-right text-green-400">${e.eps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Financials */}
        {activeTab === 'financials' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Revenue (TTM)', value: '$394.1B', delta: '+2.0%' },
                { label: 'Net Income', value: '$99.8B', delta: '+3.1%' },
                { label: 'Free Cash Flow', value: '$107.0B', delta: '+9.4%' },
                { label: 'R&D Spend', value: '$29.9B', delta: '+12.2%' },
              ].map(f => (
                <div key={f.label} className="p-3 rounded bg-card/60 border border-border/30">
                  <div className="text-[9px] text-muted-foreground uppercase mb-1">{f.label}</div>
                  <div className="text-base font-bold font-mono text-foreground">{f.value}</div>
                  <div className="text-[10px] text-green-400 font-mono">{f.delta} YoY</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — Cross-Asset Depth Data
// ─────────────────────────────────────────────────────────────────────────────

function CrossAssetPanel() {
  return (
    <div className="space-y-6">
      {/* Yield Curve */}
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-primary font-mono">US TREASURY YIELD CURVE</h3>
        </div>
        {(() => {
          const spread = YIELD_DATA[8].current - YIELD_DATA[4].current;
          const isInverted = spread < 0;
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                <span className={`px-3 py-1 rounded-full border text-xs ${isInverted ? 'bg-red-500/15 border-red-500/40 text-red-400' : 'bg-green-500/15 border-green-500/40 text-green-400'}`}>
                  {isInverted ? '⚠ INVERTED' : '✓ NORMAL'}
                </span>
                <span className="text-muted-foreground">10Y–2Y Spread: <span className={isInverted ? 'text-red-400' : 'text-green-400'}>{fmtPct(spread)}</span></span>
                <span className="text-muted-foreground">2Y: <span className="text-cyan-400">{YIELD_DATA[4].current}%</span></span>
                <span className="text-muted-foreground">10Y: <span className="text-cyan-400">{YIELD_DATA[8].current}%</span></span>
                <span className="text-muted-foreground">30Y: <span className="text-cyan-400">{YIELD_DATA[10].current}%</span></span>
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={YIELD_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#00D9FF" strokeOpacity={0.08} />
                    <XAxis dataKey="tenor" stroke="#7A8391" style={{ fontSize: 11 }} />
                    <YAxis stroke="#7A8391" style={{ fontSize: 11 }} unit="%" domain={['auto', 'auto']} />
                    <Tooltip content={<CTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="current" stroke="#00D9FF" strokeWidth={2.5} dot={{ fill: '#00D9FF', r: 4 }} name="Current" />
                    <Line type="monotone" dataKey="prev" stroke="#FFB74D" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Prev Week" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-6 md:grid-cols-11 gap-1.5">
                {YIELD_DATA.map(d => {
                  const chg = d.current - d.prev;
                  return (
                    <div key={d.tenor} className="p-2 rounded bg-card/50 border border-border/30 text-center">
                      <div className="text-[9px] text-muted-foreground font-mono">{d.tenor}</div>
                      <div className="text-xs font-bold text-cyan-400">{d.current}%</div>
                      <div className={`text-[9px] font-mono ${chg >= 0 ? 'text-green-400' : 'text-red-400'}`}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* FX Volatility Surface */}
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-primary font-mono">FX VOLATILITY SURFACE</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border/30 text-muted-foreground text-[10px]">
                <th className="text-left py-2 px-3">PAIR</th>
                <th className="text-right py-2 px-3">SPOT</th>
                <th className="text-right py-2 px-3">1M VOL</th>
                <th className="text-right py-2 px-3">3M VOL</th>
                <th className="text-right py-2 px-3">1Y VOL</th>
                <th className="text-right py-2 px-3">TERM SLOPE</th>
              </tr>
            </thead>
            <tbody>
              {FX_VOL_DATA.map(f => {
                const slope = f.vol1y - f.vol1m;
                return (
                  <tr key={f.pair} className="border-b border-border/20 hover:bg-card/30">
                    <td className="py-2 px-3 font-bold text-primary">{f.pair}</td>
                    <td className="py-2 px-3 text-right text-foreground">{f.spot.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right text-cyan-400">{f.vol1m.toFixed(1)}%</td>
                    <td className="py-2 px-3 text-right text-cyan-300">{f.vol3m.toFixed(1)}%</td>
                    <td className="py-2 px-3 text-right text-cyan-200">{f.vol1y.toFixed(1)}%</td>
                    <td className={`py-2 px-3 text-right font-bold ${slope >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {slope >= 0 ? '+' : ''}{slope.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ height: 180 }} className="mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={FX_VOL_DATA} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00D9FF" strokeOpacity={0.07} />
              <XAxis dataKey="pair" stroke="#7A8391" style={{ fontSize: 10 }} />
              <YAxis stroke="#7A8391" style={{ fontSize: 10 }} unit="%" />
              <Tooltip content={<CTooltip />} />
              <Legend />
              <Bar dataKey="vol1m" name="1M Vol" fill="#00D9FF" opacity={0.85} radius={[2, 2, 0, 0]} />
              <Bar dataKey="vol3m" name="3M Vol" fill="#4CAF50" opacity={0.85} radius={[2, 2, 0, 0]} />
              <Bar dataKey="vol1y" name="1Y Vol" fill="#FFD700" opacity={0.85} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Oil Futures Curve */}
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-primary font-mono">WTI OIL FUTURES CURVE (CONTANGO/BACKWARDATION)</h3>
        </div>
        {(() => {
          const isContango = FUTURES_CURVE[FUTURES_CURVE.length - 1].price < FUTURES_CURVE[0].price ? false : true;
          return (
            <div className="space-y-3">
              <span className={`text-xs font-mono px-3 py-1 rounded-full border ${isContango ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'bg-green-500/15 border-green-500/40 text-green-400'}`}>
                {isContango ? 'CONTANGO' : 'BACKWARDATION'}
              </span>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={FUTURES_CURVE} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#00D9FF" strokeOpacity={0.07} />
                    <XAxis dataKey="month" stroke="#7A8391" style={{ fontSize: 10 }} />
                    <YAxis stroke="#7A8391" style={{ fontSize: 10 }} domain={['auto', 'auto']} unit="$" />
                    <Tooltip content={<CTooltip />} />
                    <Area type="monotone" dataKey="price" name="Price" stroke="#FF5722" fill="#FF5722" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Correlation Matrix */}
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-primary font-mono">CROSS-ASSET CORRELATION MATRIX</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center font-mono">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left px-3 py-2 text-muted-foreground">Asset</th>
                {['SPX', 'DXY', 'Gold', 'Oil', 'BTC', 'VIX'].map(a => (
                  <th key={a} className="px-3 py-2 text-muted-foreground">{a}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CORR.map(row => (
                <tr key={row.name} className="border-b border-border/30 hover:bg-card/20">
                  <td className="text-left px-3 py-2 font-bold text-foreground">{row.name}</td>
                  {['SPX', 'DXY', 'Gold', 'Oil', 'BTC', 'VIX'].map(a => {
                    const val = (row as any)[a];
                    return <td key={a} className="px-3 py-2 font-bold" style={{ color: corrColor(val) }}>{val.toFixed(2)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 5 — Real-time & Alerts
// ─────────────────────────────────────────────────────────────────────────────

function RealtimePanel({ markets, source }: { markets: MarketAsset[]; source?: string }) {
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [ticker, setTicker] = useState(0);
  const [newAlert, setNewAlert] = useState('');
  const [streamActive, setStreamActive] = useState(true);

  useEffect(() => {
    if (!streamActive) return;
    const id = setInterval(() => setTicker(t => t + 1), 2000);
    return () => clearInterval(id);
  }, [streamActive]);

  const dismissAlert = (id: number) => setAlerts(a => a.filter(al => al.id !== id));

  const severityColor = (s: string) =>
    s === 'high'   ? 'text-red-400 border-red-500/30 bg-red-500/10' :
    s === 'medium' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
                     'text-green-400 border-green-500/30 bg-green-500/10';

  return (
    <div className="space-y-6">
      {/* Streaming ticks */}
      <div className="glass-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className={`h-4 w-4 ${streamActive ? 'text-green-400 animate-pulse' : 'text-muted-foreground'}`} />
            <h3 className="text-sm font-bold text-primary font-mono">STREAMING TICKS</h3>
          </div>
          <button onClick={() => setStreamActive(s => !s)}
            className={`text-xs font-mono px-3 py-1.5 rounded border transition-colors ${streamActive ? 'text-green-400 border-green-500/30 bg-green-500/10 hover:bg-green-500/20' : 'text-muted-foreground border-border/30 hover:bg-card/50'}`}>
            {streamActive ? '● LIVE' : '○ PAUSED'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {markets.slice(0, 8).map(m => {
            const pct = m.changePercent ?? 0;
            const jitter = streamActive ? (Math.random() - 0.5) * 0.04 : 0;
            const displayPct = pct + jitter;
            return (
              <div key={m.symbol} className="p-3 rounded bg-card/50 border border-border/30 hover:border-primary/30 transition-all">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono font-bold text-primary">{m.symbol}</span>
                  <span className={`text-[9px] font-mono ${displayPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {displayPct >= 0 ? '▲' : '▼'} {Math.abs(displayPct).toFixed(2)}%
                  </span>
                </div>
                <div className="text-base font-bold font-mono text-foreground mt-1">
                  {fmtPrice((m.close ?? m.price ?? 0) * (1 + jitter / 100))}
                </div>
                <div className="mt-1.5 h-0.5 w-full rounded bg-card overflow-hidden">
                  <div className={`h-full rounded transition-all duration-300 ${displayPct >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(Math.abs(displayPct) * 25 + 20, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alerts panel */}
      <div className="glass-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-primary font-mono">NEWS NLP + PRICE ALERTS</h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-1 rounded bg-primary/10 border border-primary/30 text-primary">
            {alerts.length} active
          </span>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            value={newAlert}
            onChange={e => setNewAlert(e.target.value)}
            placeholder="e.g. SPX > 5200, AAPL earnings…"
            className="flex-1 px-3 py-2 rounded bg-card/80 border border-border/40 focus:border-primary/60 focus:outline-none text-xs font-mono placeholder-muted-foreground text-foreground"
          />
          <button className="flex items-center gap-1.5 px-3 py-2 rounded bg-primary/20 border border-primary/40 text-xs font-mono text-primary hover:bg-primary/30 transition-colors">
            <Bell className="h-3 w-3" /> Set Alert
          </button>
        </div>

        <div className="space-y-2">
          {alerts.map(al => (
            <div key={al.id} className={`flex items-start justify-between p-3 rounded border ${severityColor(al.severity)}`}>
              <div className="flex items-start gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-mono uppercase opacity-70">{al.type}</span>
                    <span className="text-[10px] font-mono font-bold">{al.symbol}</span>
                    <span className="text-[9px] text-muted-foreground">{al.time}</span>
                  </div>
                  <p className="text-xs font-mono">{al.msg}</p>
                </div>
              </div>
              <button onClick={() => dismissAlert(al.id)} className="text-muted-foreground hover:text-foreground text-[10px] ml-3 flex-shrink-0">✕</button>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-xs font-mono">No active alerts</div>
          )}
        </div>
      </div>

      {/* Push alert settings */}
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-primary font-mono">PUSH ALERT SETTINGS</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { label: 'Price breakout alerts', desc: 'Notify when ticker crosses key levels', enabled: true },
            { label: 'Earnings surprises', desc: 'EPS/Rev beat or miss vs consensus', enabled: true },
            { label: 'VIX spikes', desc: 'Alert when VIX moves >10% intraday', enabled: false },
            { label: 'Fed/macro news', desc: 'NLP-parsed policy headlines', enabled: true },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between p-3 rounded bg-card/50 border border-border/30">
              <div>
                <div className="text-xs font-mono font-semibold text-foreground">{s.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</div>
              </div>
              <div className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${s.enabled ? 'bg-primary/60' : 'bg-border/40'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${s.enabled ? 'left-[18px]' : 'left-0.5'}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 6 — Pro Workspace
// ─────────────────────────────────────────────────────────────────────────────

function ProWorkspacePanel({ sectors, source }: { sectors: SectorData[]; source?: string }) {
  const [activePanel, setActivePanel] = useState<'screener' | 'portfolio' | 'heatmap' | 'charting'>('screener');
  const [sortBy, setSortBy] = useState<'chg' | 'mcap' | 'pe'>('chg');
  const [filterSector, setFilterSector] = useState('All');

  const sortedData = [...SCREENER_DATA]
    .filter(s => filterSector === 'All' || s.sector === filterSector)
    .sort((a, b) => {
      if (sortBy === 'chg') return Math.abs(b.chg) - Math.abs(a.chg);
      if (sortBy === 'mcap') return a.mcap.localeCompare(b.mcap) * -1;
      return b.pe - a.pe;
    });

  const panels = [
    { id: 'screener'  as const, label: 'Screener',  icon: Filter   },
    { id: 'portfolio' as const, label: 'Portfolio', icon: PieChart  },
    { id: 'heatmap'   as const, label: 'Heatmap',   icon: Layers   },
    { id: 'charting'  as const, label: 'Charting',  icon: BarChart2 },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-primary font-mono">PRO WORKSPACE</h3>
          <SourceBadge source={source} />
        </div>

        <div className="flex gap-2 mb-5 overflow-x-auto">
          {panels.map(p => (
            <button key={p.id} onClick={() => setActivePanel(p.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono font-semibold whitespace-nowrap transition-all border ${
                activePanel === p.id ? 'bg-primary/20 text-primary border-primary/50' : 'text-muted-foreground border-border/30 hover:bg-card/50'
              }`}>
              <p.icon className="h-3.5 w-3.5" />
              {p.label}
            </button>
          ))}
        </div>

        {/* Screener */}
        {activePanel === 'screener' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground">SORT:</span>
              {(['chg', 'mcap', 'pe'] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors border ${sortBy === s ? 'bg-primary/20 text-primary border-primary/40' : 'text-muted-foreground border-border/30'}`}>
                  {s.toUpperCase()}
                </button>
              ))}
              <span className="text-[10px] font-mono text-muted-foreground ml-2">SECTOR:</span>
              {['All', 'Tech', 'Finance', 'Energy'].map(s => (
                <button key={s} onClick={() => setFilterSector(s)}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors border ${filterSector === s ? 'bg-primary/20 text-primary border-primary/40' : 'text-muted-foreground border-border/30'}`}>
                  {s}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground text-[10px]">
                    <th className="text-left py-2 px-3">SYMBOL</th>
                    <th className="text-left py-2 px-3">NAME</th>
                    <th className="text-right py-2 px-3">PRICE</th>
                    <th className="text-right py-2 px-3">CHG%</th>
                    <th className="text-right py-2 px-3">MCAP</th>
                    <th className="text-right py-2 px-3">P/E</th>
                    <th className="text-right py-2 px-3">VOL</th>
                    <th className="text-right py-2 px-3">SECTOR</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map(s => (
                    <tr key={s.symbol} className="border-b border-border/20 hover:bg-card/40 cursor-pointer">
                      <td className="py-2 px-3 font-bold text-primary">{s.symbol}</td>
                      <td className="py-2 px-3 text-muted-foreground">{s.name}</td>
                      <td className="py-2 px-3 text-right text-foreground">${fmtPrice(s.price)}</td>
                      <td className={`py-2 px-3 text-right font-bold ${s.chg >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtPct(s.chg)}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{s.mcap}</td>
                      <td className="py-2 px-3 text-right text-cyan-400">{s.pe}x</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{s.vol}</td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{s.sector}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Portfolio */}
        {activePanel === 'portfolio' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Value',   value: '$284,382', delta: '+$4,291 today', pos: true },
                { label: 'Day P&L',       value: '+$4,291',  delta: '+1.53%',         pos: true },
                { label: 'Total Return',  value: '+$51,240', delta: '+22.0% all time', pos: true },
              ].map(c => (
                <div key={c.label} className="p-4 rounded-lg bg-card/60 border border-border/30 text-center">
                  <div className="text-[10px] text-muted-foreground font-mono uppercase mb-1">{c.label}</div>
                  <div className={`text-xl font-bold font-mono ${c.pos ? 'text-green-400' : 'text-red-400'}`}>{c.value}</div>
                  <div className={`text-[10px] font-mono ${c.pos ? 'text-green-400/70' : 'text-red-400/70'}`}>{c.delta}</div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground text-[10px]">
                    <th className="text-left py-2 px-3">SYMBOL</th>
                    <th className="text-right py-2 px-3">QTY</th>
                    <th className="text-right py-2 px-3">AVG COST</th>
                    <th className="text-right py-2 px-3">CURRENT</th>
                    <th className="text-right py-2 px-3">VALUE</th>
                    <th className="text-right py-2 px-3">P&L</th>
                    <th className="text-right py-2 px-3">WEIGHT</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { sym: 'AAPL', qty: 50, cost: 155.20, cur: 189.42, wt: 33.3 },
                    { sym: 'NVDA', qty: 20, cost: 480.30, cur: 875.40, wt: 27.5 },
                    { sym: 'MSFT', qty: 30, cost: 310.00, cur: 415.32, wt: 21.9 },
                    { sym: 'JPM',  qty: 40, cost: 150.80, cur: 198.64, wt: 17.3 },
                  ].map(p => {
                    const pl    = (p.cur - p.cost) * p.qty;
                    const plPct = ((p.cur - p.cost) / p.cost) * 100;
                    return (
                      <tr key={p.sym} className="border-b border-border/20 hover:bg-card/30">
                        <td className="py-2 px-3 font-bold text-primary">{p.sym}</td>
                        <td className="py-2 px-3 text-right text-foreground">{p.qty}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">${fmtPrice(p.cost)}</td>
                        <td className="py-2 px-3 text-right text-foreground">${fmtPrice(p.cur)}</td>
                        <td className="py-2 px-3 text-right text-foreground">${fmtPrice(p.cur * p.qty)}</td>
                        <td className={`py-2 px-3 text-right font-bold ${pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${fmtPrice(pl)} ({fmtPct(plPct)})
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{p.wt}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Heatmap */}
        {activePanel === 'heatmap' && (
          <div className="space-y-4">
            <p className="text-[10px] text-muted-foreground font-mono">S&P 500 live heatmap — size = market cap · color = daily % change</p>
            <TVSPHeatmap height={500} />
          </div>
        )}

        {/* Charting */}
        {activePanel === 'charting' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
              {['SPY', 'QQQ', 'IWM', 'DIA'].map(sym => (
                <div key={sym}>
                  <div className="text-[9px] font-mono text-muted-foreground mb-1">{sym}</div>
                  <TVChart symbol={sym} height={180} />
                </div>
              ))}
            </div>
            <div>
              <div className="text-[9px] font-mono text-muted-foreground mb-1">FULL CHART — SPX</div>
              <TVChart symbol="SPX" height={320} />
            </div>
          </div>
        )}
      </div>

      {activePanel === 'screener' && (
        <div className="glass-panel p-5">
          <h4 className="text-xs font-mono font-bold text-primary mb-4">LIVE TV SCREENER</h4>
          <TVScreenerEmbed height={560} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main MarketsTab
// Owns selectedSymbol state; wires Command → Drilldown navigation
// ─────────────────────────────────────────────────────────────────────────────

export function MarketsTab() {
  const [activePhase, setActivePhase]       = useState<Phase>('command');
  const [markets, setMarkets]               = useState<MarketAsset[]>([]);
  const [sectors, setSectors]               = useState<SectorData[]>([]);
  const [source, setSource]                 = useState<string | undefined>();
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [updatedAt, setUpdatedAt]           = useState<string | null>(null);
  // ── NEW: lifted symbol selection ────────────────────────────────────────────
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/data/markets?real=true', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json: MarketsApiResponse = await res.json();
      if (!json.success) throw new Error('API error');
      setMarkets(json.data.markets ?? []);
      setSectors(json.data.sectors ?? []);
      setSource(json.data.source);
      setUpdatedAt(json.data.timestamp);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Called from Command panel: select a symbol and show its inline detail card.
  // Empty string = deselect (close card).
  const handleSelectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol || null);
  };

  // Called from SymbolDetailCard's "Full Drilldown" button:
  // sets symbol and navigates to the Drilldown phase.
  const handleGoDeep = (symbol: string) => {
    setSelectedSymbol(symbol);
    setActivePhase('drilldown');
  };

  // Unified asset pool for search resolution
  const allAssets = buildAllAssets(markets);

  const phases: { id: Phase; label: string; icon: any; badge: string }[] = [
    { id: 'command',      label: 'Command',      icon: Terminal,    badge: '1' },
    { id: 'drilldown',    label: 'Drilldown',    icon: ChevronDown, badge: '2' },
    { id: 'equity',       label: 'Equity Depth', icon: BookOpen,    badge: '3' },
    { id: 'crossasset',   label: 'Cross-Asset',  icon: Globe,       badge: '4' },
    { id: 'realtime',     label: 'Real-time',    icon: Radio,       badge: '5' },
    { id: 'proworkspace', label: 'Pro WS',       icon: Cpu,         badge: '6' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Phase nav */}
      <div className="terminal-header px-4 py-3 flex items-center justify-between gap-3 border-b border-border/20">
        <div className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0">
          {phases.map((p, i) => (
            <React.Fragment key={p.id}>
              <PhasePill
                phase={p.id}
                label={p.label}
                icon={p.icon}
                active={activePhase === p.id}
                onClick={() => setActivePhase(p.id)}
              />
              {i < phases.length - 1 && (
                <ChevronRight className="h-3 w-3 text-border/40 flex-shrink-0 hidden sm:block" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Status strip */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground flex-shrink-0">
          {updatedAt && <span className="hidden md:inline">{new Date(updatedAt).toLocaleTimeString()}</span>}
          <SourceBadge source={source} />
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1 hover:text-primary transition-colors disabled:opacity-40 border border-border/30 rounded px-2 py-1 hover:border-primary/40">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Phase progress indicator */}
      <div className="flex h-0.5 bg-border/10">
        {phases.map((p, i) => (
          <div key={p.id} className={`flex-1 transition-colors duration-300 ${
            phases.findIndex(ph => ph.id === activePhase) >= i ? 'bg-primary/60' : 'bg-transparent'
          }`} />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {error && (
          <div className="flex items-center justify-between px-4 py-3 mb-4 rounded bg-red-500/10 border border-red-500/30 text-xs">
            <span className="flex items-center gap-2 text-red-400"><AlertTriangle className="h-3 w-3" />{error}</span>
            <button onClick={fetchData} className="text-red-400 hover:text-red-200 underline ml-4">Retry</button>
          </div>
        )}

        {activePhase === 'command' && (
          <CommandSpinePanel
            markets={markets}
            sectors={sectors}
            source={source}
            loading={loading}
            onRefresh={fetchData}
            onSelectSymbol={handleSelectSymbol}
            selectedSymbol={selectedSymbol}
            allAssets={allAssets}
            onGoDeep={handleGoDeep}
          />
        )}

        {activePhase === 'drilldown' && (
          <DrilldownPanel
            markets={markets}
            initialSymbol={selectedSymbol ?? undefined}
          />
        )}

        {activePhase === 'equity'      && <EquityDepthPanel />}
        {activePhase === 'crossasset'  && <CrossAssetPanel />}
        {activePhase === 'realtime'    && <RealtimePanel markets={markets} source={source} />}
        {activePhase === 'proworkspace' && <ProWorkspacePanel sectors={sectors} source={source} />}
      </div>
    </div>
  );
}