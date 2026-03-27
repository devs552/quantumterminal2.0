'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, AlertTriangle } from 'lucide-react';
import { MarketChart } from '../charts/MarketChart';
import { YieldCurveAnalysis, generateYieldCurveData, type YieldCurvePoint } from '../charts/YieldCurve';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MacroIndicator {
  key?: string;
  indicator?: string;
  name: string;
  value: string | number;
  previous?: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'flat';
  unit?: string;
  period?: string;
}

interface ChartPoint {
  time: string;
  value: number;
}

interface MacroApiResponse {
  success: boolean;
  data: {
    indicators: MacroIndicator[];
    timestamp: string;
    source: 'fred' | 'mock';
  };
  timestamp: string;
}

interface SeriesApiResponse {
  success: boolean;
  data: {
    seriesId: string;
    observations: ChartPoint[];
    source: 'fred' | 'mock';
    timestamp: string;
  };
}

type MacroSubTab = 'summary' | 'fred' | 'yields' | 'centralbanks';

// ── Central Bank definitions ──────────────────────────────────────────────────

const CENTRAL_BANKS = [
  {
    bank: 'Federal Reserve',
    country: 'United States',
    flag: '🇺🇸',
    fredKey: 'FEDFUNDS',
    stance: 'Restrictive',
    size: '$7.41T',
    next: 'Mar 19',
    color: '#00D9FF',
  },
  {
    bank: 'European Central Bank',
    country: 'Eurozone',
    flag: '🇪🇺',
    fredKey: 'ECBDFR',
    stance: 'Restrictive',
    size: '$8.23T',
    next: 'Mar 7',
    color: '#4CAF50',
  },
  {
    bank: 'Bank of England',
    country: 'United Kingdom',
    flag: '🇬🇧',
    fredKey: 'BOERUKQ',
    stance: 'Restrictive',
    size: '$1.06T',
    next: 'Mar 21',
    color: '#FF9800',
  },
  {
    bank: 'Bank of Japan',
    country: 'Japan',
    flag: '🇯🇵',
    fredKey: 'IRSTCB01JPM156N',
    stance: 'Accommodative',
    size: '$5.12T',
    next: 'TBD',
    color: '#E91E63',
  },
];

// ── FRED Series IDs for yield curve tenors ────────────────────────────────────
const YIELD_SERIES: { maturity: string; seriesId: string }[] = [
  { maturity: '1M',  seriesId: 'DGS1MO' },
  { maturity: '3M',  seriesId: 'DGS3MO' },
  { maturity: '6M',  seriesId: 'DGS6MO' },
  { maturity: '1Y',  seriesId: 'DGS1'   },
  { maturity: '2Y',  seriesId: 'DGS2'   },
  { maturity: '3Y',  seriesId: 'DGS3'   },
  { maturity: '5Y',  seriesId: 'DGS5'   },
  { maturity: '7Y',  seriesId: 'DGS7'   },
  { maturity: '10Y', seriesId: 'DGS10'  },
  { maturity: '20Y', seriesId: 'DGS20'  },
  { maturity: '30Y', seriesId: 'DGS30'  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatValue(v: string | number, unit?: string): string {
  if (typeof v === 'number') {
    return unit === '%' ? `${v.toFixed(2)}%` : v.toLocaleString();
  }
  return String(v);
}

function inferTrend(indicator: MacroIndicator): 'up' | 'down' | 'flat' {
  if (indicator.trend) return indicator.trend;
  if (indicator.change !== undefined) {
    if (indicator.change > 0) return 'up';
    if (indicator.change < 0) return 'down';
  }
  return 'flat';
}

const NEGATIVE_UP_METRICS = ['UNRATE', 'CPI', 'PPI', 'Unemployment', 'Inflation'];
function isPositiveChange(indicator: MacroIndicator): boolean {
  const trend = inferTrend(indicator);
  const name = indicator.name ?? indicator.key ?? '';
  const isNegativeMetric = NEGATIVE_UP_METRICS.some(m =>
    name.toLowerCase().includes(m.toLowerCase())
  );
  return isNegativeMetric ? trend === 'down' : trend === 'up';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Skeleton({ rows = 4, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <div className={`grid grid-cols-${cols} gap-4 animate-pulse`}>
      {Array.from({ length: rows * cols }).map((_, i) => (
        <div key={i} className="h-24 rounded bg-card/50" />
      ))}
    </div>
  );
}

function ErrorBanner({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 mb-4 rounded bg-red-500/10 border border-red-500/30 text-xs">
      <span className="flex items-center gap-2 text-red-400">
        <AlertTriangle className="h-3 w-3" /> {msg}
      </span>
      <button onClick={onRetry} className="text-red-400 hover:text-red-200 underline ml-4">
        Retry
      </button>
    </div>
  );
}

function SourceBadge({ source }: { source: 'fred' | 'mock' | undefined }) {
  if (!source) return null;
  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ml-2 ${
      source === 'fred'
        ? 'bg-green-500/20 text-green-400'
        : 'bg-amber-500/20 text-amber-400'
    }`}>
      {source === 'fred' ? 'FRED LIVE' : 'MOCK DATA'}
    </span>
  );
}

function IndicatorCard({ indicator }: { indicator: MacroIndicator }) {
  const trend = inferTrend(indicator);
  const positive = isPositiveChange(indicator);
  const color = trend === 'flat' ? 'text-muted-foreground' : positive ? 'text-green-400' : 'text-red-400';

  return (
    <div className="p-4 rounded bg-card/50 border border-border/30 hover:border-primary/50 transition-all">
      <div className="text-xs text-muted-foreground mb-2 font-mono">{indicator.name}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-2xl font-bold text-foreground">
          {formatValue(indicator.value, indicator.unit)}
        </div>
        {indicator.previous !== undefined && (
          <div className="text-xs text-muted-foreground">
            from {formatValue(indicator.previous, indicator.unit)}
          </div>
        )}
      </div>
      <div className={`text-xs font-mono mt-2 flex items-center gap-1 ${color}`}>
        {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
        {trend === 'up' ? 'Increasing' : trend === 'down' ? 'Decreasing' : 'Unchanged'}
      </div>
    </div>
  );
}

// ── FRED Series Card with chart ───────────────────────────────────────────────

function FREDSeriesCard({ indicator }: { indicator: MacroIndicator }) {
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [chartSource, setChartSource] = useState<'fred' | 'mock' | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const seriesId = indicator.key ?? indicator.indicator;

  useEffect(() => {
    if (!seriesId) { setLoading(false); return; }
    setLoading(true);
    setError(false);

    fetch(`/api/data/macro/${seriesId}`)
      .then(r => r.json())
      .then((json: SeriesApiResponse) => {
        if (json.success && json.data.observations.length > 0) {
          setChartData(json.data.observations);
          setChartSource(json.data.source);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [seriesId]);

  return (
    <div className="p-4 rounded bg-card/50 border border-border/30 hover:border-primary/30 transition-all">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-sm font-mono text-primary font-bold">
            {indicator.name}
            <SourceBadge source={chartSource} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Series: {seriesId ?? '—'} · Period: {indicator.period ?? 'monthly'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-foreground">
            {formatValue(indicator.value, indicator.unit)}
          </div>
          {indicator.unit && (
            <div className="text-xs text-muted-foreground">{indicator.unit}</div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-32 rounded bg-card/30 animate-pulse flex items-center justify-center">
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : error || chartData.length === 0 ? (
        <div className="h-32 rounded bg-card/30 border border-border/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground font-mono">No chart data available</span>
        </div>
      ) : (
        <MarketChart data={chartData} height={130} showLegend={false} showArea={true} color="#00D9FF" />
      )}
    </div>
  );
}

// ── Central Bank Card with live rate + history chart ─────────────────────────

function CentralBankCard({ cb }: { cb: typeof CENTRAL_BANKS[0] }) {
  const [chartData, setChartData]   = useState<ChartPoint[]>([]);
  const [liveRate, setLiveRate]     = useState<string | null>(null);
  const [prevRate, setPrevRate]     = useState<string | null>(null);
  const [source, setSource]         = useState<'fred' | 'mock' | undefined>();
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    fetch(`/api/data/macro/${cb.fredKey}`)
      .then(r => r.json())
      .then((json: SeriesApiResponse) => {
        if (json.success && json.data.observations.length > 0) {
          const obs = json.data.observations;
          setChartData(obs);
          setSource(json.data.source);
          const latest = obs[obs.length - 1];
          const prev   = obs[obs.length - 2];
          setLiveRate(`${parseFloat(String(latest.value)).toFixed(2)}%`);
          if (prev) setPrevRate(`${parseFloat(String(prev.value)).toFixed(2)}%`);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cb.fredKey]);

  const rateChange = liveRate && prevRate
    ? parseFloat(liveRate) - parseFloat(prevRate)
    : null;

  return (
    <div
      className="p-5 rounded bg-card/50 border border-border/30 hover:border-primary/30 transition-all"
      style={{ borderLeft: `3px solid ${cb.color}` }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{cb.flag}</span>
          <div>
            <div className="text-sm font-mono font-bold text-foreground">{cb.bank}</div>
            <div className="text-xs text-muted-foreground">{cb.country}</div>
          </div>
        </div>
        <div className="text-right">
          {loading ? (
            <div className="h-8 w-16 rounded bg-card/50 animate-pulse" />
          ) : (
            <>
              <div className="text-2xl font-bold" style={{ color: cb.color }}>
                {liveRate ?? '—'}
              </div>
              {rateChange !== null && (
                <div className={`text-xs font-mono flex items-center justify-end gap-1 ${
                  rateChange > 0 ? 'text-red-400' : rateChange < 0 ? 'text-green-400' : 'text-muted-foreground'
                }`}>
                  {rateChange > 0 ? <TrendingUp className="h-3 w-3" /> : rateChange < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                  {rateChange > 0 ? '+' : ''}{rateChange.toFixed(2)} from {prevRate}
                </div>
              )}
            </>
          )}
          <SourceBadge source={source} />
        </div>
      </div>

      {/* Meta row */}
      <div className="flex justify-between text-xs font-mono mb-3">
        <span className={`px-2 py-0.5 rounded ${
          cb.stance === 'Restrictive'
            ? 'bg-red-500/15 text-red-400'
            : cb.stance === 'Accommodative'
            ? 'bg-green-500/15 text-green-400'
            : 'bg-amber-500/15 text-amber-400'
        }`}>
          {cb.stance}
        </span>
        <span className="text-muted-foreground">Balance Sheet: {cb.size}</span>
        <span className="text-cyan-400">Next: {cb.next}</span>
      </div>

      {/* Rate history chart */}
      {loading ? (
        <div className="h-28 rounded bg-card/30 animate-pulse" />
      ) : chartData.length > 0 ? (
        <MarketChart
          data={chartData}
          height={110}
          showLegend={false}
          showArea={true}
          color={cb.color}
        />
      ) : (
        <div className="h-28 rounded bg-card/30 border border-border/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground font-mono">Rate history unavailable</span>
        </div>
      )}

      {/* FRED series label */}
      <div className="mt-2 text-[10px] text-muted-foreground font-mono">
        FRED: {cb.fredKey}
      </div>
    </div>
  );
}

// ── 10Y-2Y Spread chart ───────────────────────────────────────────────────────

function YieldSpreadCard() {
  const [spreadData, setSpreadData] = useState<ChartPoint[]>([]);
  const [source, setSource]         = useState<'fred' | 'mock' | undefined>();
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    fetch('/api/data/macro/T10Y2Y')
      .then(r => r.json())
      .then((json: SeriesApiResponse) => {
        if (json.success && json.data.observations.length > 0) {
          setSpreadData(json.data.observations);
          setSource(json.data.source);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="glass-panel p-6">
      <h4 className="text-sm font-bold text-primary mb-1 flex items-center">
        10Y–2Y Yield Spread (Recession Indicator)
        <SourceBadge source={source} />
      </h4>
      <p className="text-xs text-muted-foreground font-mono mb-4">
        Negative spread = inverted curve, historically precedes recessions
      </p>
      {loading ? (
        <div className="h-40 rounded bg-card/30 animate-pulse" />
      ) : spreadData.length > 0 ? (
        <MarketChart data={spreadData} height={160} showLegend={false} showArea={false} color="#FFB74D" />
      ) : (
        <div className="h-40 rounded bg-card/30 border border-border/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground font-mono">T10Y2Y data unavailable</span>
        </div>
      )}
    </div>
  );
}

// ── Yields Tab ────────────────────────────────────────────────────────────────

function YieldsTabContent() {
  const [yieldData, setYieldData] = useState<YieldCurvePoint[]>([]);
  const [source, setSource]       = useState<'fred' | 'mock'>('mock');
  const [loading, setLoading]     = useState(true);

  const fetchYields = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        YIELD_SERIES.map(({ maturity, seriesId }) =>
          fetch(`/api/data/macro/${seriesId}`)
            .then(r => r.json())
            .then((json: SeriesApiResponse) => {
              if (json.success && json.data.observations.length > 0) {
                const obs    = json.data.observations;
                const latest = obs[obs.length - 1];
                const prev   = obs[obs.length - 2];
                return { maturity, yield: latest.value, previousYield: prev?.value, source: json.data.source };
              }
              return null;
            })
            .catch(() => null)
        )
      );

      const valid = results.filter(Boolean) as (YieldCurvePoint & { source: string })[];
      if (valid.length > 0) {
        setYieldData(valid.map(({ maturity, yield: y, previousYield }) => ({ maturity, yield: y, previousYield })));
        setSource(valid.some(v => v.source === 'fred') ? 'fred' : 'mock');
      } else {
        setYieldData(generateYieldCurveData());
        setSource('mock');
      }
    } catch {
      setYieldData(generateYieldCurveData());
      setSource('mock');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchYields(); }, [fetchYields]);

  const tenorRows = yieldData.length > 0 ? yieldData : generateYieldCurveData();

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <h3 className="text-lg font-bold text-primary mb-1 flex items-center">
          US Treasury Yield Curve
          <SourceBadge source={source} />
        </h3>
        <p className="text-xs text-muted-foreground font-mono mb-4">
          Live data from FRED DGS series · Orange dashed = previous observation
        </p>
        {loading ? (
          <div className="h-64 rounded bg-card/30 animate-pulse flex items-center justify-center">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <YieldCurveAnalysis data={tenorRows} />
        )}
      </div>

      <div className="glass-panel p-6">
        <h4 className="text-sm font-bold text-primary mb-4">TREASURY YIELDS BY TENOR</h4>
        {loading ? (
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2 animate-pulse">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="h-16 rounded bg-card/50" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
            {tenorRows.map(item => {
              const change = item.previousYield !== undefined ? item.yield - item.previousYield : 0;
              return (
                <div key={item.maturity} className="p-3 rounded bg-card/50 border border-border/30 text-center">
                  <div className="text-xs text-muted-foreground font-mono">{item.maturity}</div>
                  <div className="text-lg font-bold text-cyan-400">{item.yield.toFixed(2)}%</div>
                  {item.previousYield !== undefined && (
                    <div className={`text-xs font-mono ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {change >= 0 ? '+' : ''}{change.toFixed(2)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground font-mono">
            Source: FRED DGS1MO → DGS30 · Refreshed on load
          </p>
          <button
            onClick={fetchYields}
            disabled={loading}
            className="flex items-center gap-1 text-xs font-mono text-primary hover:text-primary/70 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <YieldSpreadCard />
    </div>
  );
}

// ── Central Banks Tab ─────────────────────────────────────────────────────────

function CentralBanksTabContent() {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <h3 className="text-lg font-bold text-primary mb-1">Central Bank Monitor</h3>
        <p className="text-xs text-muted-foreground font-mono mb-6">
          Live policy rates from FRED · Rate history chart per bank
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CENTRAL_BANKS.map(cb => (
            <CentralBankCard key={cb.bank} cb={cb} />
          ))}
        </div>
      </div>

      {/* Comparative rate chart */}
      <ComparativeRatesCard />
    </div>
  );
}

// ── Comparative policy rates over time ────────────────────────────────────────

function ComparativeRatesCard() {
  const [data, setData]     = useState<{ time: string; fed: number; ecb: number; boe: number; boj: number }[]>([]);
  const [source, setSource] = useState<'fred' | 'mock' | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/data/macro/FEDFUNDS').then(r => r.json()),
      fetch('/api/data/macro/ECBDFR').then(r => r.json()),
      fetch('/api/data/macro/BOERUKQ').then(r => r.json()),
      fetch('/api/data/macro/IRSTCB01JPM156N').then(r => r.json()),
    ])
      .then(([fed, ecb, boe, boj]: SeriesApiResponse[]) => {
        // Use Fed as time backbone (most complete)
        const fedObs = fed?.data?.observations ?? [];
        if (fedObs.length === 0) return;

        const ecbMap = Object.fromEntries((ecb?.data?.observations ?? []).map(o => [o.time, o.value]));
        const boeMap = Object.fromEntries((boe?.data?.observations ?? []).map(o => [o.time, o.value]));
        const bojMap = Object.fromEntries((boj?.data?.observations ?? []).map(o => [o.time, o.value]));

        const merged = fedObs.map(o => ({
          time: o.time,
          fed: o.value,
          ecb: ecbMap[o.time] ?? null,
          boe: boeMap[o.time] ?? null,
          boj: bojMap[o.time] ?? null,
        })).filter(o => o.ecb !== null || o.boe !== null || o.boj !== null);

        setData(merged);
        const anyFred = [fed, ecb, boe, boj].some(r => r?.data?.source === 'fred');
        setSource(anyFred ? 'fred' : 'mock');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Build a custom multi-line chart using recharts directly
  // We reuse the recharts imports already available via MarketChart's ecosystem
  return (
    <div className="glass-panel p-6">
      <h4 className="text-sm font-bold text-primary mb-1 flex items-center">
        Policy Rate Comparison
        <SourceBadge source={source} />
      </h4>
      <p className="text-xs text-muted-foreground font-mono mb-4">
        Fed · ECB · BoE · BoJ — overlaid history
      </p>

      {loading ? (
        <div className="h-52 rounded bg-card/30 animate-pulse" />
      ) : data.length > 0 ? (
        <MultiLineRatesChart data={data} />
      ) : (
        <div className="h-52 rounded bg-card/30 border border-border/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground font-mono">Comparative data unavailable</span>
        </div>
      )}
    </div>
  );
}

// ── Multi-line recharts component ─────────────────────────────────────────────

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

function MultiLineRatesChart({ data }: { data: any[] }) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#0F1432]/90 border border-[#00D9FF]/40 rounded p-2 text-xs">
        <p className="text-[#00D9FF] font-mono mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} style={{ color: entry.color }} className="font-mono">
            {entry.name}: {entry.value?.toFixed(2)}%
          </p>
        ))}
      </div>
    );
  };

  return (
    <div style={{ height: '210px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#00D9FF" strokeOpacity={0.1} />
          <XAxis dataKey="time" stroke="#7A8391" style={{ fontSize: '10px' }} />
          <YAxis stroke="#7A8391" style={{ fontSize: '10px' }} unit="%" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line type="monotone" dataKey="fed" stroke="#00D9FF" strokeWidth={2} dot={false} name="Fed" connectNulls />
          <Line type="monotone" dataKey="ecb" stroke="#4CAF50" strokeWidth={2} dot={false} name="ECB" connectNulls />
          <Line type="monotone" dataKey="boe" stroke="#FF9800" strokeWidth={2} dot={false} name="BoE" connectNulls />
          <Line type="monotone" dataKey="boj" stroke="#E91E63" strokeWidth={2} dot={false} name="BoJ" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function MacroTab() {
  const [activeSubTab, setActiveSubTab] = useState<MacroSubTab>('summary');
  const [indicators, setIndicators]     = useState<MacroIndicator[]>([]);
  const [source, setSource]             = useState<'fred' | 'mock' | undefined>();
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [updatedAt, setUpdatedAt]       = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/data/macro?real=true', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json: MacroApiResponse = await res.json();
      if (!json.success) throw new Error('API returned success: false');
      setIndicators(json.data.indicators);
      setSource(json.data.source);
      setUpdatedAt(json.data.timestamp);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load macro data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const subTabs = [
    { id: 'summary'      as MacroSubTab, label: 'Summary',       icon: '📊' },
    { id: 'fred'         as MacroSubTab, label: 'FRED Data',     icon: '📈' },
    { id: 'yields'       as MacroSubTab, label: 'Yields',        icon: '📉' },
    { id: 'centralbanks' as MacroSubTab, label: 'Central Banks', icon: '🏦' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* ── Sub-tab bar ── */}
      <div className="terminal-header px-6 py-3 flex items-center justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {subTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-4 py-2 rounded text-sm font-mono transition-all whitespace-nowrap ${
                activeSubTab === tab.id
                  ? 'bg-primary/20 text-primary border border-primary/50'
                  : 'text-muted-foreground hover:bg-card/50 border border-border/30'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground flex-shrink-0 ml-4">
          {updatedAt && <span>Updated {new Date(updatedAt).toLocaleTimeString()}</span>}
          <SourceBadge source={source} />
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1 hover:text-primary transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && <ErrorBanner msg={error} onRetry={fetchData} />}

        {/* ─── SUMMARY ─── */}
        {activeSubTab === 'summary' && (
          <div className="space-y-6">
            <div className="glass-panel p-6">
              <h3 className="text-lg font-bold text-primary mb-4 flex items-center">
                Global Macro Indicators
                <SourceBadge source={source} />
              </h3>
              {loading ? (
                <Skeleton rows={2} cols={3} />
              ) : indicators.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {indicators.map((ind, i) => (
                    <IndicatorCard key={ind.key ?? i} indicator={ind} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No indicator data available.</p>
              )}
            </div>

            {/* Summary: compact central bank rates — live */}
            <div className="glass-panel p-6">
              <h4 className="text-sm font-bold text-primary mb-4">CENTRAL BANK POLICY RATES</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {CENTRAL_BANKS.map(cb => (
                  <SummaryCBCard key={cb.bank} cb={cb} />
                ))}
              </div>
            </div>

            <div className="glass-panel p-6">
              <h4 className="text-sm font-bold text-primary mb-4">UPCOMING ECONOMIC EVENTS</h4>
              <div className="space-y-2">
                {[
                  { time: '14:00', country: 'US', event: 'PCE Inflation Rate', forecast: '2.8%',  previous: '2.9%'  },
                  { time: '13:30', country: 'US', event: 'Jobless Claims',     forecast: '210K',  previous: '224K'  },
                  { time: '15:45', country: 'EU', event: 'Consumer Sentiment', forecast: '-25.0', previous: '-24.5' },
                  { time: '10:00', country: 'UK', event: 'Retail Sales',       forecast: '0.3%',  previous: '-0.8%' },
                ].map(ev => (
                  <div key={ev.event} className="p-3 rounded bg-card/50 border border-border/30 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-mono text-foreground">{ev.event}</div>
                      <div className="text-xs text-muted-foreground">{ev.country}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono text-amber-400">{ev.time} UTC</div>
                      <div className="text-xs text-muted-foreground">F: {ev.forecast} | P: {ev.previous}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── FRED DATA ─── */}
        {activeSubTab === 'fred' && (
          <div className="glass-panel p-6">
            <h3 className="text-lg font-bold text-primary mb-4 flex items-center">
              FRED Data Series
              <SourceBadge source={source} />
            </h3>
            {loading ? (
              <div className="space-y-4 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-48 rounded bg-card/50" />
                ))}
              </div>
            ) : indicators.length > 0 ? (
              <div className="space-y-6">
                {indicators.map((ind, i) => (
                  <FREDSeriesCard key={ind.key ?? i} indicator={ind} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No FRED data available. Check FRED_API_KEY in your .env.local.
              </p>
            )}
          </div>
        )}

        {/* ─── YIELDS ─── */}
        {activeSubTab === 'yields' && <YieldsTabContent />}

        {/* ─── CENTRAL BANKS ─── */}
        {activeSubTab === 'centralbanks' && <CentralBanksTabContent />}
      </div>
    </div>
  );
}

// ── Compact CB card for Summary tab ──────────────────────────────────────────

function SummaryCBCard({ cb }: { cb: typeof CENTRAL_BANKS[0] }) {
  const [rate, setRate]     = useState<string | null>(null);
  const [source, setSource] = useState<'fred' | 'mock' | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/data/macro/${cb.fredKey}`)
      .then(r => r.json())
      .then((json: SeriesApiResponse) => {
        if (json.success && json.data.observations.length > 0) {
          const latest = json.data.observations[json.data.observations.length - 1];
          setRate(`${parseFloat(String(latest.value)).toFixed(2)}%`);
          setSource(json.data.source);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cb.fredKey]);

  return (
    <div className="p-3 rounded bg-card/50 border border-border/30 text-center"
      style={{ borderTop: `2px solid ${cb.color}` }}>
      <div className="text-lg mb-1">{cb.flag}</div>
      <div className="text-xs text-muted-foreground font-mono mb-1 truncate">{cb.bank}</div>
      {loading ? (
        <div className="h-6 rounded bg-card/50 animate-pulse mx-auto w-12" />
      ) : (
        <div className="text-lg font-bold font-mono" style={{ color: cb.color }}>
          {rate ?? '—'}
        </div>
      )}
      <SourceBadge source={source} />
    </div>
  );
}