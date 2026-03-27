'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Brain,
  Zap,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Shield,
  Target,
  Activity,
  ChevronRight,
  Radio,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TechnicalAnalysis {
  trend: string;
  support: number;
  resistance: number;
  momentum: string;
}

interface Fundamentals {
  sentiment: string;
  news: string;
  macroFactors: string;
}

interface AIInsights {
  prediction: string;
  confidence: number;
  cascadingRisks: string[];
  recommendations: string[];
}

interface AnalysisData {
  summary: string;
  technicalAnalysis: TechnicalAnalysis;
  fundamentals: Fundamentals;
  ai_insights: AIInsights;
  timeframe: string;
}

interface RiskAssessment {
  score: number;
  level: string;
  cascadingRisks: string[];
  recommendations: string[];
}

interface ApiResponse {
  success: boolean;
  asset: string;
  period: string;
  riskAssessment: RiskAssessment;
  analysis: AnalysisData;
  timestamp: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ASSETS = ['BTC', 'ETH', 'SPY', 'QQQ', 'GOLD', 'DXY', 'EUR/USD'];
const PERIODS = ['1h', '4h', '24h', '7d', '30d'];

const RISK_CONFIG: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  CRITICAL: { color: '#FF1744', bg: '#FF174412', border: '#FF174440', glow: '0 0 20px #FF174430' },
  HIGH:     { color: '#FFD700', bg: '#FFD70012', border: '#FFD70040', glow: '0 0 20px #FFD70025' },
  MEDIUM:   { color: '#FFA500', bg: '#FFA50012', border: '#FFA50040', glow: '0 0 20px #FFA50020' },
  LOW:      { color: '#0FFF50', bg: '#0FFF5012', border: '#0FFF5040', glow: '0 0 20px #0FFF5025' },
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useAnalysis(asset: string, period: string) {
  const [data, setData]           = useState<ApiResponse | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset, period }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      if (!json.success) throw new Error('API returned success: false');
      setData(json);
      setFetchedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [asset, period]);

  useEffect(() => { void run(); }, [run]);

  return { data, loading, error, fetchedAt, refetch: run };
}

function useStream(asset: string) {
  const [lines, setLines]       = useState<string[]>([]);
  const [streaming, setStream]  = useState(false);
  const abortRef                = useRef<AbortController | null>(null);

  const start = useCallback(() => {
    if (streaming) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLines([]);
    setStream(true);

    void (async () => {
      try {
        const res = await window.fetch(
          `/api/ai/analyze?asset=${encodeURIComponent(asset)}`,
          { signal: ctrl.signal },
        );
        if (!res.body) throw new Error('No body');
        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          setLines(p => [...p, ...text.split('\n').filter(Boolean)]);
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setLines(p => [...p, '⚠ Stream interrupted']);
        }
      } finally {
        setStream(false);
      }
    })();
  }, [asset, streaming]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { lines, streaming, start };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AssetSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {ASSETS.map(a => (
        <button
          key={a}
          onClick={() => onChange(a)}
          className="px-3 py-1 text-[11px] font-mono font-bold tracking-wider rounded transition-all duration-200"
          style={{
            color:           a === value ? '#0A0E27' : '#7A8391',
            background:      a === value ? '#00D9FF' : 'transparent',
            border:          `1px solid ${a === value ? '#00D9FF' : '#1E2440'}`,
            boxShadow:       a === value ? '0 0 12px #00D9FF50' : 'none',
          }}
        >
          {a}
        </button>
      ))}
    </div>
  );
}

function PeriodSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1">
      {PERIODS.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className="px-2 py-1 text-[10px] font-mono tracking-wider rounded transition-all duration-200"
          style={{
            color:      p === value ? '#FFD700' : '#7A8391',
            background: p === value ? '#FFD70015' : 'transparent',
            border:     `1px solid ${p === value ? '#FFD70050' : '#1E2440'}`,
          }}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function RiskOrb({ score, level }: { score: number; level: string }) {
  const cfg = RISK_CONFIG[level] ?? RISK_CONFIG['LOW'];
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ filter: `drop-shadow(${cfg.glow})` }}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          {/* Track */}
          <circle cx="70" cy="70" r="54" fill="none" stroke="#1E2440" strokeWidth="8" />
          {/* Progress */}
          <circle
            cx="70" cy="70" r="54"
            fill="none"
            stroke={cfg.color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 70 70)"
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
          />
          {/* Score text */}
          <text x="70" y="62" textAnchor="middle" fill={cfg.color} fontSize="28" fontWeight="700" fontFamily="monospace">
            {score}
          </text>
          <text x="70" y="80" textAnchor="middle" fill="#7A8391" fontSize="10" fontFamily="monospace">
            /100
          </text>
          <text x="70" y="96" textAnchor="middle" fill={cfg.color} fontSize="9" fontFamily="monospace" letterSpacing="3">
            {level}
          </text>
        </svg>
      </div>
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'Bullish')       return <TrendingUp   className="h-4 w-4 text-[#0FFF50]" />;
  if (trend === 'Bearish')       return <TrendingDown className="h-4 w-4 text-[#FF1744]" />;
  return                                <Minus        className="h-4 w-4 text-[#FFD700]" />;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? '#0FFF50' : pct >= 55 ? '#FFD700' : '#FF1744';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-[#7A8391]">CONFIDENCE</span>
        <span style={{ color }} className="font-bold">{pct}%</span>
      </div>
      <div className="h-1 bg-[#0A0E27] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color, transition: 'width 0.8s ease', opacity: 0.85 }}
        />
      </div>
    </div>
  );
}

function Panel({
  children,
  className = '',
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-lg border backdrop-blur-sm ${className}`}
      style={{ background: '#1A1F3A80', borderColor: '#00D9FF20', ...style }}
    >
      {children}
    </div>
  );
}

function PanelHeader({
  icon,
  label,
  accent = '#00D9FF',
}: {
  icon: React.ReactNode;
  label: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[#00D9FF15]">
      <span style={{ color: accent }}>{icon}</span>
      <span className="text-xs font-mono font-bold tracking-[0.2em]" style={{ color: accent }}>
        {label}
      </span>
    </div>
  );
}

function StreamFeed({
  lines,
  streaming,
  onStart,
}: {
  lines: string[];
  streaming: boolean;
  onStart: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <Panel style={{ borderColor: '#FFD70025' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#FFD70015]">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-[#FFD700]" />
          <span className="text-xs font-mono font-bold tracking-[0.2em] text-[#FFD700]">LIVE STREAM</span>
        </div>
        {streaming ? (
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#0FFF50]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0FFF50] animate-pulse" />
            RECEIVING
          </span>
        ) : (
          <button
            onClick={onStart}
            className="text-[10px] font-mono px-3 py-1 rounded transition-all duration-200"
            style={{
              color: '#00D9FF',
              border: '1px solid #00D9FF40',
              background: '#00D9FF10',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#00D9FF20';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#00D9FF80';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#00D9FF10';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#00D9FF40';
            }}
          >
            ▶ RUN STREAM
          </button>
        )}
      </div>
      <div
        className="p-3 font-mono text-[11px] space-y-1 overflow-y-auto"
        style={{ minHeight: 100, maxHeight: 200, background: '#0A0E2780' }}
      >
        {lines.length === 0 && !streaming && (
          <div className="text-[#3A4055] pt-2 text-center">
            Press RUN STREAM to receive live analysis feed
          </div>
        )}
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2 text-[#8A9BB0] leading-relaxed">
            <span className="text-[#00D9FF40] shrink-0 select-none">›</span>
            <span>{line}</span>
          </div>
        ))}
        {streaming && (
          <span className="text-[#0FFF50] animate-pulse select-none">▋</span>
        )}
        <div ref={bottomRef} />
      </div>
    </Panel>
  );
}

function SkeletonPulse() {
  return (
    <div className="space-y-4 animate-pulse">
      {[['60%', '30%'], ['80%', '45%'], ['50%', '60%']].map(([w1, h], i) => (
        <Panel key={i}>
          <div className="p-4 space-y-3">
            <div className="h-3 rounded bg-[#00D9FF10]" style={{ width: w1 }} />
            <div className="h-8 rounded bg-[#00D9FF08]" />
            <div className="h-2 rounded bg-[#00D9FF10]" style={{ width: h }} />
          </div>
        </Panel>
      ))}
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export function AIAnalysisTab() {
  const [asset, setAsset]   = useState('BTC');
  const [period, setPeriod] = useState('24h');

  const { data, loading, error, fetchedAt, refetch } = useAnalysis(asset, period);
  const { lines, streaming, start }                   = useStream(asset);

  const riskCfg   = RISK_CONFIG[data?.riskAssessment.level ?? 'LOW'] ?? RISK_CONFIG['LOW'];
  const score     = data?.riskAssessment.score  ?? 0;
  const level     = data?.riskAssessment.level  ?? '---';
  const tech      = data?.analysis.technicalAnalysis;
  const insights  = data?.analysis.ai_insights;
  const funds     = data?.analysis.fundamentals;
  const confidence = insights?.confidence ?? 0;

  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: '#080B1A' }}>
      <div className="max-w-6xl mx-auto p-4 space-y-4">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-2 border-b border-[#00D9FF15]">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ background: '#00D9FF15', border: '1px solid #00D9FF30' }}
            >
              <Brain className="h-5 w-5 text-[#00D9FF]" />
            </div>
            <div>
              <h1 className="text-base font-mono font-bold text-white tracking-wider">AI ANALYSIS ENGINE</h1>
              <p className="text-[11px] font-mono text-[#7A8391]">
                {fetchedAt
                  ? `Last updated ${new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  : 'Awaiting data...'}
              </p>
            </div>
          </div>
          <button
            onClick={() => void refetch()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-mono font-bold tracking-wider transition-all duration-200"
            style={{
              color: '#00D9FF',
              border: '1px solid #00D9FF30',
              background: '#00D9FF10',
              opacity: loading ? 0.5 : 1,
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'ANALYSING...' : 'REFRESH'}
          </button>
        </div>

        {/* ── Controls ── */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <AssetSelector value={asset} onChange={a => { setAsset(a); }} />
          <PeriodSelector value={period} onChange={p => { setPeriod(p); }} />
        </div>

        {/* ── Error ── */}
        {error && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-mono"
            style={{ background: '#FF174412', border: '1px solid #FF174440', color: '#FF1744' }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {error} —{' '}
              <button onClick={() => void refetch()} className="underline hover:no-underline">
                retry
              </button>
            </span>
          </div>
        )}

        {loading && !data ? (
          <SkeletonPulse />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-4">

              {/* Risk Orb */}
              <Panel style={{ borderColor: riskCfg.border }}>
                <PanelHeader
                  icon={<Shield className="h-3.5 w-3.5" />}
                  label="RISK SCORE"
                  accent={riskCfg.color}
                />
                <div className="p-4 flex flex-col items-center gap-4">
                  <RiskOrb score={score} level={level} />
                  <ConfidenceBar value={confidence} />
                  <div
                    className="w-full text-center text-[10px] font-mono px-3 py-2 rounded"
                    style={{ background: riskCfg.bg, color: riskCfg.color, border: `1px solid ${riskCfg.border}` }}
                  >
                    {insights?.prediction ?? '—'}
                  </div>
                </div>
              </Panel>

              {/* Technical */}
              {tech && (
                <Panel>
                  <PanelHeader
                    icon={<Activity className="h-3.5 w-3.5" />}
                    label="TECHNICALS"
                  />
                  <div className="p-4 grid grid-cols-2 gap-3">
                    {[
                      { label: 'TREND',      value: tech.trend,           icon: <TrendIcon trend={tech.trend} /> },
                      { label: 'MOMENTUM',   value: tech.momentum,        icon: <Zap className="h-4 w-4 text-[#FFD700]" /> },
                      { label: 'SUPPORT',    value: `${tech.support > 0 ? '+' : ''}${tech.support}%`, icon: <TrendingDown className="h-4 w-4 text-[#FF1744]" /> },
                      { label: 'RESISTANCE', value: `+${tech.resistance}%`, icon: <TrendingUp className="h-4 w-4 text-[#0FFF50]" /> },
                    ].map(({ label, value, icon }) => (
                      <div
                        key={label}
                        className="rounded p-2 space-y-1"
                        style={{ background: '#0A0E2760', border: '1px solid #1E244080' }}
                      >
                        <div className="flex items-center gap-1">
                          {icon}
                          <span className="text-[9px] font-mono text-[#7A8391] tracking-wider">{label}</span>
                        </div>
                        <div className="text-xs font-mono font-bold text-white">{value}</div>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </div>

            {/* ── CENTRE COLUMN ── */}
            <div className="space-y-4">

              {/* AI Summary */}
              {data?.analysis.summary && (
                <Panel>
                  <PanelHeader
                    icon={<Brain className="h-3.5 w-3.5" />}
                    label="AI SUMMARY"
                  />
                  <div className="p-4 space-y-3">
                    <p className="text-xs font-mono text-[#B0B9C1] leading-relaxed">
                      {data.analysis.summary}
                    </p>
                    <div className="pt-2 border-t border-[#00D9FF10] space-y-2">
                      {[
                        { label: 'Sentiment',     value: funds?.sentiment     ?? '—' },
                        { label: 'News',          value: funds?.news          ?? '—' },
                        { label: 'Macro Factors', value: funds?.macroFactors  ?? '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex gap-2 text-[11px] font-mono">
                          <span className="text-[#7A8391] shrink-0 w-24">{label}</span>
                          <span className="text-[#B0B9C1]">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>
              )}

              {/* Stream */}
              <StreamFeed lines={lines} streaming={streaming} onStart={start} />
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-4">

              {/* Recommendations */}
              {(insights?.recommendations?.length ?? 0) > 0 && (
                <Panel style={{ borderColor: '#0FFF5025' }}>
                  <PanelHeader
                    icon={<Target className="h-3.5 w-3.5" />}
                    label="RECOMMENDATIONS"
                    accent="#0FFF50"
                  />
                  <div className="p-4 space-y-2">
                    {insights!.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className="flex gap-2 items-start text-[11px] font-mono text-[#B0B9C1] p-2 rounded"
                        style={{ background: '#0FFF5008', border: '1px solid #0FFF5015' }}
                      >
                        <ChevronRight className="h-3 w-3 text-[#0FFF50] shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              {/* Cascading Risks */}
              {(data?.riskAssessment.cascadingRisks?.length ?? 0) > 0 && (
                <Panel style={{ borderColor: '#FFD70025' }}>
                  <PanelHeader
                    icon={<AlertTriangle className="h-3.5 w-3.5" />}
                    label="CASCADING RISKS"
                    accent="#FFD700"
                  />
                  <div className="p-4 space-y-2">
                    {data!.riskAssessment.cascadingRisks.map((risk, i) => (
                      <div
                        key={i}
                        className="flex gap-2 items-start text-[11px] font-mono text-[#B0B9C1] p-2 rounded"
                        style={{ background: '#FFD70008', border: '1px solid #FFD70015' }}
                      >
                        <span className="text-[#FFD700] shrink-0 select-none">⚠</span>
                        <span>{risk}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              {/* Timestamp footer */}
              {data && (
                <div
                  className="text-center text-[10px] font-mono text-[#3A4055] py-2"
                >
                  Analysis timestamp: {new Date(data.timestamp).toISOString()}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}