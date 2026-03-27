'use client';

import React, { useState, useRef, useCallback } from 'react';

// ── Types (shared with CryptoTab) ─────────────────────────────────────────────

export interface CryptoAsset {
  symbol: string;
  name?: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap?: number;
  dominance?: number;
}

export interface ApiSummary {
  totalMarketCap: number;
  btcDominance: number;
  top3Change: number[];
}

export interface SpotMarketProps {
  /** Live assets passed down from CryptoTab */
  cryptos: CryptoAsset[];
  summary: ApiSummary | null;
  source?: 'coingecko' | 'mock';
  loading: boolean;
  /** Optional: override active nav tab */
  defaultTab?: NavTab;
}

type NavTab = 'Overview' | 'Spot' | 'Derivatives' | 'Cryptocurrencies' | 'BTC Treasuries' | 'BNB Treasuries';
type ChartView = 'overview' | 'breakdown' | 'share' | 'total';
type Timeframe = '24H' | '7D' | '30D' | '1Y' | 'All';

// ── Static historical series (2-year monthly, index 0 = Mar 2023) ─────────────

const DATES_2Y: string[] = Array.from({ length: 24 }, (_, i) => {
  const d = new Date('2023-03-01');
  d.setMonth(d.getMonth() + i);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
});

const MARKET_CAP_SERIES: number[] = [
  1.1, 1.15, 1.2, 1.18, 1.22, 1.28, 1.35, 1.5, 1.7, 1.9, 2.1, 2.4,
  2.2, 2.05, 1.95, 2.1, 2.3, 2.5, 2.8, 3.1, 3.5, 4.1, 3.8, 2.37,
];

const MARKET_CAP_BTC_SHARE: number[] = [
  0.55, 0.56, 0.57, 0.56, 0.55, 0.54, 0.52, 0.50, 0.48, 0.46, 0.47,
  0.49, 0.51, 0.52, 0.54, 0.55, 0.56, 0.55, 0.54, 0.53, 0.54, 0.55, 0.56, 0.575,
];
const MARKET_CAP_ETH_SHARE: number[] = [
  0.18, 0.18, 0.17, 0.17, 0.18, 0.18, 0.17, 0.17, 0.18, 0.18, 0.17,
  0.17, 0.16, 0.16, 0.15, 0.15, 0.14, 0.14, 0.13, 0.13, 0.12, 0.115, 0.11, 0.108,
];
const MARKET_CAP_STABLE_SHARE: number[] = [
  0.06, 0.06, 0.065, 0.065, 0.065, 0.06, 0.06, 0.06, 0.055, 0.055,
  0.05, 0.05, 0.05, 0.05, 0.05, 0.048, 0.048, 0.048, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05,
];

const SPOT_VOL_SERIES: number[] = [
  45, 52, 48, 55, 62, 70, 80, 95, 88, 75, 65, 72,
  85, 90, 78, 68, 74, 82, 91, 105, 98, 115, 102, 88,
];

interface ExchangeSeries { [key: string]: number[] }

const CEX_SERIES: ExchangeSeries = {
  binance:  [20, 22, 21, 23, 25, 28, 32, 38, 35, 30, 26, 28, 32, 35, 30, 27, 29, 33, 37, 42, 39, 45, 41, 35],
  coinbase: [6, 7, 6.5, 7, 7.5, 8, 9, 11, 10, 8.5, 7.5, 8, 9.5, 10, 8.5, 7.5, 8, 9, 10, 12, 11, 13, 12, 10],
  bybit:    [5, 5.5, 5, 5.5, 6, 7, 8, 10, 9, 7.5, 6.5, 7, 8.5, 9, 7.5, 6.5, 7, 8, 9, 11, 10, 12, 11, 9],
  okx:      [4, 4.5, 4, 4.5, 5, 5.5, 6, 7.5, 7, 6, 5, 5.5, 6.5, 7, 6, 5.5, 6, 6.5, 7, 8.5, 8, 9.5, 8.5, 7],
  crypto:   [3, 3.2, 3, 3.2, 3.5, 4, 4.5, 5.5, 5, 4.5, 4, 4.2, 5, 5.5, 4.5, 4, 4.5, 5, 5.5, 6.5, 6, 7, 6.5, 5.5],
  others:   [7, 7.8, 8, 10, 11, 12.5, 14, 18, 17, 14, 12, 13, 15, 17, 15, 13, 13.5, 15, 17, 20, 18, 22, 19, 16],
};

const DEX_SERIES: ExchangeSeries = {
  uniswapV2:   [8, 9, 8.5, 9, 9.5, 10, 11, 13, 12, 10, 9, 9.5, 11, 12, 10, 9, 9.5, 10, 11, 13, 12, 14, 13, 11],
  raydium:     [3, 3.5, 3.2, 3.5, 4, 5, 6, 8, 7, 5.5, 4.5, 5, 6.5, 7, 5.5, 4.5, 5, 6, 7, 9, 8, 10, 9, 7],
  uniswapV3:   [10, 11, 10, 11, 12, 13, 14, 17, 16, 13, 11, 12, 14, 16, 13, 11, 12, 14, 16, 19, 17, 20, 18, 15],
  pancakeswap: [5, 5.5, 5, 5.5, 6, 6.5, 7, 8.5, 8, 6.5, 5.5, 6, 7.5, 8, 6.5, 5.5, 6, 7, 8, 9.5, 8.5, 10, 9, 7.5],
  curve:       [4, 4.2, 4, 4.2, 4.5, 5, 5.5, 6.5, 6, 5, 4.5, 4.7, 5.5, 6, 5, 4.5, 4.7, 5.5, 6, 7, 6.5, 7.5, 7, 6],
  others:      [6, 6.5, 6, 6.5, 7, 7.5, 8, 9.5, 9, 7.5, 6.5, 7, 8.5, 9, 7.5, 6.5, 7, 8, 9, 10.5, 9.5, 11, 10, 8.5],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sliceByTimeframe<T>(arr: T[], tf: Timeframe): T[] {
  const map: Record<Timeframe, number> = { '24H': 2, '7D': 7, '30D': 12, '1Y': 12, 'All': arr.length };
  return arr.slice(-(map[tf] ?? arr.length));
}

function fmt(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 1)    return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function pctChange(current: number, previous: number): number {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────

interface LineChartProps {
  series: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}

function LineChart({ series, color = '#00ff88', width = 400, height = 120, fill = false }: LineChartProps) {
  if (!series || series.length < 2) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const pts = series.map((v, i) => ({
    x: (i / (series.length - 1)) * width,
    y: height - ((v - min) / range) * height * 0.85 - height * 0.075,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;
  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {fill && <path d={areaD} fill={`url(#${gradId})`} />}
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Stacked Area Chart ────────────────────────────────────────────────────────

interface StackedAreaChartProps {
  data: number[][];
  colors: string[];
  labels: string[];
  width?: number;
  height?: number;
  showLegend?: boolean;
}

function StackedAreaChart({ data, colors, labels, width = 800, height = 160, showLegend = true }: StackedAreaChartProps) {
  const n = data[0]?.length ?? 0;
  if (n < 2) return null;

  const totals = Array.from({ length: n }, (_, i) => data.reduce((s, d) => s + d[i], 0));
  const maxTotal = Math.max(...totals) * 1.05;

  function buildStackedPath(layerIdx: number): string {
    const cumAbove = (i: number) => data.slice(layerIdx + 1).reduce((s, d) => s + d[i], 0);
    const cumBelow = (i: number) => data.slice(layerIdx).reduce((s, d) => s + d[i], 0);
    const topPts = Array.from({ length: n }, (_, i) => ({
      x: (i / (n - 1)) * width,
      y: height - (cumBelow(i) / maxTotal) * height,
    }));
    const botPts = Array.from({ length: n }, (_, i) => ({
      x: (i / (n - 1)) * width,
      y: height - (cumAbove(i) / maxTotal) * height,
    }));
    const top = topPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const bot = [...botPts].reverse().map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    return `${top} ${bot} Z`;
  }

  return (
    <div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {data.map((_, idx) => (
          <path key={idx} d={buildStackedPath(idx)} fill={colors[idx]} opacity="0.82" />
        ))}
      </svg>
      {showLegend && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
          {labels.map((l, i) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i], display: 'inline-block' }} />
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tooltip hook ──────────────────────────────────────────────────────────────

interface TooltipState {
  x: number;
  idx: number;
  data: number[];
  labels: string[];
  colors: string[];
}

function useChartTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback(
    (e: React.MouseEvent, series: number[][], labels: string[], colors: string[]) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const idx = Math.max(0, Math.min(series[0].length - 1, Math.round((x / rect.width) * (series[0].length - 1))));
      setTooltip({ x, idx, data: series.map(s => s[idx]), labels, colors });
    },
    []
  );

  return { tooltip, setTooltip, ref, onMouseMove };
}

// ── Shared Timeframe + View Toggle bar ───────────────────────────────────────

interface ControlBarProps {
  timeframes: Timeframe[];
  activeTf: Timeframe;
  onTfChange: (tf: Timeframe) => void;
  views?: { label: string; value: ChartView }[];
  activeView?: ChartView;
  onViewChange?: (v: ChartView) => void;
}

const btnBase: React.CSSProperties = {
  padding: '2px 8px', fontSize: 9, borderRadius: 4,
  cursor: 'pointer', fontFamily: 'monospace', border: '1px solid',
};

function btnStyle(active: boolean): React.CSSProperties {
  return {
    ...btnBase,
    borderColor: active ? '#22d3ee' : 'rgba(51,65,85,0.6)',
    background: active ? 'rgba(34,211,238,0.1)' : 'transparent',
    color: active ? '#22d3ee' : '#64748b',
  };
}

function ControlBar({ timeframes, activeTf, onTfChange, views, activeView, onViewChange }: ControlBarProps) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      {views && views.map(v => (
        <button key={v.value} onClick={() => onViewChange?.(v.value)} style={btnStyle(activeView === v.value)}>
          {v.label}
        </button>
      ))}
      {views && <div style={{ width: 1, height: 12, background: 'rgba(51,65,85,0.5)', margin: '0 2px' }} />}
      {timeframes.map(t => (
        <button key={t} onClick={() => onTfChange(t)} style={{ ...btnStyle(activeTf === t), padding: '2px 6px' }}>
          {t}
        </button>
      ))}
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

interface CardProps {
  title: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

function Card({ title, controls, children, footer }: CardProps) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(51,65,85,0.5)',
      borderRadius: 8, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>{title}</span>
        {controls}
      </div>
      {children}
      {footer && <div style={{ textAlign: 'right', fontSize: 9, color: '#334155', fontFamily: 'monospace', marginTop: 4 }}>{footer}</div>}
    </div>
  );
}

// ── Crypto Market Cap Block ───────────────────────────────────────────────────
// Derives live values from props.cryptos / props.summary and falls back to static series.

interface MarketCapBlockProps {
  cryptos: CryptoAsset[];
  summary: ApiSummary | null;
  loading: boolean;
}

function MarketCapBlock({ cryptos, summary, loading }: MarketCapBlockProps) {
  const [view, setView] = useState<ChartView>('overview');
  const [tf, setTf] = useState<Timeframe>('All');

  // Override last value in static series with live summary if available
  const liveSeries = React.useMemo<number[]>(() => {
    if (!summary?.totalMarketCap) return MARKET_CAP_SERIES;
    const live = summary.totalMarketCap / 1e12; // convert to trillions
    return [...MARKET_CAP_SERIES.slice(0, -1), parseFloat(live.toFixed(3))];
  }, [summary]);

  const mcSeries = sliceByTimeframe(liveSeries, tf);
  const btcAbs   = sliceByTimeframe(liveSeries.map((v, i) => v * MARKET_CAP_BTC_SHARE[i]),    tf);
  const ethAbs   = sliceByTimeframe(liveSeries.map((v, i) => v * MARKET_CAP_ETH_SHARE[i]),    tf);
  const stableAbs= sliceByTimeframe(liveSeries.map((v, i) => v * MARKET_CAP_STABLE_SHARE[i]), tf);
  const othersAbs= sliceByTimeframe(liveSeries.map((v, i) =>
    v * (1 - MARKET_CAP_BTC_SHARE[i] - MARKET_CAP_ETH_SHARE[i] - MARKET_CAP_STABLE_SHARE[i])), tf);

  const current   = liveSeries[liveSeries.length - 1];
  const prev      = liveSeries[liveSeries.length - 2];
  const weekAgo   = liveSeries[liveSeries.length - 5] ?? liveSeries[0];
  const monthAgo  = liveSeries[liveSeries.length - 9] ?? liveSeries[0];
  const changePct = pctChange(current, prev);

  // Yearly high/low from static + live combined
  const yearlyHigh = Math.max(...liveSeries);
  const yearlyLow  = Math.min(...liveSeries);
  const yearlyHighIdx = liveSeries.indexOf(yearlyHigh);
  const yearlyLowIdx  = liveSeries.indexOf(yearlyLow);

  const chartViews: { label: string; value: ChartView }[] = [
    { label: 'Overview',  value: 'overview'  },
    { label: 'Breakdown', value: 'breakdown' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: 16, marginBottom: 16 }}>
      {/* ── Left stats ── */}
      <div style={{
        background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(51,65,85,0.5)',
        borderRadius: 8, padding: '14px 16px',
      }}>
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Crypto Market Cap
        </div>
        {loading ? (
          <div style={{ height: 28, width: 120, borderRadius: 4, background: 'rgba(51,65,85,0.4)', marginBottom: 6 }} />
        ) : (
          <>
            <div style={{ fontSize: 22, fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>
              ${current.toFixed(2)}T
            </div>
            <div style={{ fontSize: 10, color: changePct >= 0 ? '#22c55e' : '#ef4444', fontFamily: 'monospace', marginBottom: 14 }}>
              {changePct >= 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
            </div>
          </>
        )}

        <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Market Cap Historical Values
        </div>
        {[
          { label: 'Yesterday',  value: prev     },
          { label: 'Last Week',  value: weekAgo  },
          { label: 'Last Month', value: monthAgo },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{label}</span>
            <span style={{ fontSize: 10, color: '#cbd5e1', fontFamily: 'monospace' }}>${value.toFixed(2)}T</span>
          </div>
        ))}

        <div style={{ borderTop: '1px solid rgba(51,65,85,0.4)', marginTop: 12, paddingTop: 10 }}>
          <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Market Cap Yearly Performance
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>
              Yearly High ({DATES_2Y[yearlyHighIdx] ?? 'N/A'})
            </div>
            <div style={{ fontSize: 13, color: '#22c55e', fontFamily: 'monospace', fontWeight: 700 }}>
              ${yearlyHigh.toFixed(2)}T
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>
              Yearly Low ({DATES_2Y[yearlyLowIdx] ?? 'N/A'})
            </div>
            <div style={{ fontSize: 13, color: '#ef4444', fontFamily: 'monospace', fontWeight: 700 }}>
              ${yearlyLow.toFixed(2)}T
            </div>
          </div>
        </div>
      </div>

      {/* ── Right chart ── */}
      <Card
        title="Crypto Market Cap Chart"
        controls={
          <ControlBar
            timeframes={['24H', '7D', '30D', '1Y', 'All']}
            activeTf={tf}
            onTfChange={setTf}
            views={chartViews}
            activeView={view}
            onViewChange={setView}
          />
        }
        footer="© CoinMarketCap"
      >
        {loading ? (
          <div style={{ height: 180, borderRadius: 4, background: 'rgba(51,65,85,0.3)', animation: 'pulse 1.5s infinite' }} />
        ) : view === 'overview' ? (
          <div style={{ position: 'relative' }}>
            <LineChart series={mcSeries} color="#22c55e" width={900} height={180} fill />
            {/* live price label at end */}
            <div style={{
              position: 'absolute', top: 10, right: 8,
              background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(34,211,238,0.3)',
              borderRadius: 4, padding: '3px 7px', fontSize: 9, fontFamily: 'monospace', color: '#94a3b8',
            }}>
              <div style={{ color: '#22c55e' }}>● Market Cap: ${current.toFixed(2)}T</div>
            </div>
          </div>
        ) : (
          <StackedAreaChart
            data={[btcAbs, ethAbs, stableAbs, othersAbs]}
            colors={['#f59e0b', '#60a5fa', '#22c55e', '#e2e8f0']}
            labels={['Bitcoin', 'Ethereum', 'Stablecoins', 'Others']}
            width={900}
            height={180}
          />
        )}
      </Card>
    </div>
  );
}

// ── Crypto Spot Volume ────────────────────────────────────────────────────────
// Uses live 24h volume from cryptos array, scaled over historical series.

interface SpotVolumeCardProps {
  cryptos: CryptoAsset[];
  loading: boolean;
}

function SpotVolumeCard({ cryptos, loading }: SpotVolumeCardProps) {
  const [tf, setTf] = useState<Timeframe>('All');

  // Derive live total 24h volume and inject into series end
  const liveVolume24h = React.useMemo(() => {
    const total = cryptos.reduce((s, c) => s + (c.volume24h ?? 0), 0);
    return total / 1e9; // billions
  }, [cryptos]);

  const liveSeries = React.useMemo<number[]>(() => {
    if (!liveVolume24h) return SPOT_VOL_SERIES;
    return [...SPOT_VOL_SERIES.slice(0, -1), parseFloat(liveVolume24h.toFixed(1))];
  }, [liveVolume24h]);

  const sliced = sliceByTimeframe(liveSeries, tf);
  const current = liveSeries[liveSeries.length - 1];

  return (
    <Card
      title="Crypto Spot Volume (24H)"
      controls={
        <ControlBar timeframes={['24H', '7D', '30D', '1Y']} activeTf={tf} onTfChange={setTf} />
      }
      footer="© CoinMarketCap"
    >
      <div style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', marginBottom: 6 }}>
        Current: <span style={{ color: '#22c55e' }}>${current.toFixed(1)}B</span>
        {liveVolume24h > 0 && <span style={{ color: '#475569', marginLeft: 6 }}>● Live</span>}
      </div>
      {loading ? (
        <div style={{ height: 150, borderRadius: 4, background: 'rgba(51,65,85,0.3)' }} />
      ) : (
        <LineChart series={sliced} color="#22c55e" width={700} height={150} fill />
      )}
    </Card>
  );
}

// ── CEX Volume Card ───────────────────────────────────────────────────────────

function CEXVolumeCard({ loading }: { loading: boolean }) {
  const [tf, setTf]     = useState<Timeframe>('All');
  const [view, setView] = useState<ChartView>('share');

  const multiSeries = Object.values(CEX_SERIES).map(s => sliceByTimeframe(s, tf));
  const colors  = ['#3b82f6', '#22c55e', '#f59e0b', '#f97316', '#60a5fa', '#e2e8f0'];
  const labels  = ['Binance', 'Coinbase Exchange', 'Bybit', 'OKX', 'Crypto.com Exchange', 'Others'];

  const views: { label: string; value: ChartView }[] = [
    { label: 'Market Share', value: 'share' },
    { label: 'Total',        value: 'total' },
  ];

  return (
    <Card
      title="CEX Spot Volume (24H)"
      controls={
        <ControlBar
          timeframes={['24H', '7D', '30D', '1Y']}
          activeTf={tf} onTfChange={setTf}
          views={views} activeView={view} onViewChange={setView}
        />
      }
      footer="© CoinMarketCap"
    >
      {loading ? (
        <div style={{ height: 150, borderRadius: 4, background: 'rgba(51,65,85,0.3)' }} />
      ) : view === 'share' ? (
        <StackedAreaChart data={multiSeries} colors={colors} labels={labels} width={700} height={150} />
      ) : (
        <div style={{ position: 'relative' }}>
          {multiSeries.map((s, i) => (
            <div key={i} style={{ position: i === 0 ? 'relative' : 'absolute', top: 0, left: 0, width: '100%', opacity: 0.85 }}>
              <LineChart series={s} color={colors[i]} width={700} height={150} fill={false} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 154 }}>
            {labels.map((l, i) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i], display: 'inline-block' }} />
                {l}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── DEX Volume Card ───────────────────────────────────────────────────────────

function DEXVolumeCard({ loading }: { loading: boolean }) {
  const [tf, setTf]     = useState<Timeframe>('All');
  const [view, setView] = useState<ChartView>('share');

  const multiSeries = Object.values(DEX_SERIES).map(s => sliceByTimeframe(s, tf));
  const colors  = ['#f97316', '#8b5cf6', '#22d3ee', '#ec4899', '#10b981', '#94a3b8'];
  const labels  = ['Uniswap v2', 'Raydium', 'Uniswap v3 (Ethereum)', 'PancakeSwap v3 (BSC)', 'Curve (Ethereum)', 'Others'];

  const views: { label: string; value: ChartView }[] = [
    { label: 'Market Share', value: 'share' },
    { label: 'Total',        value: 'total' },
  ];

  return (
    <Card
      title="DEX Spot Volume (24H)"
      controls={
        <ControlBar
          timeframes={['24H', '7D', '30D', '1Y']}
          activeTf={tf} onTfChange={setTf}
          views={views} activeView={view} onViewChange={setView}
        />
      }
      footer="© CoinMarketCap"
    >
      {loading ? (
        <div style={{ height: 160, borderRadius: 4, background: 'rgba(51,65,85,0.3)' }} />
      ) : view === 'share' ? (
        <StackedAreaChart data={multiSeries} colors={colors} labels={labels} width={1200} height={160} />
      ) : (
        <div style={{ position: 'relative' }}>
          {multiSeries.map((s, i) => (
            <div key={i} style={{ position: i === 0 ? 'relative' : 'absolute', top: 0, left: 0, width: '100%', opacity: 0.85 }}>
              <LineChart series={s} color={colors[i]} width={1200} height={160} fill={false} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 164 }}>
            {labels.map((l, i) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i], display: 'inline-block' }} />
                {l}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Live Ticker Strip (top-5 assets from cryptos) ────────────────────────────

function LiveTickerStrip({ cryptos }: { cryptos: CryptoAsset[] }) {
  const top5 = cryptos.slice(0, 5);
  if (!top5.length) return null;

  return (
    <div style={{
      display: 'flex', gap: 0, borderBottom: '1px solid rgba(51,65,85,0.35)',
      background: 'rgba(10,14,33,0.6)', padding: '6px 24px', overflowX: 'auto',
    }}>
      {top5.map((c) => {
        const pos = (c.change24h ?? 0) >= 0;
        return (
          <div key={c.symbol} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px', borderRight: '1px solid rgba(51,65,85,0.3)' }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', fontWeight: 700 }}>{c.symbol}</span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#f1f5f9' }}>{fmt(c.price)}</span>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: pos ? '#22c55e' : '#ef4444' }}>
              {pos ? '▲' : '▼'} {Math.abs(c.change24h ?? 0).toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── About Section ─────────────────────────────────────────────────────────────

function AboutSection() {
  const [open, setOpen] = useState(true);
  return (
    <div style={{
      background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.4)',
      borderRadius: 8, padding: '14px 18px', marginTop: 16,
    }}>
      <div style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>
        About Spot Market
      </div>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8' }}>
          What is crypto spot market data and how does it differ from derivatives and futures data?
        </span>
        <span style={{ color: '#64748b', fontSize: 16, userSelect: 'none' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 10, fontSize: 10, color: '#64748b', fontFamily: 'monospace', lineHeight: 1.75 }}>
          Crypto spot market data captures live and historical information for immediate, on-chain-settled trades of digital
          assets, including trades, quotes, order depth, OHLCV bars, and reference indices. It reflects the true high-activity
          layer where assets exchange hands without leverage or contract structures — unlike derivatives data (futures, perpetuals,
          options) that represents synthetic exposure. Spot prices represent contracts referencing an underlying spot price,
          shaped by funding rates, margining, leverage, and term structure effects like contango.
        </div>
      )}
    </div>
  );
}

// ── Source Badge ──────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source?: 'coingecko' | 'mock' }) {
  if (!source) return null;
  const live = source === 'coingecko';
  return (
    <span style={{
      fontSize: 9, fontFamily: 'monospace', padding: '2px 7px', borderRadius: 999,
      background: live ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
      color: live ? '#22c55e' : '#f59e0b', marginLeft: 6,
    }}>
      {live ? '● COINGECKO LIVE' : '● MOCK DATA'}
    </span>
  );
}

// ── Main SpotMarket Component ─────────────────────────────────────────────────

const NAV_TABS: NavTab[] = [
   'Spot',
];

export function SpotMarket({ cryptos, summary, source, loading, defaultTab = 'Spot' }: SpotMarketProps) {
  const [activeTab, setActiveTab] = useState<NavTab>(defaultTab);

  return (
    <div style={{ background: '#060d1a', minHeight: '100vh', fontFamily: 'monospace', color: '#f1f5f9' }}>

      {/* ── Nav ── */}
      <div style={{
        background: 'rgba(6,13,26,0.95)',
        borderBottom: '1px solid rgba(51,65,85,0.4)',
        padding: '0 24px', display: 'flex', gap: 0,
      }}>
        {NAV_TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 16px', fontSize: 12, fontFamily: 'monospace',
            background: 'transparent', border: 'none',
            borderBottom: activeTab === tab ? '2px solid #22d3ee' : '2px solid transparent',
            color: activeTab === tab ? '#22d3ee' : '#64748b',
            cursor: 'pointer', fontWeight: activeTab === tab ? 700 : 400,
            transition: 'all 0.15s',
          }}>{tab}</button>
        ))}
      </div>

      {/* ── Live ticker strip ── */}
      <LiveTickerStrip cryptos={cryptos} />

      <div style={{ padding: '18px 24px' }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>Spot Market</span>
          <SourceBadge source={source} />
          <button style={{
            padding: '2px 8px', fontSize: 9, borderRadius: 4,
            border: '1px solid rgba(34,211,238,0.5)', background: 'rgba(34,211,238,0.08)',
            color: '#22d3ee', cursor: 'pointer', fontFamily: 'monospace',
          }}>See API Details</button>
        </div>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 18, lineHeight: 1.55 }}>
          Discover our cryptocurrency spot market data page, featuring crypto market cap, trading volumes, and historical
          performance. Analyze CEX and DEX activity, explore yearly trends, and make informed decisions with our easy-to-use
          API and detailed analytics tools.
        </div>

        {/* ── Market Cap block (live data injected) ── */}
        <MarketCapBlock cryptos={cryptos} summary={summary} loading={loading} />

        {/* ── Spot Volume + CEX side by side ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <SpotVolumeCard cryptos={cryptos} loading={loading} />
          <CEXVolumeCard loading={loading} />
        </div>

        {/* ── DEX full width ── */}
        <DEXVolumeCard loading={loading} />

        {/* ── About ── */}
        <AboutSection />
      </div>
    </div>
  );
}

// ── Default export for standalone usage / preview ────────────────────────────

export default function SpotMarketPreview() {
  // Simulated props that would come from CryptoTab in production
  const mockCryptos: CryptoAsset[] = [
    { symbol: 'BTC',  name: 'Bitcoin',  price: 83420,  change24h: -1.82, volume24h: 28_400_000_000, marketCap: 1_650_000_000_000 },
    { symbol: 'ETH',  name: 'Ethereum', price: 1910,   change24h: -3.14, volume24h: 12_100_000_000, marketCap: 230_000_000_000  },
    { symbol: 'BNB',  name: 'BNB',      price: 596,    change24h:  0.45, volume24h:  1_800_000_000, marketCap:  86_000_000_000  },
    { symbol: 'SOL',  name: 'Solana',   price: 127,    change24h: -4.11, volume24h:  4_200_000_000, marketCap:  61_000_000_000  },
    { symbol: 'XRP',  name: 'XRP',      price: 2.21,   change24h:  1.03, volume24h:  5_500_000_000, marketCap: 128_000_000_000  },
    { symbol: 'USDT', name: 'Tether',   price: 1.0,    change24h:  0.01, volume24h: 48_000_000_000, marketCap: 144_000_000_000  },
    { symbol: 'USDC', name: 'USD Coin', price: 1.0,    change24h: -0.01, volume24h:  7_000_000_000, marketCap:  44_000_000_000  },
  ];

  const mockSummary: ApiSummary = {
    totalMarketCap: 2_370_000_000_000,
    btcDominance: 57.5,
    top3Change: [-1.82, -3.14, 0.45],
  };

  return (
    <SpotMarket
      cryptos={mockCryptos}
      summary={mockSummary}
      source="coingecko"
      loading={false}
    />
  );
}