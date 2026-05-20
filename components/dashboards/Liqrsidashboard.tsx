'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface LiqRow {
  rank: number; id: string; name: string; symbol: string; image: string;
  price: number; change24h: number; marketCap: number;
  openInterest: number; longLiq: number; shortLiq: number; totalLiq: number;
}
interface LiqHistory {
  timestamp: number; date: string; btcPrice: number;
  longLiq: number; shortLiq: number; total: number;
}
interface TopEvent { date: string; amount: number; headline: string; coin: string }
interface LiqData {
  success: boolean;
  summary: { total24h: number; totalLong: number; totalShort: number };
  rows: LiqRow[];
  topEvents: TopEvent[];
  source: string;
  updatedAt: string;
  error?: string;
}
interface LiqHistData {
  success: boolean;
  history: LiqHistory[];
  error?: string;
}

interface RsiCoin {
  id: string; name: string; symbol: string; image: string;
  price: number; marketCap: number; change24h: number;
  rsi: number; color: string; signal: 'overbought' | 'oversold' | 'neutral';
}
interface RsiData {
  success: boolean; period: number;
  avgRSI: number;
  overbought: number; overboughtPct: number;
  oversold: number;   oversoldPct: number;
  neutral: number;    neutralPct: number;
  marketSignal: string;
  coins: RsiCoin[];
  source: string; updatedAt: string;
  error?: string;
}

type ActiveTab = 'liquidations' | 'rsi';
type LiqHistRange = '7' | '30' | '90';

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt$(n: number, decimals = 0) {
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(1)  + 'M';
  if (n >= 1e3)  return '$' + (n / 1e3).toFixed(0)  + 'K';
  return '$' + n.toFixed(decimals);
}
function fmtPrice(p: number) {
  if (p >= 1000)  return '$' + p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1)     return '$' + p.toFixed(4);
  return '$' + p.toPrecision(4);
}
const green = '#22c55e';
const red   = '#ef4444';

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
  .lrsi-root {
    display:flex; flex-direction:column; height:100%;
    background:#0a0f1e;
    font-family:"IBM Plex Mono","Courier New",monospace;
    color:#c8d8f4; overflow:hidden; box-sizing:border-box;
  }
  /* Tab bar */
  .lrsi-tabs {
    display:flex; gap:0; border-bottom:1px solid rgba(255,255,255,0.07);
    padding:0 16px; flex-shrink:0;
  }
  .lrsi-tab {
    padding:10px 18px; font-size:12px; font-weight:700;
    cursor:pointer; border:none; background:transparent;
    font-family:"IBM Plex Mono",monospace;
    color:rgba(180,210,255,0.4);
    border-bottom:2px solid transparent;
    transition:all .15s; letter-spacing:.04em;
  }
  .lrsi-tab.active { color:#f7931a; border-bottom-color:#f7931a; }
  .lrsi-tab:hover:not(.active) { color:rgba(200,220,255,0.7); }

  /* Scrollable body */
  .lrsi-body { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden;
    display:flex; flex-direction:column; }
  .lrsi-body::-webkit-scrollbar { width:4px; }
  .lrsi-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }

  /* Header section */
  .lrsi-hdr { padding:10px 16px 8px; flex-shrink:0; border-bottom:1px solid rgba(255,255,255,0.06); }
  .lrsi-title { font-size:15px; font-weight:800; color:#e2f0ff; margin-bottom:3px; }
  .lrsi-subtitle { font-size:10px; color:rgba(200,220,255,0.32); line-height:1.5; }

  /* Card grid */
  .lrsi-cards { display:flex; gap:8px; padding:10px 16px; flex-shrink:0; flex-wrap:wrap; }
  .lrsi-card {
    background:rgba(255,255,255,0.025);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; padding:12px 14px; flex:1; min-width:160px;
  }
  .lrsi-card-label { font-size:10px; color:rgba(200,220,255,0.45);
    text-transform:uppercase; letter-spacing:.06em; margin-bottom:6px; }
  .lrsi-card-val   { font-size:22px; font-weight:900; line-height:1; color:#e2f0ff; }
  .lrsi-card-sub   { font-size:10px; margin-top:4px; color:rgba(180,210,255,0.5); }

  /* Chart panel */
  .lrsi-chart-panel {
    margin:0 16px 10px;
    background:rgba(255,255,255,0.02);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; overflow:hidden; flex-shrink:0;
  }
  .lrsi-ch-hdr {
    padding:9px 14px; display:flex; justify-content:space-between; align-items:center;
    border-bottom:1px solid rgba(255,255,255,0.05); flex-wrap:wrap; gap:6px;
  }
  .lrsi-ch-title { font-size:12px; font-weight:700; color:#e2f0ff; }
  .lrsi-legend   { display:flex; gap:14px; padding:5px 14px; flex-wrap:wrap;
    border-bottom:1px solid rgba(255,255,255,0.04); }
  .lrsi-leg-item { display:flex; align-items:center; gap:5px;
    font-size:10px; color:rgba(180,210,255,0.5); }
  .lrsi-leg-dot  { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .lrsi-chart-area { height:240px; position:relative; }
  /* Mini navigator */
  .lrsi-nav-area { height:56px; position:relative;
    border-top:1px solid rgba(255,255,255,0.04); }

  /* Range / filter toggle */
  .lrsi-rng-grp { display:flex; gap:2px; }
  .lrsi-rbtn {
    border-radius:3px; font-family:"IBM Plex Mono",monospace; font-size:10px;
    cursor:pointer; padding:2px 8px; line-height:1.6; transition:all .15s;
  }
  .lrsi-rbtn.on  { background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); color:#e2f0ff; }
  .lrsi-rbtn.off { background:transparent; border:1px solid rgba(255,255,255,0.1); color:rgba(200,220,255,0.3); }
  .lrsi-rbtn.off:hover { border-color:rgba(255,255,255,0.22); color:rgba(200,220,255,0.6); }

  /* Events sidebar + chart layout */
  .lrsi-top-row { display:flex; gap:10px; padding:0 16px 10px; flex-shrink:0; }
  .lrsi-events  { width:230px; flex-shrink:0; display:flex; flex-direction:column; gap:6px; }
  .lrsi-event-card {
    background:rgba(255,255,255,0.02);
    border:1px solid rgba(255,255,255,0.07);
    border-radius:6px; padding:9px 11px; cursor:default;
    transition:background .15s;
  }
  .lrsi-event-card:hover { background:rgba(255,255,255,0.045); }
  .lrsi-event-date   { font-size:9px; color:rgba(180,210,255,0.45); margin-bottom:2px; }
  .lrsi-event-amount { font-size:14px; font-weight:900; color:#f7931a; }
  .lrsi-event-text   { font-size:9px; color:rgba(180,210,255,0.5); margin-top:3px; line-height:1.4;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

  /* Table */
  .lrsi-table-wrap { padding:0 16px 16px; flex-shrink:0; }
  .lrsi-table-hdr  { display:flex; justify-content:space-between; align-items:center;
    margin-bottom:8px; flex-wrap:wrap; gap:6px; }
  .lrsi-table-title { font-size:12px; font-weight:700; color:#e2f0ff; }
  table.lrsi-tbl { width:100%; border-collapse:collapse; font-size:11px; }
  table.lrsi-tbl th {
    padding:6px 8px; text-align:right; font-size:9px; font-weight:700;
    color:rgba(180,210,255,0.4); border-bottom:1px solid rgba(255,255,255,0.07);
    letter-spacing:.04em; text-transform:uppercase; white-space:nowrap;
  }
  table.lrsi-tbl th:first-child,
  table.lrsi-tbl th:nth-child(2) { text-align:left; }
  table.lrsi-tbl td { padding:7px 8px; border-bottom:1px solid rgba(255,255,255,0.04); white-space:nowrap; }
  table.lrsi-tbl tr:hover td { background:rgba(247,147,26,0.04); }
  table.lrsi-tbl td.r { text-align:right; }

  /* RSI gauge */
  .rsi-gauge-wrap { display:flex; align-items:center; justify-content:center; padding:8px 0 4px; }
  .rsi-signal { font-size:11px; color:rgba(180,210,255,0.6); margin-top:4px;
    text-align:center; font-style:italic; }

  /* RSI scatter */
  .rsi-scatter-area { height:280px; position:relative; margin:0 16px 10px;
    background:rgba(255,255,255,0.02);
    border:1px solid rgba(255,255,255,0.08); border-radius:8px; overflow:hidden; }

  /* RSI table badge */
  .rsi-badge {
    display:inline-block; padding:1px 7px; border-radius:3px;
    font-size:10px; font-weight:800;
  }

  /* Skeleton */
  @keyframes lrsi-pulse { 0%,100%{opacity:.35} 50%{opacity:.12} }
  .lrsi-skel { background:rgba(255,255,255,0.08); border-radius:4px;
    animation:lrsi-pulse 1.4s ease-in-out infinite; }

  @media(max-width:760px){
    .lrsi-top-row { flex-direction:column; }
    .lrsi-events  { width:100%; flex-direction:row; flex-wrap:wrap; overflow:visible; }
    .lrsi-event-card { flex:1 1 180px; }
    .lrsi-cards { flex-wrap:wrap; }
    .lrsi-card  { min-width:120px; }
  }
`;

const Skel: React.FC<{ h?: number; mb?: number; w?: string }> = ({ h = 14, mb = 6, w = '100%' }) => (
  <div className="lrsi-skel" style={{ height: h, marginBottom: mb, width: w }} />
);

// ── Historical Liquidation Chart ───────────────────────────────────────────────
const LiqHistChart: React.FC<{ data: LiqHistory[]; isMini?: boolean }> = ({ data, isMini = false }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tipIdx, setTipIdx] = useState<number | null>(null);
  const n = data.length;

  const draw = useCallback(() => {
    const canvas = canvasRef.current; const cont = containerRef.current;
    if (!canvas || !cont || n < 2) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;
    const W = cont.clientWidth; const H = cont.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR); ctx.clearRect(0, 0, W, H);

    if (isMini) {
      // Mini nav: just a simple blue area
      const vals = data.map(d => d.total);
      const max  = Math.max(...vals) || 1;
      const toX  = (i: number) => (i / (n - 1)) * W;
      const toY  = (v: number) => H - (v / max) * H * 0.85;
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#346aa955'); grad.addColorStop(1, '#346aa900');
      ctx.beginPath(); ctx.moveTo(toX(0), toY(vals[0]));
      for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(vals[i]));
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); ctx.moveTo(toX(0), toY(vals[0]));
      for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(vals[i]));
      ctx.strokeStyle = '#346aa9'; ctx.lineWidth = 1; ctx.stroke();
      return;
    }

    const PAD  = { top: 12, right: 68, bottom: 26, left: 10 };
    const cw   = W - PAD.left - PAD.right;
    const ch   = H - PAD.top - PAD.bottom;
    const maxLiq  = Math.max(...data.map(d => Math.max(d.longLiq, d.shortLiq))) || 1;
    const btcPrices = data.map(d => d.btcPrice);
    const minBtc  = Math.min(...btcPrices); const maxBtc = Math.max(...btcPrices);
    const rangeBtc = maxBtc - minBtc || 1;
    const barW     = Math.max(1, cw / n - 0.5);

    const toX    = (i: number) => PAD.left + (i / (n - 1)) * cw;
    const toBarX = (i: number) => PAD.left + (i / n) * cw;
    const toLiqY = (v: number) => PAD.top + ch - (v / maxLiq) * ch * 0.82;
    const toBtcY = (v: number) => PAD.top + ch - ((v - minBtc) / rangeBtc) * ch * 0.72;

    // Grid
    [0, 0.25, 0.5, 0.75, 1].forEach(pct => {
      const y = PAD.top + ch - pct * ch;
      ctx.setLineDash([3, 6]); ctx.lineWidth = 0.4; ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    });
    ctx.setLineDash([]);

    // BTC price label axis (right)
    const fsz = Math.max(8, Math.min(10, W / 70));
    [minBtc, (minBtc + maxBtc) / 2, maxBtc].forEach(v => {
      const y = toBtcY(v);
      ctx.fillStyle = 'rgba(247,147,26,0.5)'; ctx.font = `${fsz}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText('$' + (v / 1000).toFixed(0) + 'K', W - PAD.right + 4, y + 3);
    });

    // X labels
    const xN = Math.max(2, Math.min(6, Math.floor(W / 90)));
    ctx.fillStyle = 'rgba(180,200,240,0.3)'; ctx.font = `${fsz}px monospace`; ctx.textAlign = 'center';
    for (let i = 0; i < xN; i++) {
      const idx = Math.floor((i / (xN - 1)) * (n - 1));
      const d = new Date(data[idx].timestamp);
      ctx.fillText(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), toX(idx), H - 5);
    }

    // Bars: long (green) below center, short (red) above — mirrored style
    data.forEach((d, i) => {
      const x    = toBarX(i);
      const midY = PAD.top + ch * 0.5;
      // Long bars grow downward from midY
      const longH  = (d.longLiq  / maxLiq) * ch * 0.42;
      // Short bars grow upward from midY
      const shortH = (d.shortLiq / maxLiq) * ch * 0.42;
      const isHov  = tipIdx === i;

      ctx.fillStyle = isHov ? green : green + 'bb';
      ctx.fillRect(x, midY, barW, longH);

      ctx.fillStyle = isHov ? red : red + 'bb';
      ctx.fillRect(x, midY - shortH, barW, shortH);
    });

    // BTC price line
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = toX(i); const y = toBtcY(d.btcPrice);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#f7931a'; ctx.lineWidth = 1.8; ctx.stroke();

    // Crosshair
    if (tipIdx !== null && data[tipIdx]) {
      const tx = toX(tipIdx);
      ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, PAD.top); ctx.lineTo(tx, PAD.top + ch); ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [data, n, isMini, tipIdx]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current; if (!c || n < 2) return;
    const r = c.getBoundingClientRect();
    const cw = c.clientWidth - 10 - 68;
    setTipIdx(Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left - 10) / cw * (n - 1)))));
  };

  const tipD    = tipIdx !== null ? data[tipIdx] : null;
  const tipXPct = tipIdx !== null ? tipIdx / Math.max(n - 1, 1) : 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => setTipIdx(null)} />
      {!isMini && tipD && (
        <div style={{
          position: 'absolute',
          left: tipXPct > 0.65 ? undefined : `calc(${tipXPct * 100}% + 14px)`,
          right: tipXPct > 0.65 ? '72px' : undefined,
          top: 10,
          background: 'rgba(5,10,28,0.97)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6, padding: '9px 13px', fontSize: 10, color: '#a8c0f0',
          pointerEvents: 'none', zIndex: 20, fontFamily: '"IBM Plex Mono",monospace', minWidth: 190,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}>
          <div style={{ color: 'rgba(200,220,255,0.5)', marginBottom: 6,
            borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 5 }}>
            {new Date(tipD.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          {[
            { label: 'BTC Price',  val: fmtPrice(tipD.btcPrice), color: '#f7931a' },
            { label: 'Long Liq',   val: fmt$(tipD.longLiq,  2),  color: green     },
            { label: 'Short Liq',  val: fmt$(tipD.shortLiq, 2),  color: red       },
            { label: 'Total',      val: fmt$(tipD.total,    2),  color: '#e2f0ff' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
              marginBottom: 3, gap: 12 }}>
              <span style={{ color: 'rgba(180,200,240,0.6)' }}>{label}:</span>
              <span style={{ color, fontWeight: 800 }}>{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── RSI Arc Gauge ──────────────────────────────────────────────────────────────
const RsiGauge: React.FC<{ rsi: number }> = ({ rsi }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W = 200; const H = 120;
    canvas.width = W * 2; canvas.height = H * 2;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(2, 2);
    const cx = W / 2; const cy = H - 10;
    const R = 75; const startA = Math.PI; const endA = 2 * Math.PI;

    // Background arc
    ctx.beginPath(); ctx.arc(cx, cy, R, startA, endA);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 14;
    ctx.lineCap = 'round'; ctx.stroke();

    // Color zones
    const zones = [
      { from: 0,  to: 30,  color: '#3b82f6' },
      { from: 30, to: 50,  color: '#60a5fa' },
      { from: 50, to: 70,  color: '#a3e635' },
      { from: 70, to: 100, color: '#ef4444' },
    ];
    zones.forEach(z => {
      const a1 = startA + (z.from / 100) * Math.PI;
      const a2 = startA + (z.to   / 100) * Math.PI;
      ctx.beginPath(); ctx.arc(cx, cy, R, a1, a2);
      ctx.strokeStyle = z.color + '44'; ctx.lineWidth = 14; ctx.lineCap = 'butt'; ctx.stroke();
    });

    // Value arc
    const pct   = Math.max(0, Math.min(100, rsi));
    const angle = startA + (pct / 100) * Math.PI;
    const color = rsi >= 70 ? '#ef4444' : rsi <= 30 ? '#3b82f6' : '#a3e635';
    ctx.beginPath(); ctx.arc(cx, cy, R, startA, angle);
    ctx.strokeStyle = color; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.stroke();

    // Needle
    const nx = cx + R * Math.cos(angle);
    const ny = cy + R * Math.sin(angle);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();

    // Labels
    ctx.fillStyle = 'rgba(200,220,255,0.4)'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('0', cx - R - 8, cy + 4);
    ctx.fillText('50', cx, cy - R - 6);
    ctx.fillText('100', cx + R + 10, cy + 4);

    // Centre value
    ctx.fillStyle = color; ctx.font = 'bold 24px monospace';
    ctx.fillText(rsi.toFixed(1), cx, cy - 22);
    ctx.fillStyle = 'rgba(180,210,255,0.4)'; ctx.font = '9px monospace';
    ctx.fillText('RSI (14)', cx, cy - 8);
  }, [rsi]);
  return <canvas ref={canvasRef} style={{ width: 200, height: 120 }} />;
};

// ── RSI Scatter Plot ───────────────────────────────────────────────────────────
const RsiScatter: React.FC<{ coins: RsiCoin[] }> = ({ coins }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovCoin, setHovCoin] = useState<RsiCoin | null>(null);
  const [hovPos,  setHovPos]  = useState({ x: 0, y: 0 });

  const draw = useCallback((hov: RsiCoin | null) => {
    const canvas = canvasRef.current; const cont = containerRef.current;
    if (!canvas || !cont || coins.length === 0) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;
    const W = cont.clientWidth; const H = cont.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR); ctx.clearRect(0, 0, W, H);

    const PAD = { top: 14, right: 16, bottom: 28, left: 58 };
    const cw  = W - PAD.left - PAD.right;
    const ch  = H - PAD.top  - PAD.bottom;
    const fsz = 9;

    const mcaps   = coins.map(c => c.marketCap);
    const minMcap = Math.min(...mcaps); const maxMcap = Math.max(...mcaps);

    const toX = (mc: number) => PAD.left + (Math.log(mc / minMcap) / Math.log(maxMcap / minMcap)) * cw;
    const toY = (rsi: number) => PAD.top + ch - ((rsi - 0) / 100) * ch;

    // Grid
    [0, 30, 50, 70, 100].forEach(rsi => {
      const y = toY(rsi);
      const isZone = rsi === 30 || rsi === 70;
      ctx.setLineDash(isZone ? [] : [3, 6]);
      ctx.strokeStyle = isZone ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)';
      ctx.lineWidth = isZone ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(180,210,255,0.4)'; ctx.font = `${fsz}px monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(rsi.toString(), PAD.left - 4, y + 3);
    });

    // Zone labels
    ctx.font = '8px monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = '#ef444466'; ctx.fillText('OVERBOUGHT', PAD.left + 4, toY(70) - 4);
    ctx.fillStyle = '#3b82f666'; ctx.fillText('OVERSOLD',   PAD.left + 4, toY(30) + 12);

    // Zone shading
    ctx.fillStyle = 'rgba(239,68,68,0.05)';
    ctx.fillRect(PAD.left, PAD.top, cw, toY(70) - PAD.top);
    ctx.fillStyle = 'rgba(59,130,246,0.05)';
    ctx.fillRect(PAD.left, toY(30), cw, PAD.top + ch - toY(30));

    // Dots
    coins.forEach(c => {
      const x    = toX(c.marketCap);
      const y    = toY(c.rsi);
      const r    = Math.max(5, Math.min(14, Math.log10(c.marketCap / 1e8) * 3));
      const isHov = hov?.id === c.id;
      ctx.beginPath(); ctx.arc(x, y, r + (isHov ? 3 : 0), 0, Math.PI * 2);
      ctx.fillStyle = isHov ? c.color : c.color + 'cc';
      ctx.fill();
      if (isHov) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }

      // Label for bigger coins or hovered
      if (c.marketCap > 1e10 || isHov) {
        ctx.fillStyle = isHov ? '#fff' : 'rgba(220,235,255,0.7)';
        ctx.font = `${isHov ? 9 : 8}px monospace`; ctx.textAlign = 'center';
        ctx.fillText(c.symbol, x, y - r - 3);
      }
    });

    // X-axis label
    ctx.fillStyle = 'rgba(180,210,255,0.3)'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('← Market Cap (log scale) →', PAD.left + cw / 2, H - 4);
  }, [coins]);

  useEffect(() => {
    draw(hovCoin);
    const ro = new ResizeObserver(() => draw(hovCoin));
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw, hovCoin]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; const cont = containerRef.current;
    if (!canvas || !cont) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    const PAD = { top: 14, right: 16, bottom: 28, left: 58 };
    const cw  = cont.clientWidth  - PAD.left - PAD.right;
    const ch  = cont.clientHeight - PAD.top  - PAD.bottom;
    const mcaps  = coins.map(c => c.marketCap);
    const minMcap = Math.min(...mcaps); const maxMcap = Math.max(...mcaps);
    const toX = (mc: number) => PAD.left + (Math.log(mc / minMcap) / Math.log(maxMcap / minMcap)) * cw;
    const toY = (rsi: number) => PAD.top + ch - ((rsi / 100)) * ch;

    let closest: RsiCoin | null = null; let minDist = 20;
    coins.forEach(c => {
      const dx = mx - toX(c.marketCap); const dy = my - toY(c.rsi);
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) { minDist = d; closest = c; }
    });
    setHovCoin(closest);
    setHovPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => setHovCoin(null)} />
      {hovCoin && (
        <div style={{
          position: 'absolute',
          left: hovPos.x + 14, top: hovPos.y - 10,
          background: 'rgba(5,10,28,0.97)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6, padding: '9px 13px', fontSize: 10, color: '#a8c0f0',
          pointerEvents: 'none', zIndex: 20, fontFamily: '"IBM Plex Mono",monospace', minWidth: 170,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}>
          <div style={{ color: hovCoin.color, fontWeight: 800, marginBottom: 5,
            borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 4 }}>
            {hovCoin.name} ({hovCoin.symbol})
          </div>
          {[
            ['RSI (14)',   hovCoin.rsi.toFixed(2)],
            ['Price',      fmtPrice(hovCoin.price)],
            ['Market Cap', fmt$(hovCoin.marketCap)],
            ['Signal',     hovCoin.signal],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, gap: 12 }}>
              <span style={{ color: 'rgba(180,200,240,0.6)' }}>{k}:</span>
              <span style={{ color: k === 'Signal'
                ? hovCoin.signal === 'overbought' ? red : hovCoin.signal === 'oversold' ? '#3b82f6' : '#a3e635'
                : '#e2f0ff', fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Liquidations Tab ───────────────────────────────────────────────────────────
const LiquidationsTab: React.FC = () => {
  const [data,    setData]    = useState<LiqData | null>(null);
  const [hist,    setHist]    = useState<LiqHistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [histRange, setHistRange] = useState<LiqHistRange>('30');
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [d, h] = await Promise.all([
        fetch('/api/liquidations?type=summary').then(r => r.json()) as Promise<LiqData>,
        fetch(`/api/liquidations?type=history&days=${histRange}`).then(r => r.json()) as Promise<LiqHistData>,
      ]);
      if (!d.success) throw new Error(d.error ?? 'API error');
      setData(d); setHist(h);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
  }, [histRange]);

  useEffect(() => { load(); }, [load]);

  const sum = data?.summary;
  const rows = data?.rows ?? [];
  const histData = hist?.history ?? [];

  return (
    <div className="lrsi-body">
      {/* Header */}
      <div className="lrsi-hdr">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span className="lrsi-title">Crypto Liquidations</span>
          <button onClick={load} disabled={loading} style={{
            background: 'rgba(247,147,26,0.08)', border: '1px solid rgba(247,147,26,0.2)',
            color: '#f7931a', padding: '2px 9px', fontSize: 10,
            cursor: loading ? 'default' : 'pointer', borderRadius: 3,
            fontFamily: '"IBM Plex Mono",monospace', opacity: loading ? 0.5 : 1,
          }}>{loading ? '↻ Loading…' : '↺ Refresh'}</button>
        </div>
        <div className="lrsi-subtitle">
          This page shows the latest crypto liquidations in one easy-to-use dashboard.
          Data includes long and short liquidations in the latest 24 hours and historical data.
        </div>
        {error && (
          <div style={{ marginTop: 6, background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5',
            padding: '5px 10px', borderRadius: 5, fontSize: 11 }}>
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="lrsi-cards">
        {[
          { label: 'Total Liquidations (24h)', val: sum ? fmt$(sum.total24h) : '—',  color: '#e2f0ff' },
          { label: 'Long Liquidations',        val: sum ? fmt$(sum.totalLong) : '—', color: green     },
          { label: 'Short Liquidations',       val: sum ? fmt$(sum.totalShort) : '—', color: red      },
        ].map(({ label, val, color }) => (
          <div key={label} className="lrsi-card">
            <div className="lrsi-card-label">{label}</div>
            {loading && !sum ? <Skel h={26} /> : (
              <div className="lrsi-card-val" style={{ color }}>{val}</div>
            )}
          </div>
        ))}
      </div>

      {/* Top row: events + chart */}
      <div className="lrsi-top-row">
        {/* Top events */}
        <div className="lrsi-events">
          <div style={{ fontSize: 11, fontWeight: 700, color: '#e2f0ff', marginBottom: 4 }}>
            Top Liquidation Events of All Time
          </div>
          {loading && !data ? (
            [1,2,3].map(i => <div key={i} className="lrsi-event-card"><Skel h={46} mb={0} /></div>)
          ) : (data?.topEvents ?? []).slice(0, 5).map((ev, i) => (
            <div key={i} className="lrsi-event-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 9, color: '#f7931a' }}>⬡</span>
                <span className="lrsi-event-date">
                  {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="lrsi-event-amount" style={{ marginLeft: 'auto', fontSize: 12 }}>
                  {fmt$(ev.amount)}
                </span>
              </div>
              <div className="lrsi-event-text">{ev.headline}</div>
            </div>
          ))}
        </div>

        {/* Historical chart */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="lrsi-chart-panel" style={{ margin: 0 }}>
            <div className="lrsi-ch-hdr">
              <span className="lrsi-ch-title">Historical Liquidations Chart</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div className="lrsi-rng-grp">
                  {(['7', '30', '90'] as LiqHistRange[]).map(v => (
                    <button key={v} className={`lrsi-rbtn ${histRange === v ? 'on' : 'off'}`}
                      onClick={() => setHistRange(v)}>{v}D</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="lrsi-legend">
              {[
                { color: green,     label: 'Long'        },
                { color: red,       label: 'Short'       },
                { color: '#f7931a', label: 'Bitcoin Price'},
              ].map(({ color, label }) => (
                <div key={label} className="lrsi-leg-item">
                  <span className="lrsi-leg-dot" style={{ background: color }} />
                  {label}
                </div>
              ))}
            </div>
            <div className="lrsi-chart-area">
              {loading && !histData.length ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: 'rgba(200,220,255,0.3)', fontSize: 11 }}>
                  Loading chart…
                </div>
              ) : (
                <LiqHistChart data={histData} />
              )}
            </div>
            {/* Mini navigator */}
            <div className="lrsi-nav-area">
              {histData.length > 0 && <LiqHistChart data={histData} isMini />}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="lrsi-table-wrap">
        <div className="lrsi-table-hdr">
          <div className="lrsi-table-title">Crypto Liquidations</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['1h', '4h', '24h'] as const).map(t => (
              <button key={t} className={`lrsi-rbtn ${t === '24h' ? 'on' : 'off'}`}>{t}</button>
            ))}
          </div>
        </div>
        <table className="lrsi-tbl">
          <thead>
            <tr>
              <th style={{ width: 28 }}>#</th>
              <th>Name</th>
              <th className="r">Price</th>
              <th className="r">Market Cap</th>
              <th className="r">Open Interest</th>
              <th className="r" style={{ color: green + 'cc' }}>Long Liq (24h)</th>
              <th className="r" style={{ color: red   + 'cc' }}>Short Liq (24h)</th>
              <th className="r">Total Liq (24h)</th>
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan={8}><Skel h={28} mb={2} /></td></tr>
              ))
            ) : rows.map((c, i) => (
              <tr key={c.id}>
                <td style={{ color: 'rgba(180,210,255,0.3)', fontSize: 10 }}>{c.rank}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <img src={c.image} alt={c.symbol} width={18} height={18}
                      style={{ borderRadius: '50%', objectFit: 'cover' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div>
                      <span style={{ color: '#e2f0ff', fontWeight: 700 }}>{c.name}</span>
                      <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: 9, marginLeft: 5 }}>{c.symbol}</span>
                    </div>
                  </div>
                </td>
                <td className="r">
                  <div style={{ color: '#c8d8f4' }}>{fmtPrice(c.price)}</div>
                  <div style={{ fontSize: 9, color: c.change24h >= 0 ? green : red }}>
                    {c.change24h >= 0 ? '+' : ''}{c.change24h.toFixed(2)}%
                  </div>
                </td>
                <td className="r" style={{ color: 'rgba(180,210,255,0.7)' }}>{fmt$(c.marketCap)}</td>
                <td className="r" style={{ color: 'rgba(180,210,255,0.7)' }}>{fmt$(c.openInterest)}</td>
                <td className="r" style={{ color: green, fontWeight: 700 }}>{fmt$(c.longLiq)}</td>
                <td className="r" style={{ color: red,   fontWeight: 700 }}>{fmt$(c.shortLiq)}</td>
                <td className="r" style={{ color: '#e2f0ff', fontWeight: 700 }}>{fmt$(c.totalLiq)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── RSI Tab ────────────────────────────────────────────────────────────────────
const RSITab: React.FC = () => {
  const [data,    setData]    = useState<RsiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d: RsiData = await fetch('/api/rsi').then(r => r.json());
      if (!d.success) throw new Error(d.error ?? 'API error');
      setData(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const coins = data?.coins ?? [];

  return (
    <div className="lrsi-body">
      {/* Header */}
      <div className="lrsi-hdr">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span className="lrsi-title">RSI — Relative Strength Index</span>
          <button onClick={load} disabled={loading} style={{
            background: 'rgba(247,147,26,0.08)', border: '1px solid rgba(247,147,26,0.2)',
            color: '#f7931a', padding: '2px 9px', fontSize: 10,
            cursor: loading ? 'default' : 'pointer', borderRadius: 3,
            fontFamily: '"IBM Plex Mono",monospace', opacity: loading ? 0.5 : 1,
          }}>{loading ? '↻ Loading…' : '↺ Refresh'}</button>
        </div>
        <div className="lrsi-subtitle">
          RSI (14) computed using Wilder smoothing on 30-day daily price data for top coins. Above 70 = Overbought. Below 30 = Oversold.
        </div>
        {error && (
          <div style={{ marginTop: 6, background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5',
            padding: '5px 10px', borderRadius: 5, fontSize: 11 }}>⚠ {error}</div>
        )}
      </div>

      {/* Gauge + stat cards */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
        {/* Gauge card */}
        <div className="lrsi-card" style={{ minWidth: 220, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="lrsi-card-label" style={{ alignSelf: 'flex-start' }}>Average Market RSI</div>
          {loading && !data ? (
            <Skel h={120} w="200px" />
          ) : data ? (
            <>
              <div className="rsi-gauge-wrap">
                <RsiGauge rsi={data.avgRSI} />
              </div>
              <div className="rsi-signal">{data.marketSignal}</div>
            </>
          ) : null}
        </div>

        {/* Signal distribution */}
        <div className="lrsi-card" style={{ minWidth: 200 }}>
          <div className="lrsi-card-label">Signal Distribution</div>
          {loading && !data ? (
            <><Skel h={20} /><Skel h={20} /><Skel h={20} /></>
          ) : data ? (
            <>
              {[
                { label: 'Overbought (RSI ≥ 70)', pct: data.overboughtPct, n: data.overbought, color: red     },
                { label: 'Neutral (30–70)',        pct: data.neutralPct,    n: data.neutral,    color: '#a3e635' },
                { label: 'Oversold (RSI ≤ 30)',    pct: data.oversoldPct,   n: data.oversold,   color: '#3b82f6' },
              ].map(({ label, pct, n, color }) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: 'rgba(180,210,255,0.6)' }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color }}>
                      {pct.toFixed(1)}% <span style={{ color: 'rgba(180,210,255,0.4)', fontWeight: 400 }}>({n})</span>
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </>
          ) : null}
        </div>

        {/* Top overbought / oversold */}
        <div className="lrsi-card" style={{ minWidth: 200, flex: 1 }}>
          <div className="lrsi-card-label">Extremes</div>
          {loading && !data ? <Skel h={80} /> : (
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { title: '🔴 Overbought', filter: (c: RsiCoin) => c.signal === 'overbought', color: red },
                { title: '🔵 Oversold',   filter: (c: RsiCoin) => c.signal === 'oversold',   color: '#3b82f6' },
              ].map(({ title, filter, color }) => (
                <div key={title} style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'rgba(180,210,255,0.5)', marginBottom: 6 }}>{title}</div>
                  {coins.filter(filter).slice(0, 4).map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between',
                      marginBottom: 4, alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: '#c8d8f4' }}>{c.symbol}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color }}>{c.rsi.toFixed(1)}</span>
                    </div>
                  ))}
                  {coins.filter(filter).length === 0 && (
                    <div style={{ fontSize: 10, color: 'rgba(180,210,255,0.3)' }}>None</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scatter plot */}
      <div style={{ padding: '0 16px 4px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2f0ff', marginBottom: 6 }}>
          RSI Heatmap — Market Cap vs RSI
        </div>
      </div>
      <div className="rsi-scatter-area">
        {loading && !coins.length ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'rgba(200,220,255,0.3)', fontSize: 11 }}>
            Loading scatter data…
          </div>
        ) : coins.length > 0 ? (
          <RsiScatter coins={coins} />
        ) : null}
      </div>

      {/* RSI Table */}
      <div className="lrsi-table-wrap" style={{ paddingTop: 10 }}>
        <div className="lrsi-table-title" style={{ marginBottom: 8 }}>RSI by Coin</div>
        <table className="lrsi-tbl">
          <thead>
            <tr>
              <th>#</th><th>Coin</th>
              <th className="r">Price</th>
              <th className="r">24h Chg</th>
              <th className="r">Market Cap</th>
              <th className="r">RSI (14)</th>
              <th className="r">Signal</th>
            </tr>
          </thead>
          <tbody>
            {loading && !coins.length ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={7}><Skel h={26} mb={2} /></td></tr>
              ))
            ) : [...coins].sort((a, b) => b.rsi - a.rsi).map((c, i) => (
              <tr key={c.id}>
                <td style={{ color: 'rgba(180,210,255,0.3)', fontSize: 10 }}>{i + 1}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <img src={c.image} alt={c.symbol} width={16} height={16}
                      style={{ borderRadius: '50%' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span style={{ color: '#e2f0ff', fontWeight: 700 }}>{c.name}</span>
                    <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: 9 }}>{c.symbol}</span>
                  </div>
                </td>
                <td className="r" style={{ color: '#c8d8f4' }}>{fmtPrice(c.price)}</td>
                <td className="r" style={{ color: c.change24h >= 0 ? green : red, fontWeight: 700 }}>
                  {c.change24h >= 0 ? '+' : ''}{c.change24h.toFixed(2)}%
                </td>
                <td className="r" style={{ color: 'rgba(180,210,255,0.7)' }}>{fmt$(c.marketCap)}</td>
                <td className="r">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    <div style={{ width: 48, height: 4, background: 'rgba(255,255,255,0.07)',
                      borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        width: `${c.rsi}%`, height: '100%', borderRadius: 2,
                        background: c.rsi >= 70 ? red : c.rsi <= 30 ? '#3b82f6' : '#a3e635',
                      }} />
                    </div>
                    <span style={{
                      color: c.rsi >= 70 ? red : c.rsi <= 30 ? '#3b82f6' : '#a3e635',
                      fontWeight: 800,
                    }}>{c.rsi.toFixed(1)}</span>
                  </div>
                </td>
                <td className="r">
                  <span className="rsi-badge" style={{
                    background: c.signal === 'overbought' ? 'rgba(239,68,68,0.15)' :
                                c.signal === 'oversold'   ? 'rgba(59,130,246,0.15)' :
                                                            'rgba(163,230,53,0.1)',
                    color: c.signal === 'overbought' ? red :
                           c.signal === 'oversold'   ? '#3b82f6' : '#a3e635',
                    border: `1px solid ${c.signal === 'overbought' ? red + '40' :
                                         c.signal === 'oversold'   ? '#3b82f640' : '#a3e63540'}`,
                  }}>
                    {c.signal}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Root ───────────────────────────────────────────────────────────────────────
const LiqRsiDashboard: React.FC<{ selectedSymbol?: string }> = ({ selectedSymbol }) => {
  const [tab, setTab] = useState<ActiveTab>('liquidations');
  return (
    <>
      <style>{CSS}</style>
      <div className="lrsi-root">
        <div className="lrsi-tabs">
          {([
            ['liquidations', '💧 Liquidations'],
            ['rsi',          '📊 RSI'],
          ] as [ActiveTab, string][]).map(([v, label]) => (
            <button key={v} className={`lrsi-tab ${tab === v ? 'active' : ''}`}
              onClick={() => setTab(v)}>{label}</button>
          ))}
        </div>
        {tab === 'liquidations' ? <LiquidationsTab /> : <RSITab />}
      </div>
    </>
  );
};

export default LiqRsiDashboard;