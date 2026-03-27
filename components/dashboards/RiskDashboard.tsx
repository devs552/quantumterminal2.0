'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Shield,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  RefreshCw,
  Zap,
  Globe,
  BarChart2,
  Lock,
  Droplets,
  ExternalLink,
  WifiOff,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RiskFactor {
  id: string;
  name: string;
  category: 'market' | 'macro' | 'liquidity' | 'geopolitical' | 'credit';
  value: number;
  rawValue: number | null;
  rawDisplay: string;
  delta: number;
  weight: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  description: string;
  ticker: string;
}

interface ApiPayload {
  success: boolean;
  factors: RiskFactor[];
  score: number;
  level: string;
  cascadingRisks: string[];
  recommendations: string[];
  fetchedAt: number;
  source: string;
  error?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  RiskFactor['category'],
  { label: string; color: string; icon: React.ReactNode }
> = {
  market:       { label: 'Market',       color: '#00D9FF', icon: <BarChart2 className="h-3.5 w-3.5" /> },
  macro:        { label: 'Macro',        color: '#FFD700', icon: <Globe    className="h-3.5 w-3.5" /> },
  liquidity:    { label: 'Liquidity',    color: '#0FFF50', icon: <Droplets className="h-3.5 w-3.5" /> },
  geopolitical: { label: 'Geo-Political',color: '#FFA500', icon: <Shield  className="h-3.5 w-3.5" /> },
  credit:       { label: 'Credit',       color: '#FF6B6B', icon: <Lock    className="h-3.5 w-3.5" /> },
};

const LEVEL_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  CRITICAL: { color: '#FF1744', bg: '#FF174415', border: '#FF174450', icon: <ShieldX     className="h-5 w-5" /> },
  HIGH:     { color: '#FFD700', bg: '#FFD70015', border: '#FFD70050', icon: <ShieldAlert className="h-5 w-5" /> },
  MEDIUM:   { color: '#FFA500', bg: '#FFA50015', border: '#FFA50050', icon: <ShieldAlert className="h-5 w-5" /> },
  LOW:      { color: '#0FFF50', bg: '#0FFF5015', border: '#0FFF5050', icon: <ShieldCheck className="h-5 w-5" /> },
};

// ── Data Hook ─────────────────────────────────────────────────────────────────

function useRiskData(autoRefreshMs = 60_000) {
  const [data, setData]       = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [autoOn, setAutoOn]   = useState(true);
  const intervalRef           = useRef<ReturnType<typeof setInterval> | null>(null);

  const runFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await window.fetch('/api/risk-data');
      const json = (await res.json()) as ApiPayload;
      if (!json.success) throw new Error(json.error ?? 'API returned success: false');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void runFetch(); }, [runFetch]);

  useEffect(() => {
    if (autoOn) {
      intervalRef.current = setInterval(() => { void runFetch(); }, autoRefreshMs);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoOn, autoRefreshMs, runFetch]);

  return { data, loading, error, autoOn, setAutoOn, refetch: runFetch };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MasterGauge({ score, level }: { score: number; level: string }) {
  const cfg  = LEVEL_CONFIG[level] ?? LEVEL_CONFIG['LOW'];
  const r    = 70;
  const circ = Math.PI * r;
  const fill = circ * (score / 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="220" height="130" viewBox="0 0 220 130">
        <path d={`M 20 112 A ${r} ${r} 0 0 1 200 112`}
          fill="none" stroke="#1A2040" strokeWidth="14" strokeLinecap="round" />
        <path d={`M 20 112 A ${r} ${r} 0 0 1 200 112`}
          fill="none" stroke={cfg.color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`}
          style={{
            filter: `drop-shadow(0 0 10px ${cfg.color}80)`,
            transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
        {[0, 25, 50, 75, 100].map(tick => {
          const a  = Math.PI * (tick / 100);
          const x1 = 110 - (r - 18) * Math.cos(a);
          const y1 = 112 - (r - 18) * Math.sin(a);
          const x2 = 110 - (r - 10) * Math.cos(a);
          const y2 = 112 - (r - 10) * Math.sin(a);
          return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2A3050" strokeWidth="2" />;
        })}
        <text x="110" y="97"  textAnchor="middle" fill={cfg.color} fontSize="34" fontWeight="800" fontFamily="monospace">{score}</text>
        <text x="110" y="114" textAnchor="middle" fill="#7A8391"   fontSize="10" fontFamily="monospace" letterSpacing="2">/100</text>
      </svg>
      <div
        className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-mono font-bold tracking-[0.2em]"
        style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, boxShadow: `0 0 18px ${cfg.color}30` }}
      >
        <span style={{ color: cfg.color }}>{cfg.icon}</span>
        {level} RISK
      </div>
    </div>
  );
}

function FactorRow({ factor }: { factor: RiskFactor }) {
  const cat        = CATEGORY_META[factor.category];
  const barColor   = factor.value >= 70 ? '#FF1744' : factor.value >= 50 ? '#FFD700' : '#0FFF50';
  const deltaColor = factor.delta > 0 ? '#FF6B6B' : factor.delta < 0 ? '#0FFF50' : '#7A8391';

  return (
    <div
      className="p-3 rounded-lg space-y-2 hover:brightness-110 transition-all cursor-default"
      style={{ background: '#0D1228', border: '1px solid #1A2040' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ color: cat.color }} className="shrink-0">{cat.icon}</span>
          <span className="text-[11px] font-mono text-[#B0B9C1] truncate">{factor.name}</span>
          <span className="text-[9px] font-mono text-[#3A4870] shrink-0 hidden sm:block">{factor.ticker}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-mono font-bold text-[#00D9FF]">{factor.rawDisplay}</span>
          <span className="text-[10px] font-mono" style={{ color: deltaColor }}>
            {factor.delta > 0 ? '▲' : factor.delta < 0 ? '▼' : '─'}
            {Math.abs(factor.delta).toFixed(1)}%
          </span>
          <span className="text-[12px] font-mono font-bold w-7 text-right" style={{ color: barColor }}>
            {Math.round(factor.value)}
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1A2040' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${factor.value}%`,
            background: `linear-gradient(90deg, #0FFF5080, ${barColor})`,
            transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>
      <p className="text-[9px] font-mono text-[#3A4870]">{factor.description}</p>
    </div>
  );
}

function CategoryHeatmap({ factors }: { factors: RiskFactor[] }) {
  const entries = Object.entries(CATEGORY_META) as [
    RiskFactor['category'],
    (typeof CATEGORY_META)[RiskFactor['category']]
  ][];

  return (
    <div className="grid grid-cols-5 gap-1.5">
      {entries.map(([key, meta]) => {
        const cf  = factors.filter(f => f.category === key);
        const avg = cf.length ? Math.round(cf.reduce((s, f) => s + f.value, 0) / cf.length) : 0;
        const heat =
          avg >= 70 ? '#FF1744' :
          avg >= 55 ? '#FF6B00' :
          avg >= 40 ? '#FFD700' :
          avg >= 25 ? '#88DD00' : '#0FFF50';
        return (
          <div key={key} className="flex flex-col items-center gap-1 p-2 rounded-lg"
            style={{ background: `${heat}12`, border: `1px solid ${heat}30` }}>
            <span style={{ color: heat }}>{meta.icon}</span>
            <div className="text-[10px] font-mono font-bold" style={{ color: heat }}>{avg}</div>
            <div className="text-[8px] font-mono text-[#7A8391] text-center leading-tight">{meta.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function SignalBreakdown({ factors }: { factors: RiskFactor[] }) {
  const rows = [
    { label: 'Bearish', key: 'bearish', color: '#FF1744', Icon: TrendingDown },
    { label: 'Neutral', key: 'neutral', color: '#7A8391', Icon: Activity     },
    { label: 'Bullish', key: 'bullish', color: '#0FFF50', Icon: TrendingUp   },
  ] as const;

  return (
    <div className="p-4 rounded-xl space-y-3" style={{ background: '#0D1228', border: '1px solid #1A2040' }}>
      <span className="text-[10px] font-mono text-[#7A8391] tracking-wider">SIGNAL BREAKDOWN</span>
      <div className="space-y-2">
        {rows.map(({ label, key, color, Icon }) => {
          const count = factors.filter(f => f.direction === key).length;
          const pct   = factors.length ? Math.round((count / factors.length) * 100) : 0;
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="flex items-center gap-1" style={{ color }}>
                  <Icon className="h-3 w-3" /> {label}
                </span>
                <span style={{ color }}>{count} · {pct}%</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: '#1A2040' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: color, opacity: 0.7, transition: 'width 0.8s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = '#00D9FF' }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="p-3 rounded-lg space-y-1" style={{ background: '#0D1228', border: '1px solid #1A2040' }}>
      <div className="text-[9px] font-mono text-[#7A8391] tracking-wider">{label}</div>
      <div className="text-xl font-mono font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-[#3A4870] truncate">{sub}</div>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="h-52 rounded-xl" style={{ background: '#0D1228' }} />
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-lg" style={{ background: '#0D1228' }} />)}
        </div>
      </div>
      <div className="h-28 rounded-xl" style={{ background: '#0D1228' }} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-20 rounded-lg" style={{ background: '#0D1228' }} />)}
        </div>
        <div className="space-y-3">
          <div className="h-40 rounded-xl" style={{ background: '#0D1228' }} />
          <div className="h-40 rounded-xl" style={{ background: '#0D1228' }} />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function RiskDashboard() {
  const { data, loading, error, autoOn, setAutoOn, refetch } = useRiskData(60_000);

  const levelCfg = LEVEL_CONFIG[data?.level ?? 'LOW'] ?? LEVEL_CONFIG['LOW'];
  const factors  = data?.factors ?? [];
  const score    = data?.score   ?? 0;
  const level    = data?.level   ?? '---';
  const bearish  = factors.filter(f => f.direction === 'bearish').length;
  const topRisk  = [...factors].sort((a, b) => b.value - a.value)[0];
  const vixFactor = factors.find(f => f.id === 'vix');

  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: '#070B18' }}>
      <div className="max-w-7xl mx-auto p-4 space-y-4">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1A2040]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: levelCfg.bg, border: `1px solid ${levelCfg.border}` }}>
              <ShieldAlert className="h-5 w-5" style={{ color: levelCfg.color }} />
            </div>
            <div>
              <h1 className="text-sm font-mono font-bold text-white tracking-[0.15em]">RISK COMMAND CENTRE</h1>
              <p className="text-[10px] font-mono text-[#3A4870]">
                {data?.fetchedAt
                  ? `Live data · ${new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  : 'Fetching Yahoo Finance data...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="https://finance.yahoo.com/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[9px] font-mono text-[#3A4870] hover:text-[#00D9FF] transition-colors px-2 py-1.5 rounded border border-[#1A2040]">
              <ExternalLink className="h-3 w-3" /> Yahoo Finance
            </a>
            <button
              onClick={() => setAutoOn(v => !v)}
              className="text-[10px] font-mono px-3 py-1.5 rounded transition-all"
              style={{
                color:      autoOn ? '#0FFF50' : '#7A8391',
                border:     `1px solid ${autoOn ? '#0FFF5040' : '#1A2040'}`,
                background: autoOn ? '#0FFF5010' : 'transparent',
              }}
            >
              {autoOn ? '● AUTO 60s' : '○ MANUAL'}
            </button>
            <button
              onClick={() => void refetch()}
              disabled={loading}
              className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded transition-all"
              style={{ color: '#00D9FF', border: '1px solid #00D9FF30', background: '#00D9FF10', opacity: loading ? 0.5 : 1 }}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              REFRESH
            </button>
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-lg text-xs font-mono"
            style={{ background: '#FF174412', border: '1px solid #FF174440', color: '#FF1744' }}>
            <WifiOff className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">Yahoo Finance fetch failed: {error}</div>
              <div className="opacity-60 text-[10px]">
                The <code className="bg-[#FF174420] px-1 rounded">/api/risk-data</code> route proxies requests server-side to avoid CORS.
                Ensure your Next.js dev server is running and Yahoo Finance is reachable.
              </div>
              <button onClick={() => void refetch()} className="underline hover:no-underline mt-1 block">Retry</button>
            </div>
          </div>
        )}

        {loading && !data ? (
          <Skeleton />
        ) : data ? (
          <>
            {/* ── Top Row: Gauge + Stat Cards ── */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-1 flex flex-col items-center justify-center p-4 rounded-xl"
                style={{ background: '#0D1228', border: `1px solid ${levelCfg.border}`, boxShadow: `0 0 30px ${levelCfg.color}18` }}>
                <MasterGauge score={score} level={level} />
              </div>
              <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="COMPOSITE SCORE" value={score} sub="weighted avg across all factors" color={levelCfg.color} />
                <StatCard label="BEARISH SIGNALS" value={`${bearish}/${factors.length}`} sub="factors in risk-off territory" color="#FF1744" />
                <StatCard
                  label="TOP RISK FACTOR"
                  value={topRisk ? Math.round(topRisk.value) : '—'}
                  sub={topRisk ? `${topRisk.name} · ${topRisk.rawDisplay}` : '—'}
                  color="#FFD700"
                />
                <StatCard
                  label="VIX LEVEL"
                  value={vixFactor?.rawDisplay ?? '—'}
                  sub={`normalised score: ${vixFactor?.value ?? '—'}/100`}
                  color="#00D9FF"
                />
              </div>
            </div>

            {/* ── Category Heatmap ── */}
            <div className="p-4 rounded-xl space-y-3" style={{ background: '#0D1228', border: '1px solid #1A2040' }}>
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-[#00D9FF]" />
                <span className="text-[10px] font-mono text-[#00D9FF] tracking-[0.2em]">CATEGORY HEATMAP</span>
                <span className="ml-auto text-[9px] font-mono text-[#3A4870]">avg normalised score / 100 per category</span>
              </div>
              <CategoryHeatmap factors={factors} />
            </div>

            {/* ── Factor Breakdown + Right Panel ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Sorted factor rows */}
              <div className="lg:col-span-2 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 className="h-3.5 w-3.5 text-[#00D9FF]" />
                  <span className="text-[10px] font-mono text-[#00D9FF] tracking-[0.2em]">RISK FACTOR BREAKDOWN</span>
                  <span className="ml-auto text-[9px] font-mono text-[#3A4870]">live · Yahoo Finance</span>
                </div>
                {[...factors]
                  .sort((a, b) => b.value - a.value)
                  .map(f => <FactorRow key={f.id} factor={f} />)
                }
              </div>

              {/* Right: risks + recommendations + signal breakdown */}
              <div className="space-y-4">

                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #FF174330' }}>
                  <div className="flex items-center gap-2 px-4 py-3"
                    style={{ background: '#FF174412', borderBottom: '1px solid #FF174420' }}>
                    <AlertTriangle className="h-3.5 w-3.5 text-[#FF1744]" />
                    <span className="text-[10px] font-mono font-bold text-[#FF1744] tracking-[0.2em]">CASCADING RISKS</span>
                  </div>
                  <div className="p-3 space-y-2" style={{ background: '#0D1228' }}>
                    {data.cascadingRisks.map((r, i) => (
                      <div key={i} className="flex gap-2 text-[11px] font-mono text-[#B0B9C1] p-2 rounded"
                        style={{ background: '#FF174408', border: '1px solid #FF174418' }}>
                        <span className="text-[#FF1744] shrink-0">⚠</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #0FFF5030' }}>
                  <div className="flex items-center gap-2 px-4 py-3"
                    style={{ background: '#0FFF5010', borderBottom: '1px solid #0FFF5020' }}>
                    <Zap className="h-3.5 w-3.5 text-[#0FFF50]" />
                    <span className="text-[10px] font-mono font-bold text-[#0FFF50] tracking-[0.2em]">RECOMMENDATIONS</span>
                  </div>
                  <div className="p-3 space-y-2" style={{ background: '#0D1228' }}>
                    {data.recommendations.map((rec, i) => (
                      <div key={i} className="flex gap-2 text-[11px] font-mono text-[#B0B9C1] p-2 rounded"
                        style={{ background: '#0FFF5008', border: '1px solid #0FFF5018' }}>
                        <span className="text-[#0FFF50] shrink-0">›</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <SignalBreakdown factors={factors} />
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="text-center text-[9px] font-mono text-[#1E2840] pb-2">
              DATA: Yahoo Finance public endpoints · Auto-refreshes every 60s · NOT FINANCIAL ADVICE
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}