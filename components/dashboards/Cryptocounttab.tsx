'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DailyEntry {
  date: string;
  newCoins: number;
  totalTracked: number;
  chainBreakdown: {
    sui: number;
    solana: number;
    ethereum: number;
    base: number;
    bsc: number;
    others: number;
  };
}

interface LiveData {
  activeCryptos: number;
  totalListed: number;
  markets: number;
  marketCapChange24h: number;
  updatedAt: number;
  dominance: { btc: number; eth: number; bnb: number; sol: number };
}

interface Stats {
  total: number;
  last24h: number;
  last7d: number;
  last30d: number;
  yearlyHigh: { date: string; value: number };
  yearlyLow: { date: string; value: number };
}

interface ApiResponse {
  success: boolean;
  live: LiveData;
  stats: Stats;
  history: DailyEntry[];
  source: string;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 100_000 ? 0 : 1) + 'K';
  return n.toLocaleString();
}

function filterData(data: DailyEntry[], range: '30d' | '1y' | 'all'): DailyEntry[] {
  if (range === 'all') return data;
  if (range === '30d') return data.slice(-30);
  return data.slice(-365);
}

function xLabel(date: string, range: '30d' | '1y' | 'all'): string {
  const d = new Date(date);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (range === '30d') return `${months[d.getMonth()]} ${d.getDate()}`;
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

const CHAIN_COLORS: Record<string, string> = {
  sui: '#4db8ff', solana: '#14f195', ethereum: '#f5c542',
  base: '#ff6b35', bsc: '#f0b90b', others: '#888888',
};
const CHAIN_LABELS: Record<string, string> = {
  sui: 'SUI', solana: 'Solana', ethereum: 'Ethereum',
  base: 'Base', bsc: 'BSC', others: 'Others',
};

// ── TimeframeToggle ───────────────────────────────────────────────────────────
const TimeToggle: React.FC<{
  value: '30d' | '1y' | 'all';
  onChange: (v: '30d' | '1y' | 'all') => void;
}> = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 2 }}>
    {(['30d', '1y', 'all'] as const).map(opt => (
      <button key={opt} onClick={() => onChange(opt)} style={{
        background: value === opt ? 'rgba(0,120,255,0.35)' : 'transparent',
        border: `1px solid ${value === opt ? 'rgba(0,120,255,0.6)' : 'rgba(0,150,255,0.2)'}`,
        color: value === opt ? '#60b0ff' : 'rgba(0,150,255,0.4)',
        padding: '2px 8px', fontSize: 11, cursor: 'pointer', borderRadius: 3,
        fontFamily: 'monospace', textTransform: 'uppercase', transition: 'all 0.15s',
      }}>{opt}</button>
    ))}
  </div>
);

// ── LineChart ─────────────────────────────────────────────────────────────────
const LineChart: React.FC<{
  data: DailyEntry[];
  valueKey: 'newCoins' | 'totalTracked';
  range: '30d' | '1y' | 'all';
  color?: string;
}> = ({ data, valueKey, range, color = '#3b82f6' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ mouseX: number; mouseY: number; idx: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || data.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = container.clientWidth; const H = container.clientHeight;
    canvas.width = W; canvas.height = H;
    const pad = { top: 16, right: 60, bottom: 28, left: 12 };
    const cw = W - pad.left - pad.right; const ch = H - pad.top - pad.bottom;
    ctx.clearRect(0, 0, W, H);
    const values = data.map(d => d[valueKey]);
    const maxV = Math.max(...values) * 1.1;
    const toX = (i: number) => pad.left + (i / (data.length - 1)) * cw;
    const toY = (v: number) => pad.top + ch - (v / maxV) * ch;

    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * ch;
      ctx.strokeStyle = 'rgba(0,150,255,0.07)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0,150,255,0.4)'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
      ctx.fillText(fmt(maxV - (i / 4) * maxV), W - pad.right + 4, y + 3);
    }
    ctx.fillStyle = 'rgba(0,150,255,0.35)'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      const idx = Math.floor((i / 4) * (data.length - 1));
      ctx.fillText(xLabel(data[idx].date, range), toX(idx), H - 4);
    }

    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
    grad.addColorStop(0, color + '33'); grad.addColorStop(1, color + '00');
    ctx.beginPath();
    data.forEach((d, i) => { const x = toX(i); const y = toY(d[valueKey]); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.lineTo(toX(data.length - 1), pad.top + ch); ctx.lineTo(pad.left, pad.top + ch);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    data.forEach((d, i) => { const x = toX(i); const y = toY(d[valueKey]); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();

    const lastVal = values[values.length - 1];
    const lastX = toX(data.length - 1); const lastY = toY(lastVal);
    ctx.beginPath(); ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    const label = fmt(lastVal);
    const bw = ctx.measureText(label).width + 10;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(lastX - bw / 2, lastY - 22, bw, 16, 3); ctx.fill();
    ctx.fillStyle = '#000'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    ctx.fillText(label, lastX, lastY - 22 + 11);

    if (tooltip !== null) {
      const tx = toX(tooltip.idx);
      ctx.beginPath(); ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
      ctx.moveTo(tx, pad.top); ctx.lineTo(tx, pad.top + ch); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(tx, toY(data[tooltip.idx][valueKey]), 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
    }
  }, [data, valueKey, range, color, tooltip]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const cw = canvas.width - 12 - 60;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round((mx - 12) / cw * (data.length - 1))));
    setTooltip({ mouseX: e.clientX - rect.left, mouseY: e.clientY - rect.top, idx });
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)} />
      {tooltip !== null && data[tooltip.idx] && (() => {
        const entry = data[tooltip.idx];
        const cw = canvasRef.current?.clientWidth ?? 300;
        return (
          <div style={{
            position: 'absolute', left: Math.min(tooltip.mouseX + 10, cw - 165), top: Math.max(8, tooltip.mouseY - 55),
            background: 'rgba(5,20,50,0.96)', border: '1px solid rgba(0,150,255,0.3)',
            borderRadius: 4, padding: '6px 10px', fontSize: 11, color: '#a0c8f0',
            pointerEvents: 'none', zIndex: 10, fontFamily: 'monospace', minWidth: 155,
          }}>
            <div style={{ color: 'rgba(0,150,255,0.6)', marginBottom: 3 }}>
              {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {'  05:00:00 AM'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
              <span style={{ color: 'rgba(0,150,255,0.5)' }}>
                {valueKey === 'newCoins' ? 'Created Per Day' : 'Total Tracked'}:
              </span>
              <span style={{ color: '#fff', fontWeight: 700 }}>{fmt(entry[valueKey])}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ── StackedAreaChart ──────────────────────────────────────────────────────────
const StackedAreaChart: React.FC<{ data: DailyEntry[]; range: '30d' | '1y' | 'all' }> = ({ data, range }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ mouseX: number; mouseY: number; idx: number } | null>(null);
  const chains = ['solana', 'base', 'ethereum', 'bsc', 'sui', 'others'] as const;

  const draw = useCallback(() => {
    const canvas = canvasRef.current; const container = containerRef.current;
    if (!canvas || !container || data.length === 0) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W = container.clientWidth; const H = container.clientHeight;
    canvas.width = W; canvas.height = H;
    const pad = { top: 10, right: 40, bottom: 28, left: 12 };
    const cw = W - pad.left - pad.right; const ch = H - pad.top - pad.bottom;
    ctx.clearRect(0, 0, W, H);
    const toX = (i: number) => pad.left + (i / (data.length - 1)) * cw;
    const toY = (frac: number) => pad.top + ch - frac * ch;

    const cumulative = data.map(d => {
      const cum: Record<string, number> = {}; let acc = 0;
      chains.forEach(chain => { acc += d.chainBreakdown[chain]; cum[chain] = acc; });
      return cum;
    });

    for (let ci = chains.length - 1; ci >= 0; ci--) {
      const chain = chains[ci]; const prevChain = ci > 0 ? chains[ci - 1] : null;
      ctx.beginPath();
      data.forEach((_, i) => { const x = toX(i); const y = toY(cumulative[i][chain]); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      for (let i = data.length - 1; i >= 0; i--) {
        const x = toX(i); const y = prevChain ? toY(cumulative[i][prevChain]) : pad.top + ch;
        ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fillStyle = CHAIN_COLORS[chain] + 'cc'; ctx.fill();
    }

    ctx.fillStyle = 'rgba(0,150,255,0.35)'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ['0%', '25%', '50%', '75%', '100%'].forEach((label, i) => {
      const y = pad.top + ch - (i / 4) * ch;
      ctx.fillText(label, W - pad.right + 4, y + 3);
      ctx.strokeStyle = 'rgba(0,150,255,0.06)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke(); ctx.setLineDash([]);
    });

    ctx.fillStyle = 'rgba(0,150,255,0.35)'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      const idx = Math.floor((i / 4) * (data.length - 1));
      ctx.fillText(xLabel(data[idx].date, range), toX(idx), H - 4);
    }

    if (tooltip) {
      const tx = toX(tooltip.idx);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(tx, pad.top); ctx.lineTo(tx, pad.top + ch); ctx.stroke(); ctx.setLineDash([]);
    }
  }, [data, range, tooltip, chains]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const cw = canvas.width - 12 - 40;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round((mx - 12) / cw * (data.length - 1))));
    setTooltip({ mouseX: e.clientX - rect.left, mouseY: e.clientY - rect.top, idx });
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)} />
      {tooltip && data[tooltip.idx] && (() => {
        const entry = data[tooltip.idx];
        const cw = canvasRef.current?.clientWidth ?? 300;
        return (
          <div style={{
            position: 'absolute', left: Math.min(tooltip.mouseX + 10, cw - 175), top: Math.max(8, tooltip.mouseY - 100),
            background: 'rgba(5,20,50,0.96)', border: '1px solid rgba(0,150,255,0.3)',
            borderRadius: 4, padding: '6px 10px', fontSize: 11, color: '#a0c8f0',
            pointerEvents: 'none', zIndex: 10, fontFamily: 'monospace', minWidth: 165,
          }}>
            <div style={{ color: 'rgba(0,150,255,0.6)', marginBottom: 5 }}>
              {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            {chains.map(chain => (
              <div key={chain} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, gap: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: CHAIN_COLORS[chain], display: 'inline-block' }} />
                  <span style={{ color: 'rgba(180,210,255,0.6)' }}>{CHAIN_LABELS[chain]}</span>
                </span>
                <span style={{ color: '#fff' }}>{(entry.chainBreakdown[chain] * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

// ── Panel ─────────────────────────────────────────────────────────────────────
const Panel: React.FC<{
  title: string; topRight?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties;
}> = ({ title, topRight, children, style }) => (
  <div style={{
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,150,255,0.1)',
    borderRadius: 6, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...style,
  }}>
    <div style={{
      padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: '1px solid rgba(0,150,255,0.07)', flexShrink: 0,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#e0f0ff', letterSpacing: '0.02em' }}>{title}</span>
      {topRight}
    </div>
    <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
const CryptoCountTab: React.FC = () => {
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [newRange, setNewRange] = useState<'30d' | '1y' | 'all'>('1y');
  const [totalRange, setTotalRange] = useState<'30d' | '1y' | 'all'>('1y');
  const [chainRange, setChainRange] = useState<'30d' | '1y' | 'all'>('1y');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res = await fetch('/api/crypto-count');
      const json: ApiResponse = await res.json();
      if (!json.success) throw new Error(json.error ?? 'API error');
      setApiData(json);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchData]);

  const history = apiData?.history ?? [];
  const stats = apiData?.stats;
  const live = apiData?.live;
  const newData = filterData(history, newRange);
  const totalData = filterData(history, totalRange);
  const chainData = filterData(history, chainRange);

  const LoadingPlaceholder = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 12, color: 'rgba(0,150,255,0.4)' }}>
      Loading live data...
    </div>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', background: '#080e1e',
      fontFamily: '"IBM Plex Mono","Courier New",monospace', color: '#c0d8f0',
      overflow: 'hidden', padding: 12, gap: 10, boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e8f4ff', letterSpacing: '0.01em' }}>
            Cryptocurrencies Tracked by CoinMarketCap
          </div>
          <div style={{ fontSize: 11, color: 'rgba(0,150,255,0.45)', marginTop: 3, lineHeight: 1.4, maxWidth: 680 }}>
            Explore our cryptocurrency count page, showcasing the total number of cryptocurrencies in existence
            and the ongoing growth in the number of coins and tokens tracked by CoinMarketCap. Dive into
            historical counts, yearly expansions, and the number of cryptos tracked on each chain.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
          {live && (
            <div style={{ fontSize: 10, color: 'rgba(0,150,255,0.4)', textAlign: 'right', lineHeight: 1.6 }}>
              <div>Source: CoinGecko API</div>
              <div>Updated: {lastUpdated}</div>
            </div>
          )}
          <button onClick={fetchData} disabled={loading} style={{
            background: 'rgba(0,150,255,0.1)', border: '1px solid rgba(0,150,255,0.3)',
            color: '#00ccff', padding: '4px 12px', fontSize: 11, cursor: loading ? 'default' : 'pointer',
            borderRadius: 3, fontFamily: 'monospace', opacity: loading ? 0.5 : 1,
          }}>
            {loading ? '↻ Loading...' : '↺ Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(255,50,50,0.1)', border: '1px solid rgba(255,50,50,0.3)',
          color: '#ff7070', padding: '8px 12px', borderRadius: 4, fontSize: 12, flexShrink: 0,
        }}>⚠ {error}</div>
      )}

      {/* Grid */}
      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', gridTemplateRows: '1fr 1fr',
        gap: 10, minHeight: 0,
      }}>
        {/* Top Left */}
        <Panel title="Total Number of Cryptos Tracked" style={{ gridRow: '1', gridColumn: '1' }}>
          {loading && !stats ? <LoadingPlaceholder /> : stats ? (
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
              <div>
                <div style={{ fontSize: 30, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  {fmt(stats.total)}
                </div>
                {live && (
                  <div style={{ fontSize: 10, color: 'rgba(0,150,255,0.4)', marginTop: 2 }}>
                    {live.activeCryptos.toLocaleString()} active · {live.markets.toLocaleString()} markets
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(0,150,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Cryptos Created</div>
                {[
                  { label: 'Last 24h', value: stats.last24h },
                  { label: 'Last 7d', value: stats.last7d },
                  { label: 'Last 30d', value: stats.last30d },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(0,150,255,0.07)' }}>
                    <span style={{ fontSize: 12, color: 'rgba(180,210,255,0.6)' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#c0e0ff' }}>{fmt(value)}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(0,150,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Yearly Performance</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(0,150,255,0.07)' }}>
                  <span style={{ fontSize: 10, color: 'rgba(180,210,255,0.6)' }}>Yearly High ({new Date(stats.yearlyHigh.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#c0e0ff' }}>{fmt(stats.yearlyHigh.value)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ fontSize: 10, color: 'rgba(180,210,255,0.6)' }}>Yearly Low ({new Date(stats.yearlyLow.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#c0e0ff' }}>{fmt(stats.yearlyLow.value)}</span>
                </div>
              </div>
              {live && (
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(0,150,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Market Dominance (Live)</div>
                  {[
                    { label: 'BTC', value: live.dominance.btc, color: '#f7931a' },
                    { label: 'ETH', value: live.dominance.eth, color: '#627eea' },
                    { label: 'BNB', value: live.dominance.bnb, color: '#f0b90b' },
                    { label: 'SOL', value: live.dominance.sol, color: '#14f195' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ marginBottom: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: 'rgba(180,210,255,0.6)' }}>{label}</span>
                        <span style={{ fontSize: 10, color: '#c0e0ff' }}>{value.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 3, background: 'rgba(0,150,255,0.1)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: 2, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </Panel>

        {/* Top Right */}
        <Panel title="New Cryptocurrencies Tracked" topRight={<TimeToggle value={newRange} onChange={setNewRange} />} style={{ gridRow: '1', gridColumn: '2' }}>
          <div style={{ width: '100%', height: '100%', padding: '8px 4px 4px 4px', boxSizing: 'border-box' }}>
            {loading && !history.length ? <LoadingPlaceholder /> : <LineChart data={newData} valueKey="newCoins" range={newRange} color="#3b82f6" />}
          </div>
        </Panel>

        {/* Bottom Left */}
        <Panel title="Cryptocurrencies by Chain" topRight={<TimeToggle value={chainRange} onChange={setChainRange} />} style={{ gridRow: '2', gridColumn: '1' }}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '5px 14px', flexShrink: 0 }}>
              {(['sui', 'solana', 'ethereum', 'base', 'bsc', 'others'] as const).map(chain => (
                <span key={chain} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(180,210,255,0.7)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: CHAIN_COLORS[chain], display: 'inline-block' }} />
                  {CHAIN_LABELS[chain]}
                </span>
              ))}
            </div>
            <div style={{ flex: 1, padding: '0 4px 4px 4px', minHeight: 0 }}>
              {loading && !history.length ? <LoadingPlaceholder /> : <StackedAreaChart data={chainData} range={chainRange} />}
            </div>
          </div>
        </Panel>

        {/* Bottom Right */}
        <Panel title="Total Tracked" topRight={<TimeToggle value={totalRange} onChange={setTotalRange} />} style={{ gridRow: '2', gridColumn: '2' }}>
          <div style={{ width: '100%', height: '100%', padding: '8px 4px 4px 4px', boxSizing: 'border-box' }}>
            {loading && !history.length ? <LoadingPlaceholder /> : <LineChart data={totalData} valueKey="totalTracked" range={totalRange} color="#3b82f6" />}
          </div>
        </Panel>
      </div>

      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(0,150,255,0.25)' }}>
        <span>Live data: CoinGecko Public API · api.coingecko.com/api/v3</span>
        <span>⊕ CoinMarketCap</span>
      </div>
    </div>
  );
};

export default CryptoCountTab;