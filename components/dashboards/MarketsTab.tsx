'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MarketAsset {
  symbol: string;
  name?: string;
  price?: number;
  close?: number;
  open?: number;
  high?: number;
  low?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
}

interface SectorData {
  sector: string;
  change: number;
  symbol?: string;
  price?: number;
  volume?: number;
}

interface MarketsApiResponse {
  success: boolean;
  data: {
    markets: MarketAsset[];
    sectors: SectorData[];
    timestamp: string;
    source: string;
  };
}

type MarketSubTab = 'summary' | 'sectors' | 'heatmap' | 'screener';

const INDEX_COLORS: Record<string, string> = {
  SPX: '#00D9FF', NDX: '#4CAF50', DJI: '#FFD700', RUT: '#FF9800',
  GOLD: '#FFD700', OIL: '#FF5722', DXY: '#9C27B0', VIX: '#E91E63',
};

const SECTOR_COLORS: Record<string, string> = {
  Technology: '#00D9FF', Finance: '#4CAF50', Healthcare: '#FF9800',
  Energy: '#FFD700', Industrial: '#E91E63', Consumer: '#9C27B0',
  Materials: '#00BCD4', Utilities: '#8BC34A', 'Real Estate': '#FF5722', Telecom: '#607D8B',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n?: number | null): string {
  if (n == null || isNaN(n)) return '—';
  if (n >= 10000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

// ── UI components ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const live = source === 'yahoo-finance';
  const label = live ? 'YAHOO FINANCE LIVE' : source === 'fallback' ? 'STATIC FALLBACK' : 'MOCK DATA';
  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ml-2 ${live ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
      {label}
    </span>
  );
}

function ErrorBanner({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 mb-4 rounded bg-red-500/10 border border-red-500/30 text-xs">
      <span className="flex items-center gap-2 text-red-400"><AlertTriangle className="h-3 w-3" />{msg}</span>
      <button onClick={onRetry} className="text-red-400 hover:text-red-200 underline ml-4">Retry</button>
    </div>
  );
}

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

// ── Market stat card ──────────────────────────────────────────────────────────

function MarketCard({ asset }: { asset: MarketAsset }) {
  const pct   = asset.changePercent ?? 0;
  const price = asset.close ?? asset.price ?? 0;
  const pos   = pct >= 0;
  const color = INDEX_COLORS[asset.symbol] ?? '#00D9FF';

  return (
    <div className="p-4 rounded bg-card/50 border border-border/30 hover:border-primary/40 transition-all"
      style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-xs font-mono font-bold text-foreground">{asset.symbol}</div>
          {asset.name && <div className="text-[10px] text-muted-foreground">{asset.name}</div>}
        </div>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${pos ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
          {fmtPct(pct)}
        </span>
      </div>
      <div className="text-xl font-bold font-mono" style={{ color }}>{fmtPrice(price)}</div>
      <div className="flex justify-between mt-1 text-[10px] text-muted-foreground font-mono">
        {asset.high && asset.low && <span>H: {fmtPrice(asset.high)} · L: {fmtPrice(asset.low)}</span>}
        {asset.volume ? <span>Vol: {fmtVol(asset.volume)}</span> : null}
      </div>
    </div>
  );
}

// ── TradingView iframes ───────────────────────────────────────────────────────

function TVChart({ symbol, height = 260 }: { symbol: string; height?: number }) {
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

function TVSPHeatmap({ height = 560 }: { height?: number }) {
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

function TVETFHeatmap({ height = 500 }: { height?: number }) {
  const cfg = encodeURIComponent(JSON.stringify({
    dataSource: 'AllUSEtf', blockSize: 'aum', blockColor: 'change',
    grouping: 'asset_class', colorTheme: 'dark', hasTopBar: true,
    isDataSetEnabled: true, isZoomEnabled: true, hasSymbolTooltip: true,
  }));
  return (
    <div style={{ height }} className="w-full rounded overflow-hidden">
      <iframe src={`https://s.tradingview.com/embed-widget/etf-heatmap/?locale=en#${cfg}`}
        style={{ width: '100%', height: '100%', border: 'none' }} title="ETF Heatmap" />
    </div>
  );
}

function TVScreener({ height = 600 }: { height?: number }) {
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

// ── Yield curve (static FRED-like values, refreshed from API in prod) ─────────

const YIELD_DATA = [
  { tenor: '1M', current: 5.32, prev: 5.28 }, { tenor: '3M', current: 5.38, prev: 5.31 },
  { tenor: '6M', current: 5.44, prev: 5.40 }, { tenor: '1Y', current: 5.20, prev: 5.15 },
  { tenor: '2Y', current: 4.72, prev: 4.68 }, { tenor: '3Y', current: 4.45, prev: 4.40 },
  { tenor: '5Y', current: 4.22, prev: 4.19 }, { tenor: '7Y', current: 4.18, prev: 4.14 },
  { tenor: '10Y', current: 4.05, prev: 4.01 },{ tenor: '20Y', current: 4.35, prev: 4.30 },
  { tenor: '30Y', current: 4.25, prev: 4.21 },
];

function YieldCurveChart() {
  const spread = YIELD_DATA[8].current - YIELD_DATA[4].current;
  const isInverted = spread < 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
        <span className={`px-3 py-1 rounded-full border ${isInverted ? 'bg-red-500/15 border-red-500/40 text-red-400' : 'bg-green-500/15 border-green-500/40 text-green-400'}`}>
          {isInverted ? '⚠ INVERTED' : '✓ NORMAL'}
        </span>
        <span className="text-muted-foreground">10Y–2Y: <span className={isInverted ? 'text-red-400' : 'text-green-400'}>{fmtPct(spread)}</span></span>
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
            <ReferenceLine y={0} stroke="#FF1744" strokeDasharray="4 4" strokeOpacity={0.4} />
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
              <div className="text-[10px] text-muted-foreground font-mono">{d.tenor}</div>
              <div className="text-sm font-bold text-cyan-400">{d.current}%</div>
              <div className={`text-[10px] font-mono ${chg >= 0 ? 'text-green-400' : 'text-red-400'}`}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Correlation matrix ────────────────────────────────────────────────────────

const CORR = [
  { name: 'SPX',  SPX: 1.00, DXY: -0.72, Gold: 0.15, Oil: 0.43, BTC: 0.68, VIX: -0.78 },
  { name: 'DXY',  SPX: -0.72, DXY: 1.00, Gold: -0.45, Oil: -0.38, BTC: -0.52, VIX: 0.45 },
  { name: 'Gold', SPX: 0.15, DXY: -0.45, Gold: 1.00, Oil: 0.62, BTC: 0.34, VIX: -0.12 },
  { name: 'Oil',  SPX: 0.43, DXY: -0.38, Gold: 0.62, Oil: 1.00, BTC: 0.51, VIX: -0.31 },
  { name: 'BTC',  SPX: 0.68, DXY: -0.52, Gold: 0.34, Oil: 0.51, BTC: 1.00, VIX: -0.60 },
  { name: 'VIX',  SPX: -0.78, DXY: 0.45, Gold: -0.12, Oil: -0.31, BTC: -0.60, VIX: 1.00 },
];

function corrColor(v: number) {
  if (v === 1) return '#7A8391';
  if (v > 0.5) return '#00D9FF';
  if (v > 0) return '#4CAF50';
  if (v > -0.5) return '#FF9800';
  return '#FF1744';
}

function CorrelationMatrix() {
  const assets = ['SPX', 'DXY', 'Gold', 'Oil', 'BTC', 'VIX'];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-center font-mono">
        <thead>
          <tr className="border-b border-border/30">
            <th className="text-left px-3 py-2 text-muted-foreground">Asset</th>
            {assets.map(a => <th key={a} className="px-3 py-2 text-muted-foreground">{a}</th>)}
          </tr>
        </thead>
        <tbody>
          {CORR.map(row => (
            <tr key={row.name} className="border-b border-border/30 hover:bg-card/20">
              <td className="text-left px-3 py-2 font-bold text-foreground">{row.name}</td>
              {assets.map(a => {
                const val = (row as any)[a];
                return <td key={a} className="px-3 py-2 font-bold" style={{ color: corrColor(val) }}>{val.toFixed(2)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-4 mt-3 text-[10px] font-mono text-muted-foreground flex-wrap">
        {[['> 0.5 Strong+', '#00D9FF'], ['0–0.5 Weak+', '#4CAF50'], ['−0.5–0 Weak−', '#FF9800'], ['< −0.5 Strong−', '#FF1744']].map(([l, c]) => (
          <span key={l} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: c }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Sector bar chart ──────────────────────────────────────────────────────────

function SectorBarChart({ sectors }: { sectors: SectorData[] }) {
  if (!sectors.length) return null;
  const data = [...sectors].sort((a, b) => b.change - a.change);
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#00D9FF" strokeOpacity={0.07} />
          <XAxis dataKey="sector" stroke="#7A8391" style={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis stroke="#7A8391" style={{ fontSize: 10 }} unit="%" />
          <Tooltip content={<CTooltip />} />
          <ReferenceLine y={0} stroke="#fff" strokeOpacity={0.15} />
          <Bar dataKey="change" name="Change %" radius={[3, 3, 0, 0]}
            fill="#4CAF50"
            label={false}
          >
            {data.map((entry, i) => (
              <rect key={i} fill={entry.change >= 0 ? '#4CAF50' : '#FF1744'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── ECharts treemap ───────────────────────────────────────────────────────────

function EChartsTreemap({ sectors }: { sectors: SectorData[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !sectors.length) return;
    let chart: any;
    let ro: ResizeObserver;

    (async () => {
      const echarts = await import('echarts');
      chart = echarts.init(ref.current!, 'dark');

      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          formatter: (p: any) => `<b>${p.name}</b><br/>${fmtPct(sectors.find(s => s.sector === p.name)?.change)}`,
          backgroundColor: '#0F1432', borderColor: '#00D9FF',
          textStyle: { color: '#E0E6ED', fontFamily: 'monospace', fontSize: 12 },
        },
        series: [{
          type: 'treemap',
          roam: false, nodeClick: false,
          breadcrumb: { show: false },
          data: sectors.map(s => ({
            name: s.sector,
            value: Math.abs(s.change) * 15 + 15,
            label: {
              show: true,
              formatter: `{name|${s.sector}}\n{pct|${fmtPct(s.change)}}`,
              rich: {
                name: { color: '#fff', fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace' },
                pct: { color: '#fff', fontSize: 12, fontFamily: 'monospace' },
              },
            },
            itemStyle: {
              color: s.change >= 0
                ? `rgba(76,175,80,${Math.min(0.25 + Math.abs(s.change) * 0.18, 0.95)})`
                : `rgba(255,23,68,${Math.min(0.25 + Math.abs(s.change) * 0.18, 0.95)})`,
              borderColor: s.change >= 0 ? '#4CAF50' : '#FF1744',
              borderWidth: 1,
            },
          })),
          itemStyle: { gapWidth: 3 },
          levels: [{ itemStyle: { borderWidth: 2, borderColor: '#0A0E27', gapWidth: 4 } }],
        }],
      });

      ro = new ResizeObserver(() => chart?.resize());
      ro.observe(ref.current!);
    })();

    return () => { chart?.dispose(); ro?.disconnect(); };
  }, [sectors]);

  return <div ref={ref} style={{ height: 380 }} className="w-full rounded bg-[#0A0E27]" />;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function MarketsTab() {
  const [activeSubTab, setActiveSubTab] = useState<MarketSubTab>('summary');
  const [markets, setMarkets]     = useState<MarketAsset[]>([]);
  const [sectors, setSectors]     = useState<SectorData[]>([]);
  const [source, setSource]       = useState<string | undefined>();
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
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

  const subTabs: { id: MarketSubTab; label: string; icon: string }[] = [
    { id: 'summary',  label: 'Summary',    icon: '📊' },
    { id: 'sectors',  label: 'Sector Map', icon: '🗺️' },
    { id: 'heatmap',  label: 'Heatmap',    icon: '🔥' },
    { id: 'screener', label: 'Screener',   icon: '🔍' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Sub-tabs */}
      <div className="terminal-header px-6 py-3 flex items-center justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {subTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveSubTab(tab.id)}
              className={`px-4 py-2 rounded text-sm font-mono transition-all whitespace-nowrap ${
                activeSubTab === tab.id
                  ? 'bg-primary/20 text-primary border border-primary/50'
                  : 'text-muted-foreground hover:bg-card/50 border border-border/30'
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground flex-shrink-0 ml-4">
          {updatedAt && <span>Updated {new Date(updatedAt).toLocaleTimeString()}</span>}
          <SourceBadge source={source} />
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1 hover:text-primary transition-colors disabled:opacity-40">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && <ErrorBanner msg={error} onRetry={fetchData} />}

        {/* ─── SUMMARY ─── */}
        {activeSubTab === 'summary' && (
          <div className="space-y-6">
            <div className="glass-panel p-6">
              <h3 className="text-lg font-bold text-primary mb-4 flex items-center">
                Global Market Summary <SourceBadge source={source} />
              </h3>
              {loading ? (
                <div className="grid grid-cols-4 gap-3 animate-pulse">
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 rounded bg-card/50" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {markets.length > 0
                    ? markets.map(m => <MarketCard key={m.symbol} asset={m} />)
                    : <p className="col-span-4 text-sm text-muted-foreground">No market data available.</p>
                  }
                </div>
              )}
            </div>

            {/* Live TradingView mini charts */}
            <div className="glass-panel p-6">
              <h4 className="text-sm font-bold text-primary mb-4">LIVE INDEX CHARTS</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['SPY', 'QQQ', 'GLD', 'VIX'].map(sym => (
                  <div key={sym}>
                    <div className="text-xs font-mono text-muted-foreground mb-1.5">{sym}</div>
                    <TVChart symbol={sym} height={200} />
                  </div>
                ))}
              </div>
            </div>

            {/* Yield Curve */}
            <div className="glass-panel p-6">
              <h4 className="text-sm font-bold text-primary mb-4">US TREASURY YIELD CURVE</h4>
              <YieldCurveChart />
            </div>

            {/* Correlation Matrix */}
            <div className="glass-panel p-6">
              <h4 className="text-sm font-bold text-primary mb-4">CROSS-ASSET CORRELATION MATRIX</h4>
              <CorrelationMatrix />
            </div>

            {/* Sector bar */}
            <div className="glass-panel p-6">
              <h4 className="text-sm font-bold text-primary mb-4 flex items-center">
                SECTOR PERFORMANCE (24H) <SourceBadge source={source} />
              </h4>
              <SectorBarChart sectors={sectors.length > 0 ? sectors : []} />
            </div>
          </div>
        )}

        {/* ─── SECTORS ─── */}
        {activeSubTab === 'sectors' && (
          <div className="space-y-6">
            <div className="glass-panel p-6">
              <h3 className="text-lg font-bold text-primary mb-1 flex items-center">
                Sector Performance Map <SourceBadge source={source} />
              </h3>
              <p className="text-xs text-muted-foreground font-mono mb-4">Size = relative weight · Color intensity = magnitude of move</p>
              {sectors.length > 0
                ? <EChartsTreemap sectors={sectors} />
                : <div className="h-80 rounded bg-card/30 border border-border/20 flex items-center justify-center text-xs text-muted-foreground">Loading sector data…</div>
              }
            </div>

            <div className="glass-panel p-6">
              <h4 className="text-sm font-bold text-primary mb-4">SECTOR CHANGE BREAKDOWN</h4>
              <SectorBarChart sectors={sectors.length > 0 ? sectors : []} />
            </div>

            {/* Sector cards grid */}
            <div className="glass-panel p-6">
              <h4 className="text-sm font-bold text-primary mb-4">SECTOR DETAIL</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {(sectors.length > 0 ? sectors : []).map(s => {
                  const pos = s.change >= 0;
                  const color = SECTOR_COLORS[s.sector] ?? '#7A8391';
                  return (
                    <div key={s.sector} className="p-3 rounded bg-card/50 border border-border/30 hover:border-primary/40 transition-all"
                      style={{ borderTop: `2px solid ${color}` }}>
                      <div className="text-xs font-mono text-muted-foreground mb-2 truncate">{s.sector}</div>
                      <div className={`text-lg font-bold font-mono ${pos ? 'text-green-400' : 'text-red-400'}`}>{fmtPct(s.change)}</div>
                      {s.symbol && <div className="text-[10px] text-muted-foreground font-mono mt-1">{s.symbol}: ${fmtPrice(s.price)}</div>}
                      <div className="mt-2 h-1.5 rounded-full bg-card overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(Math.abs(s.change) * 20 + 20, 100)}%`, background: pos ? '#4CAF50' : '#FF1744' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TradingView ETF heatmap */}
            <div className="glass-panel p-6">
              <h4 className="text-sm font-bold text-primary mb-4">ETF SECTOR HEATMAP — LIVE</h4>
              <TVETFHeatmap height={480} />
            </div>
          </div>
        )}

        {/* ─── HEATMAP ─── */}
        {activeSubTab === 'heatmap' && (
          <div className="space-y-6">
            <div className="glass-panel p-6">
              <h3 className="text-lg font-bold text-primary mb-1">S&P 500 Component Heatmap</h3>
              <p className="text-xs text-muted-foreground font-mono mb-4">
                All 500 stocks · Size = market cap · Color = daily % change · Live from TradingView
              </p>
              <TVSPHeatmap height={560} />
            </div>
            <div className="glass-panel p-6">
              <h4 className="text-sm font-bold text-primary mb-4">CROSS-ASSET CORRELATION</h4>
              <CorrelationMatrix />
            </div>
          </div>
        )}

        {/* ─── SCREENER ─── */}
        {activeSubTab === 'screener' && (
          <div className="space-y-6">
            <div className="glass-panel p-6">
              <h3 className="text-lg font-bold text-primary mb-1">Equity Screener</h3>
              <p className="text-xs text-muted-foreground font-mono mb-4">Live data · Filter by fundamentals, technicals, sector</p>
              <TVScreener height={620} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}