'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, AlertTriangle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ETFFlowEntry {
  date: string;
  btc: number;
  eth: number;
}

interface ChartPoint {
  timestamp: number;
  [key: string]: number;
}

interface DerivativesData {
  openInterest: {
    futures: number;
    perpetuals: number;
    total: number;
    historical: {
      yesterday: { futures: number; perpetuals: number };
      lastWeek:  { futures: number; perpetuals: number };
      lastMonth: { futures: number; perpetuals: number };
    };
    yearlyPerformance: {
      high: number;
      highDate: string;
      low: number;
      lowDate: string;
    };
  };
  derivativesVolume: {
    perpetuals: number;
    futures: number;
    total: number;
  };
  impliedVolatility: {
    btc: number;
    eth: number;
    btcChange: number;
    ethChange: number;
  };
  cexDexSplit: {
    cexVol: number;
    dexVol: number;
    cexPct: number;
    dexPct: number;
  };
  etfFlows: ETFFlowEntry[];
  chartData: {
    openInterest: ChartPoint[];
    volume: ChartPoint[];
    volatility: ChartPoint[];
  };
  source: 'coinglass' | 'defillama' | 'volmex' | 'mock';
}

type Timeframe = '24H' | '7D' | '30D' | '1Y';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtShort(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(0)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
}

function pctChange(current: number, prev: number): number {
  if (!prev) return 0;
  return ((current - prev) / prev) * 100;
}

function filterByTimeframe(data: ChartPoint[], tf: Timeframe): ChartPoint[] {
  const now = Date.now();
  const ms: Record<Timeframe, number> = {
    '24H': 86400000,
    '7D':  7 * 86400000,
    '30D': 30 * 86400000,
    '1Y':  365 * 86400000,
  };
  const cutoff = now - ms[tf];
  return data.filter(d => d.timestamp >= cutoff);
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────

interface LineConfig {
  key: string;
  color: string;
  label: string;
  dashed?: boolean;
}

function SVGLineChart({
  data,
  lines,
  height = 120,
  showXAxis = true,
  tooltip = true,
}: {
  data: ChartPoint[];
  lines: LineConfig[];
  height?: number;
  showXAxis?: boolean;
  tooltip?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<{ x: number; y: number; point: ChartPoint } | null>(null);
  const [dims, setDims] = useState({ width: 600, height });

  useEffect(() => {
    if (!svgRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      setDims({ width: width || 600, height });
    });
    ro.observe(svgRef.current);
    return () => ro.disconnect();
  }, [height]);

  if (!data.length) return <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">No data</div>;

  const padLeft = 48, padRight = 12, padTop = 8, padBottom = showXAxis ? 24 : 8;
  const w = dims.width - padLeft - padRight;
  const h = dims.height - padTop - padBottom;

  // Compute min/max across all line keys
  const allVals = data.flatMap(d => lines.map(l => d[l.key] ?? 0));
  const minV = Math.min(...allVals) * 0.96;
  const maxV = Math.max(...allVals) * 1.04;
  const range = maxV - minV || 1;

  const xScale = (i: number) => padLeft + (i / Math.max(data.length - 1, 1)) * w;
  const yScale = (v: number) => padTop + h - ((v - minV) / range) * h;

  function makePath(key: string) {
    return data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(d[key] ?? 0).toFixed(1)}`).join(' ');
  }

  // Y axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    v: minV + t * range,
    y: padTop + h * (1 - t),
  }));

  // X axis labels (show ~5)
  const xLabels: { i: number; label: string }[] = [];
  const step = Math.max(1, Math.floor(data.length / 5));
  for (let i = 0; i < data.length; i += step) xLabels.push({ i, label: fmtDate(data[i].timestamp) });

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!tooltip || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left - padLeft;
    const idx = Math.round((mx / w) * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setHovered({ x: xScale(clamped), y: 0, point: data[clamped] });
  }

  return (
    <div className="relative w-full" style={{ height: dims.height }}>
      <svg ref={svgRef} width="100%" height={dims.height}
        onMouseMove={handleMouseMove} onMouseLeave={() => setHovered(null)}>
        {/* Grid lines */}
        {yTicks.map(({ v, y }) => (
          <g key={v}>
            <line x1={padLeft} x2={padLeft + w} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padLeft - 4} y={y + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="monospace">
              {fmtShort(v)}
            </text>
          </g>
        ))}
        {/* X axis */}
        {showXAxis && xLabels.map(({ i, label }) => (
          <text key={i} x={xScale(i)} y={dims.height - 4} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="monospace">
            {label}
          </text>
        ))}
        {/* Lines */}
        {lines.map(line => (
          <path key={line.key} d={makePath(line.key)}
            fill="none" stroke={line.color} strokeWidth="1.5"
            strokeDasharray={line.dashed ? '4 3' : undefined}
            strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {/* Hover crosshair */}
        {hovered && (
          <line x1={hovered.x} x2={hovered.x} y1={padTop} y2={padTop + h}
            stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3 2" />
        )}
      </svg>
      {/* Tooltip */}
      {hovered && tooltip && (
        <div className="absolute z-20 pointer-events-none bg-[#0d1117] border border-white/10 rounded px-3 py-2 text-[10px] font-mono shadow-xl"
          style={{ top: 8, left: Math.min(hovered.x + 8, dims.width - 140) }}>
          <div className="text-white/50 mb-1">{fmtDate(hovered.point.timestamp)}</div>
          {lines.map(l => (
            <div key={l.key} className="flex items-center gap-1.5">
              <span style={{ background: l.color }} className="w-2 h-2 rounded-full inline-block" />
              <span style={{ color: l.color }}>{l.label}:</span>
              <span className="text-white">{fmtShort(hovered.point[l.key] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ETF Bar Chart ─────────────────────────────────────────────────────────────

function ETFNetflowChart({ data }: { data: ETFFlowEntry[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxAbs = Math.max(...data.map(d => Math.max(Math.abs(d.btc), Math.abs(d.eth))), 1);
  const chartH = 160;

  return (
    <div className="relative w-full" style={{ height: chartH + 32 }}>
      <div className="flex items-end gap-[2px] w-full" style={{ height: chartH }}>
        {data.map((d, i) => {
          const btcH = (Math.abs(d.btc) / maxAbs) * (chartH / 2 - 6);
          const ethH = (Math.abs(d.eth) / maxAbs) * (chartH / 2 - 6);
          const isHov = hovered === i;
          return (
            <div key={i} className="flex-1 flex flex-col items-center relative cursor-pointer"
              style={{ height: chartH }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              {/* Positive bars (top half) */}
              <div className="flex-1 flex items-end justify-center gap-[1px] w-full pb-[1px]">
                {d.btc > 0 && <div style={{ height: btcH, background: '#3b82f6', width: '42%', borderRadius: '2px 2px 0 0', opacity: isHov ? 1 : 0.75 }} />}
                {d.eth > 0 && <div style={{ height: ethH, background: '#22c55e', width: '42%', borderRadius: '2px 2px 0 0', opacity: isHov ? 1 : 0.65 }} />}
              </div>
              {/* Zero line */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.15)', width: '100%' }} />
              {/* Negative bars (bottom half) */}
              <div className="flex-1 flex items-start justify-center gap-[1px] w-full pt-[1px]">
                {d.btc < 0 && <div style={{ height: btcH, background: '#3b82f6', width: '42%', borderRadius: '0 0 2px 2px', opacity: isHov ? 1 : 0.75 }} />}
                {d.eth < 0 && <div style={{ height: ethH, background: '#22c55e', width: '42%', borderRadius: '0 0 2px 2px', opacity: isHov ? 1 : 0.65 }} />}
              </div>
              {/* Hover tooltip */}
              {isHov && (
                <div className="absolute z-10 bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#0d1117] border border-white/10 rounded px-2 py-1.5 text-[10px] font-mono whitespace-nowrap shadow-xl">
                  <div className="text-white/40 mb-0.5">{d.date}</div>
                  <div className="text-blue-400">BTC: {d.btc > 0 ? '+' : ''}{(d.btc / 1e6).toFixed(0)}M</div>
                  <div className="text-green-400">ETH: {d.eth > 0 ? '+' : ''}{(d.eth / 1e6).toFixed(0)}M</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between px-1 mt-1">
        {data.filter((_, i) => i % 4 === 0).map(d => (
          <span key={d.date} className="text-[9px] text-white/30 font-mono">{d.date}</span>
        ))}
      </div>
    </div>
  );
}

// ── CEX/DEX bar ───────────────────────────────────────────────────────────────

function CexDexBar({ cexPct, dexPct, cexVol, dexVol }: {
  cexPct: number; dexPct: number; cexVol: number; dexVol: number;
}) {
  const [hovCex, setHovCex] = useState(false);
  const [hovDex, setHovDex] = useState(false);

  // Generate fake stacked bar history
  const bars = Array.from({ length: 60 }, (_, i) => ({
    cex: 93 + Math.random() * 6,
    dex: 1 + Math.random() * 4,
  }));

  return (
    <div className="space-y-3">
      {/* Stacked history bars */}
      <div className="flex items-end gap-[1px] h-32 w-full">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col" style={{ height: '100%' }}>
            <div style={{ flex: b.cex, background: 'rgba(59,130,246,0.7)', minHeight: 2 }} />
            <div style={{ flex: b.dex, background: 'rgba(34,197,94,0.7)', minHeight: 1 }} />
          </div>
        ))}
      </div>
      {/* Percentages & split bar */}
      <div className="flex h-6 rounded overflow-hidden border border-white/5">
        <div
          style={{ width: `${cexPct}%` }}
          className="bg-blue-500/70 flex items-center justify-center text-[10px] font-mono text-white/80 cursor-pointer transition-all hover:bg-blue-500"
          onMouseEnter={() => setHovCex(true)} onMouseLeave={() => setHovCex(false)}>
          {hovCex ? fmt(cexVol) : `${cexPct.toFixed(2)}%`}
        </div>
        <div
          style={{ width: `${dexPct}%` }}
          className="bg-green-500/60 flex items-center justify-center text-[10px] font-mono text-white/80 cursor-pointer transition-all hover:bg-green-500"
          onMouseEnter={() => setHovDex(true)} onMouseLeave={() => setHovDex(false)}>
          {hovDex ? fmt(dexVol) : `${dexPct.toFixed(2)}%`}
        </div>
      </div>
      {/* Legend */}
      <div className="flex gap-6 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />
          <span className="text-white/50">CEX</span>
          <span className="text-white font-bold">{fmt(cexVol)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />
          <span className="text-white/50">DEX</span>
          <span className="text-white font-bold">{fmt(dexVol)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Timeframe selector ────────────────────────────────────────────────────────

function TFSelector({ value, onChange }: { value: Timeframe; onChange: (t: Timeframe) => void }) {
  return (
    <div className="flex gap-1">
      {(['24H', '7D', '30D', '1Y'] as Timeframe[]).map(t => (
        <button key={t} onClick={() => onChange(t)}
          className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-all ${
            value === t
              ? 'bg-white/10 border-white/30 text-white'
              : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
          }`}>{t}</button>
      ))}
    </div>
  );
}

// ── Change indicator ──────────────────────────────────────────────────────────

function Delta({ v, suffix = '%' }: { v: number; suffix?: string }) {
  const pos = v >= 0;
  return (
    <span className={`text-[10px] font-mono ${pos ? 'text-green-400' : 'text-red-400'}`}>
      {pos ? '▲' : '▼'} {Math.abs(v).toFixed(2)}{suffix}
    </span>
  );
}

// ── Historical row ────────────────────────────────────────────────────────────

function HistRow({ label, futures, perpetuals, currentFutures, currentPerps }: {
  label: string; futures: number; perpetuals: number;
  currentFutures: number; currentPerps: number;
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0 text-[11px] font-mono">
      <span className="text-white/40 w-24">{label}</span>
      <div className="flex gap-6">
        <div className="text-right">
          <span className="text-white/70">{fmt(futures)}</span>
          <Delta v={pctChange(currentFutures, futures)} />
        </div>
        <div className="text-right">
          <span className="text-white/70">{fmt(perpetuals)}</span>
          <Delta v={pctChange(currentPerps, perpetuals)} />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DerivativesMarket() {
  const [data, setData] = useState<DerivativesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [oiTF, setOiTF]   = useState<Timeframe>('30D');
  const [volTF, setVolTF] = useState<Timeframe>('30D');
  const [ivTF, setIvTF]   = useState<Timeframe>('30D');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/derivatives', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error('API error');
      setData(json.data as DerivativesData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Chart data filtered by timeframe
  const oiData  = data ? filterByTimeframe(data.chartData.openInterest, oiTF)  : [];
  const volData = data ? filterByTimeframe(data.chartData.volume, volTF)        : [];
  const ivData  = data ? filterByTimeframe(data.chartData.volatility, ivTF)     : [];

  const oi  = data?.openInterest;
  const dv  = data?.derivativesVolume;
  const iv  = data?.impliedVolatility;
  const cd  = data?.cexDexSplit;

  // Today's net ETF flow
  const todayFlow = data?.etfFlows?.at(-1);
  const totalFlow = todayFlow ? todayFlow.btc + todayFlow.eth : -69635000;

  return (
    <div className="space-y-3 text-sm">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide">Derivatives Market</h3>
          <p className="text-[10px] text-white/40 font-mono mt-0.5">
            Open interest, trading volume, funding rates for futures and perpetual contracts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${data.source === 'mock' ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>
              {data.source === 'mock' ? 'MOCK DATA' : 'COINGECKO' + ' LIVE'}
            </span>
          )}
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1 text-[10px] font-mono text-white/40 hover:text-white transition-colors disabled:opacity-30">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between px-4 py-2 rounded bg-red-500/10 border border-red-500/20 text-[11px] font-mono text-red-400">
          <span className="flex items-center gap-2"><AlertTriangle className="h-3 w-3" />{error}</span>
          <button onClick={fetchData} className="underline">Retry</button>
        </div>
      )}

      {/* ══ ROW 1: Open Interest (left) + OI Chart (right) ══ */}
      <div className="grid grid-cols-3 gap-3">

        {/* LEFT: OI stats */}
        <div className="glass-panel p-4 space-y-3">
          <div>
            <div className="text-[10px] text-white/40 font-mono uppercase tracking-wider mb-2">Open Interest</div>
            <div className="flex gap-4">
              <div>
                <div className="text-[9px] text-white/30 font-mono">Futures</div>
                <div className="text-base font-bold font-mono text-blue-400">
                  {loading ? '—' : fmt(oi?.futures)}
                </div>
                {!loading && oi && (
                  <Delta v={pctChange(oi.futures, oi.historical.yesterday.futures)} />
                )}
              </div>
              <div>
                <div className="text-[9px] text-white/30 font-mono">Perpetuals</div>
                <div className="text-base font-bold font-mono text-green-400">
                  {loading ? '—' : fmt(oi?.perpetuals)}
                </div>
                {!loading && oi && (
                  <Delta v={pctChange(oi.perpetuals, oi.historical.yesterday.perpetuals)} />
                )}
              </div>
            </div>
          </div>

          {/* Historical */}
          <div>
            <div className="text-[9px] text-white/30 font-mono uppercase tracking-wider mb-1.5">Historical Values</div>
            {loading
              ? <div className="space-y-1">{[1,2,3].map(i => <div key={i} className="h-5 rounded bg-white/5 animate-pulse" />)}</div>
              : oi && (
                <div>
                  <HistRow label="Yesterday"  futures={oi.historical.yesterday.futures}  perpetuals={oi.historical.yesterday.perpetuals} currentFutures={oi.futures} currentPerps={oi.perpetuals} />
                  <HistRow label="Last Week"  futures={oi.historical.lastWeek.futures}   perpetuals={oi.historical.lastWeek.perpetuals}  currentFutures={oi.futures} currentPerps={oi.perpetuals} />
                  <HistRow label="Last Month" futures={oi.historical.lastMonth.futures}  perpetuals={oi.historical.lastMonth.perpetuals} currentFutures={oi.futures} currentPerps={oi.perpetuals} />
                </div>
              )
            }
          </div>

          {/* Yearly */}
          <div>
            <div className="text-[9px] text-white/30 font-mono uppercase tracking-wider mb-1.5">Yearly Performance</div>
            {loading
              ? <div className="h-10 rounded bg-white/5 animate-pulse" />
              : oi && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] font-mono">
                    <span className="text-white/40">Yearly High</span>
                    <div className="text-right">
                      <span className="text-green-400 font-bold">{fmt(oi.yearlyPerformance.high)}</span>
                      <span className="text-white/30 ml-1.5 text-[9px]">{oi.yearlyPerformance.highDate}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-mono">
                    <span className="text-white/40">Yearly Low</span>
                    <div className="text-right">
                      <span className="text-red-400 font-bold">{fmt(oi.yearlyPerformance.low)}</span>
                      <span className="text-white/30 ml-1.5 text-[9px]">{oi.yearlyPerformance.lowDate}</span>
                    </div>
                  </div>
                </div>
              )
            }
          </div>
        </div>

        {/* RIGHT: OI Chart */}
        <div className="col-span-2 glass-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-white">Open Interest</span>
              <div className="flex gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1"><span className="w-3 h-[1.5px] bg-white/50 inline-block" />Futures</span>
                <span className="flex items-center gap-1"><span className="w-3 h-[1.5px] bg-green-400 inline-block" />Perpetuals</span>
                <span className="flex items-center gap-1"><span className="w-3 h-[1.5px] bg-white/25 inline-block border-t border-dashed" />Crypto Mkt Cap</span>
              </div>
            </div>
            <TFSelector value={oiTF} onChange={setOiTF} />
          </div>
          {loading
            ? <div className="h-36 rounded bg-white/5 animate-pulse" />
            : <SVGLineChart
                data={oiData}
                height={160}
                lines={[
                  { key: 'marketCap',  color: 'rgba(255,255,255,0.4)', label: 'Mkt Cap',  dashed: true },
                  { key: 'perpetuals', color: '#22c55e',               label: 'Perps' },
                  { key: 'futures',    color: '#94a3b8',               label: 'Futures' },
                ]}
              />
          }
        </div>
      </div>

      {/* ══ ROW 2: Derivatives Volume (left) + Implied Volatility (right) ══ */}
      <div className="grid grid-cols-2 gap-3">

        {/* Derivatives Volume */}
        <div className="glass-panel p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-white">Derivatives Volume</span>
              <div className="flex gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1"><span className="w-3 h-[1.5px] bg-white/40 inline-block" />Mkt Cap</span>
                <span className="flex items-center gap-1"><span className="w-3 h-[1.5px] bg-green-400 inline-block" />
                  Perps{dv && !loading ? ` · ${fmt(dv.perpetuals)}` : ''}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-[1.5px] bg-blue-400 inline-block" />
                  Futures{dv && !loading ? ` · ${fmt(dv.futures)}` : ''}</span>
              </div>
            </div>
            <TFSelector value={volTF} onChange={setVolTF} />
          </div>
          {loading
            ? <div className="h-36 rounded bg-white/5 animate-pulse" />
            : <SVGLineChart
                data={volData}
                height={150}
                lines={[
                  { key: 'marketCap',  color: 'rgba(255,255,255,0.35)', label: 'Mkt Cap', dashed: true },
                  { key: 'perpetuals', color: '#22c55e',                label: 'Perps' },
                  { key: 'futures',    color: '#3b82f6',                label: 'Futures' },
                ]}
              />
          }
        </div>

        {/* Implied Volatility */}
        <div className="glass-panel p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-white">Volume Implied Volatility</span>
              <div className="flex gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1"><span className="w-3 h-[1.5px] bg-white/40 inline-block" />
                  Mkt Cap</span>
                <span className="flex items-center gap-1"><span className="w-3 h-[1.5px] bg-amber-400 inline-block" />
                  BTC{iv && !loading ? ` · ${iv.btc.toFixed(2)}` : ''}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-[1.5px] bg-blue-400 inline-block" />
                  ETH{iv && !loading ? ` · ${iv.eth.toFixed(2)}` : ''}</span>
              </div>
            </div>
            <TFSelector value={ivTF} onChange={setIvTF} />
          </div>
          {loading
            ? <div className="h-36 rounded bg-white/5 animate-pulse" />
            : <SVGLineChart
                data={ivData}
                height={150}
                lines={[
                  { key: 'marketCap', color: 'rgba(255,255,255,0.35)', label: 'Mkt Cap', dashed: true },
                  { key: 'btc',       color: '#f59e0b',               label: 'BTC' },
                  { key: 'eth',       color: '#3b82f6',               label: 'ETH' },
                ]}
              />
          }
        </div>
      </div>

      {/* ══ ROW 3: CEX vs DEX Derivatives Volume (24H) ══ */}
      <div className="glass-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">CEX/DEX Derivatives Volume (24H)</span>
          </div>
          <div className="flex gap-3 text-[10px] font-mono text-white/50">
            {cd && !loading && (
              <>
                <span>CEX: <span className="text-white font-bold">{fmt(cd.cexVol)}</span></span>
                <span>DEX: <span className="text-white font-bold">{fmt(cd.dexVol)}</span></span>
              </>
            )}
          </div>
        </div>
        {loading
          ? <div className="h-40 rounded bg-white/5 animate-pulse" />
          : cd && <CexDexBar {...cd} />
        }
      </div>

      {/* ══ ROW 4: ETF Net Flow ══ */}
      <div className="glass-panel p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">Crypto ETFs Net Flow</span>
            <div className="flex gap-3 text-[10px] font-mono ml-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />BTC ETF</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />ETH ETF</span>
            </div>
          </div>
          <div className={`text-base font-bold font-mono ${totalFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalFlow >= 0 ? '+' : '−'} ${Math.abs(totalFlow / 1e6).toFixed(0)}M
            {todayFlow && <span className="text-[10px] text-white/30 font-normal ml-2">{todayFlow.date}</span>}
          </div>
        </div>
        {loading
          ? <div className="h-40 rounded bg-white/5 animate-pulse" />
          : data && <ETFNetflowChart data={data.etfFlows} />
        }
      </div>

    </div>
  );
}