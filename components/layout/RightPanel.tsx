'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { X, TrendingUp, AlertCircle, Clock, Zap, RefreshCw, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAlertStore } from '@/store/alertStore';

interface RightPanelProps {
  onClose: () => void;
  selectedAsset?: string; // e.g. "BTC", "ETH", "SPY"
}

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

// ── Hook: POST full analysis ──────────────────────────────────────────────────

function useAnalysis(asset: string, period = '24h') {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const runFetch = useCallback(async () => {
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
      setData(json);
      setLastFetched(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [asset, period]);

  // Auto-fetch on mount and when asset changes
  useEffect(() => {
    void runFetch();
  }, [runFetch]);

  return { data, loading, error, lastFetched, refetch: runFetch };
}

// ── Hook: GET streaming analysis ─────────────────────────────────────────────

function useStreamingAnalysis(asset: string) {
  const [lines, setLines] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(() => {
    if (streaming) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLines([]);
    setStreaming(true);

    void (async () => {
      try {
        const res = await window.fetch(
          `/api/ai/analyze?asset=${encodeURIComponent(asset)}`,
          { signal: controller.signal },
        );
        if (!res.body) throw new Error('No body');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const newLines = chunk.split('\n').filter(Boolean);
          setLines(prev => [...prev, ...newLines]);
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setLines(prev => [...prev, '⚠ Stream error — retrying on next refresh']);
        }
      } finally {
        setStreaming(false);
      }
    })();
  }, [asset, streaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  return { lines, streaming, startStream };
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function RiskGauge({ score, level, color }: { score: number; level: string; color: string }) {
  return (
    <div className="bg-[#1A1F3A]/50 border border-[#00D9FF]/20 rounded-lg p-4 space-y-3 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-[#7A8391] tracking-wider">RISK SCORE</span>
        <span
          className="text-xs font-bold font-mono px-2 py-1 rounded"
          style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}
        >
          {level}
        </span>
      </div>
      <div className="text-4xl font-bold font-mono" style={{ color }}>
        {score}
        <span className="text-lg text-[#7A8391]">/100</span>
      </div>
      <div className="w-full bg-[#0A0E27] rounded-full h-2 overflow-hidden border border-[#00D9FF]/10">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, #0FFF50 0%, #FFD700 50%, #FF1744 100%)`,
          }}
        />
      </div>
      <div className="grid grid-cols-3 text-[10px] font-mono text-[#7A8391] mt-1">
        <span>LOW</span>
        <span className="text-center">MED</span>
        <span className="text-right">CRIT</span>
      </div>
    </div>
  );
}

function TechnicalCard({ tech }: { tech: TechnicalAnalysis }) {
  const trendColor = tech.trend === 'Bullish' ? '#0FFF50'
    : tech.trend === 'Bearish' ? '#FF1744' : '#FFD700';

  return (
    <div className="bg-[#1A1F3A]/50 border border-[#00D9FF]/20 rounded-lg p-4 space-y-3 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-[#0FFF50]" />
        <span className="text-sm font-mono text-[#00D9FF] tracking-wider">TECHNICAL</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="space-y-1">
          <div className="text-[#7A8391]">Trend</div>
          <div className="font-bold" style={{ color: trendColor }}>{tech.trend}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[#7A8391]">Momentum</div>
          <div className="font-bold text-[#B0B9C1]">{tech.momentum}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[#7A8391]">Support</div>
          <div className="font-bold text-[#FF1744]">{tech.support > 0 ? '+' : ''}{tech.support}%</div>
        </div>
        <div className="space-y-1">
          <div className="text-[#7A8391]">Resistance</div>
          <div className="font-bold text-[#0FFF50]">+{tech.resistance}%</div>
        </div>
      </div>
    </div>
  );
}

function RecommendationsCard({ items }: { items: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 2);

  return (
    <div className="bg-[#1A1F3A]/50 border border-[#0FFF50]/20 rounded-lg p-4 space-y-3 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-[#0FFF50]" />
        <span className="text-sm font-mono text-[#0FFF50] tracking-wider">AI RECOMMENDATIONS</span>
      </div>
      <div className="space-y-2">
        {visible.map((rec, i) => (
          <div key={i} className="flex gap-2 text-xs text-[#B0B9C1] font-mono">
            <span className="text-[#0FFF50] shrink-0">›</span>
            <span>{rec}</span>
          </div>
        ))}
      </div>
      {items.length > 2 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-[10px] text-[#7A8391] hover:text-[#00D9FF] font-mono transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'COLLAPSE' : `+${items.length - 2} MORE`}
        </button>
      )}
    </div>
  );
}

function StreamingFeed({ lines, streaming, onStart }: { lines: string[]; streaming: boolean; onStart: () => void }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="bg-[#1A1F3A]/50 border border-[#00D9FF]/20 rounded-lg p-4 space-y-3 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[#FFD700]" />
          <span className="text-sm font-mono text-[#FFD700] tracking-wider">LIVE STREAM</span>
        </div>
        {!streaming && (
          <button
            onClick={onStart}
            className="text-[10px] font-mono text-[#00D9FF] hover:text-white border border-[#00D9FF]/30 hover:border-[#00D9FF] px-2 py-1 rounded transition-all"
          >
            RUN
          </button>
        )}
        {streaming && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-[#0FFF50]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0FFF50] animate-pulse" />
            STREAMING
          </span>
        )}
      </div>
      <div className="bg-[#0A0E27] rounded p-3 min-h-[80px] max-h-[160px] overflow-y-auto font-mono text-xs space-y-1 border border-[#00D9FF]/10">
        {lines.length === 0 && !streaming && (
          <div className="text-[#7A8391]">Press RUN to stream live AI analysis...</div>
        )}
        {lines.map((line, i) => (
          <div key={i} className="text-[#B0B9C1] leading-relaxed">
            <span className="text-[#00D9FF]/50 mr-2">›</span>{line}
          </div>
        ))}
        {streaming && (
          <div className="text-[#0FFF50] animate-pulse">▋</div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[80, 64, 96, 72].map((w, i) => (
        <div key={i} className="bg-[#1A1F3A]/50 border border-[#00D9FF]/10 rounded-lg p-4 space-y-3">
          <div className="h-3 bg-[#00D9FF]/10 rounded" style={{ width: `${w}%` }} />
          <div className="h-8 bg-[#00D9FF]/5 rounded" />
          <div className="h-2 bg-[#00D9FF]/10 rounded w-full" />
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function RightPanel({ onClose, selectedAsset = 'BTC' }: RightPanelProps) {
  const { alerts, getCriticalCount } = useAlertStore();
  const criticalCount = getCriticalCount();
  const recentAlerts = useMemo(() => alerts.slice(0, 5), [alerts]);

  const { data, loading, error, lastFetched, refetch } = useAnalysis(selectedAsset);
  const { lines, streaming, startStream } = useStreamingAnalysis(selectedAsset);

  // Derive risk level color from API score (fallback to alert-based if no API data)
  const getRiskColor = (score: number) => {
    if (score >= 80) return '#FF1744';
    if (score >= 60) return '#FFD700';
    if (score >= 40) return '#FFA500';
    return '#0FFF50';
  };

  const riskScore = data?.riskAssessment?.score ?? 0;
  const riskLevel = data?.riskAssessment?.level ?? '---';
  const riskColor = getRiskColor(riskScore);

  const confidence = data?.analysis.ai_insights.confidence ?? 0;

  return (
    <div className="flex flex-col h-full bg-[#0F1432]/30">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#00D9FF]/20 bg-[#0F1432]/50 backdrop-blur-sm">
        <div>
          <h3 className="text-sm font-bold text-[#00D9FF] font-mono">◆ AI INSIGHTS</h3>
          <p className="text-xs text-[#7A8391]">
            {selectedAsset} · {data?.analysis.timeframe ?? '24h'}
            {lastFetched && (
              <span className="ml-2 text-[#7A8391]/60">
                · {lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={refetch}
            disabled={loading}
            className="text-[#7A8391] hover:text-[#00D9FF] h-8 w-8"
            title="Refresh analysis"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {/* <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-[#7A8391] hover:text-[#FF1744] h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button> */}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Error banner */}
        {error && (
          <div className="bg-[#FF1744]/10 border border-[#FF1744]/30 rounded-lg p-3 text-xs font-mono text-[#FF1744] flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>API error: {error} —{' '}
              <button onClick={refetch} className="underline hover:no-underline">retry</button>
            </span>
          </div>
        )}

        {loading && !data ? (
          <Skeleton />
        ) : (
          <>
            {/* Risk Score */}
            <RiskGauge score={riskScore} level={riskLevel} color={riskColor} />

            {/* AI Summary */}
            {data?.analysis.summary && (
              <div className="bg-[#1A1F3A]/50 border border-[#00D9FF]/20 rounded-lg p-4 space-y-2 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-[#00D9FF]" />
                  <span className="text-sm font-mono text-[#00D9FF] tracking-wider">AI SUMMARY</span>
                  <span
                    className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded"
                    style={{ color: riskColor, backgroundColor: `${riskColor}15`, border: `1px solid ${riskColor}30` }}
                  >
                    {Math.round(confidence * 100)}% CONF
                  </span>
                </div>
                <p className="text-xs text-[#B0B9C1] font-mono leading-relaxed">
                  {data.analysis.summary}
                </p>
                <p className="text-xs text-[#7A8391] font-mono italic">
                  {data.analysis.ai_insights.prediction}
                </p>
              </div>
            )}

            {/* Technical Analysis */}
            {data?.analysis.technicalAnalysis && (
              <TechnicalCard tech={data.analysis.technicalAnalysis} />
            )}

            {/* Recommendations */}
            {(data?.analysis.ai_insights.recommendations?.length ?? 0) > 0 && (
              <RecommendationsCard items={data!.analysis.ai_insights.recommendations} />
            )}

            {/* Streaming Feed */}
            <StreamingFeed lines={lines} streaming={streaming} onStart={startStream} />

            {/* Market Sentiment */}
            <div className="bg-[#1A1F3A]/50 border border-[#00D9FF]/20 rounded-lg p-4 space-y-3 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#0FFF50]" />
                <span className="text-sm font-mono text-[#00D9FF] tracking-wider">MARKET SENTIMENT</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Bullish', pct: 42, color: '#0FFF50' },
                  { label: 'Neutral', pct: 35, color: '#B0B9C1' },
                  { label: 'Bearish', pct: 23, color: '#FF1744' },
                ].map(({ label, pct, color }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-[#7A8391]">{label}</span>
                      <span className="font-bold" style={{ color }}>{pct}%</span>
                    </div>
                    <div className="h-1 bg-[#0A0E27] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.7 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Critical Alerts */}
            <div className="bg-[#1A1F3A]/50 border border-[#FF1744]/20 rounded-lg p-4 space-y-3 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[#FF1744]" />
                <span className="text-sm font-mono text-[#FF1744] tracking-wider">CRITICAL ALERTS</span>
                {criticalCount > 0 && (
                  <span className="ml-auto text-xs bg-[#FF1744]/20 text-[#FF1744] px-2 py-1 rounded font-mono font-bold border border-[#FF1744]/30">
                    {criticalCount}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {recentAlerts.length > 0 ? (
                  recentAlerts.map((alert) => {
                    const c = alert.severity === 'critical' ? '#FF1744' : '#FFD700';
                    return (
                      <div
                        key={alert.id}
                        className="p-2 rounded border transition-all"
                        style={{ backgroundColor: `${c}15`, borderColor: `${c}40` }}
                      >
                        <div className="text-xs font-mono font-bold" style={{ color: c }}>
                          {alert.title}
                        </div>
                        <div className="text-xs text-[#B0B9C1] mt-1">{alert.description}</div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-[#7A8391] text-center py-4">No critical alerts</div>
                )}
              </div>
            </div>

            {/* Cascading risks from API */}
            {(data?.riskAssessment.cascadingRisks?.length ?? 0) > 0 && (
              <div className="bg-[#1A1F3A]/50 border border-[#FFD700]/20 rounded-lg p-4 space-y-3 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-[#FFD700]" />
                  <span className="text-sm font-mono text-[#FFD700] tracking-wider">CASCADING RISKS</span>
                </div>
                <div className="space-y-1">
                  {data?.riskAssessment.cascadingRisks.map((risk, i) => (
                    <div key={i} className="flex gap-2 text-xs font-mono text-[#B0B9C1]">
                      <span className="text-[#FFD700]/60">⚠</span>
                      <span>{risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Latest Intel */}
            <div className="bg-[#1A1F3A]/50 border border-[#00D9FF]/20 rounded-lg p-4 space-y-3 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#00D9FF]" />
                <span className="text-sm font-mono text-[#00D9FF] tracking-wider">LATEST INTEL</span>
              </div>
              <div className="space-y-3 text-xs">
                {[
                  { time: '14:32 UTC', text: data?.analysis.fundamentals.macroFactors ?? 'Fed speakers signal pause on rate hikes' },
                  { time: '14:18 UTC', text: data?.analysis.fundamentals.sentiment ?? 'ECB Lagarde speech - hawkish tone detected' },
                  { time: '13:45 UTC', text: data?.analysis.fundamentals.news ?? 'PMI data beats expectations globally' },
                ].map(({ time, text }, i) => (
                  <div key={i} className={i < 2 ? 'pb-2 border-b border-[#00D9FF]/10' : ''}>
                    <div className="text-[#7A8391] font-mono">{time}</div>
                    <div className="text-[#B0B9C1] mt-1">{text}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer badge */}
            <div className="bg-[#0FFF50]/5 border border-[#0FFF50]/20 rounded-lg p-3 text-xs text-center">
              <div className="flex items-center justify-center gap-1 text-[#0FFF50] font-mono">
                <Zap className="h-3 w-3" />
                <span>Powered by AI Analysis Engine</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}