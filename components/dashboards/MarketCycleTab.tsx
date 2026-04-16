'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface RainbowBand { name: string; color: string; values: number[] }
interface Indicator {
  id: number; name: string; current: string;
  change24h: number; reference: string; triggered: boolean;
}
interface ChartData {
  dates: string[]; prices: number[];
  puell: (number | null)[];
  dma111: (number | null)[];
  dma350x2: (number | null)[];
  rainbow: RainbowBand[];
}
interface ApiData {
  success: boolean;
  currentPrice: number;
  currentPuell: number | null;
  current111DMA: number | null;
  current350DMAx2: number | null;
  piCycleCrossed: boolean;
  piCycleCrossDate: string;
  rainbowBandIdx: number;
  rainbowBandName: string;
  hitCount: number;
  totalCount: number;
  pct: string;
  halvings: { date: string; label: string }[];
  chart: ChartData;
  indicators: Indicator[];
  source: string;
  updatedAt: number;
  error?: string;
}
type Range = '30d' | '1y' | 'all';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtP  = (n: number) => n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M'
                            : n >= 1e3 ? '$' + (n / 1e3).toFixed(0) + 'K'
                            : '$' + n?.toFixed(2);
const fmtPx = (n: number) => n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M'
                            : n >= 1e3 ? '$' + (n / 1e3).toFixed(0) + 'K'
                            : '$' + n?.toFixed(0);

function sliceRange(arr: (number | null)[] | number[], range: Range, total: number) {
  const n30 = Math.min(30, total);
  const n1y = Math.min(365, total);
  if (range === '30d') return (arr as number[]).slice(-n30);
  if (range === '1y')  return (arr as number[]).slice(-n1y);
  return arr as number[];
}
function sliceDates(dates: string[], range: Range) {
  if (range === '30d') return dates.slice(-30);
  if (range === '1y')  return dates.slice(-365);
  return dates;
}

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
  .mc-root {
    display:flex; flex-direction:column; height:100%;
    background:#090f1e;
    font-family:"IBM Plex Mono","Courier New",monospace;
    color:#c8d8f0; overflow:hidden; box-sizing:border-box;
  }
  .mc-hdr  { padding:10px 16px 8px; flex-shrink:0; border-bottom:1px solid rgba(255,255,255,0.06); }
  .mc-body { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; display:flex; flex-direction:column; }
  .mc-top  { display:flex; gap:10px; padding:10px 16px; flex-shrink:0; }
  .mc-sidebar { width:256px; flex-shrink:0; display:flex; flex-direction:column; gap:8px; }
  .mc-card {
    background:rgba(255,255,255,0.025);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; padding:12px 14px;
  }
  .mc-card-title { font-size:11px; font-weight:700; color:rgba(200,220,255,0.55);
    text-transform:uppercase; letter-spacing:0.06em; margin-bottom:10px;
    display:flex; align-items:center; gap:5px; }
  .mc-info-icon { font-size:10px; color:rgba(180,200,240,0.3); cursor:default; }
  .mc-charts-col { flex:1; min-width:0; display:flex; flex-direction:column; gap:10px; }
  .mc-chart-panel {
    background:rgba(255,255,255,0.02);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; overflow:hidden;
    display:flex; flex-direction:column;
  }
  .mc-ch-hdr {
    padding:9px 14px; display:flex; justify-content:space-between; align-items:center;
    border-bottom:1px solid rgba(255,255,255,0.05); flex-wrap:wrap; gap:6px; flex-shrink:0;
  }
  .mc-ch-title { font-size:13px; font-weight:700; color:#e2f0ff;
    display:flex; align-items:center; gap:5px; }
  .mc-legend { display:flex; gap:12px; padding:5px 14px; flex-shrink:0; flex-wrap:wrap;
    border-bottom:1px solid rgba(255,255,255,0.04); }
  .mc-leg-item { display:flex; align-items:center; gap:4px;
    font-size:10px; color:rgba(180,210,255,0.5); }
  .mc-leg-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .mc-chart-area { flex:1; position:relative; min-height:0; }
  /* bottom charts row */
  .mc-bottom-row { display:flex; gap:10px; padding:0 16px 10px; flex-shrink:0; height:280px; }
  .mc-bottom-panel { flex:1; min-width:0; }
  /* toggle */
  .mc-tog { display:flex; gap:2px; }
  .mc-tbtn { border-radius:3px; font-family:monospace; font-size:10px;
    cursor:pointer; padding:2px 8px; transition:all 0.15s; line-height:1.6; }
  .mc-tbtn.on  { background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); color:#e2f0ff; }
  .mc-tbtn.off { background:transparent; border:1px solid rgba(255,255,255,0.1); color:rgba(200,220,255,0.3); }
  .mc-tbtn.off:hover { border-color:rgba(255,255,255,0.2); color:rgba(200,220,255,0.6); }
  /* slider */
  .mc-slider-track { height:6px; border-radius:3px; position:relative;
    background:linear-gradient(to right,#22c55e,#eab308,#ef4444); margin:6px 0 4px; }
  .mc-slider-dot { width:14px; height:14px; border-radius:50%; background:#fff;
    border:2px solid #111; position:absolute; top:50%; transform:translate(-50%,-50%);
    box-shadow:0 0 0 2px rgba(255,255,255,0.25); }
  /* indicator table */
  .mc-table-section { padding:10px 16px 12px; flex-shrink:0; }
  .mc-table { width:100%; border-collapse:collapse; font-size:12px; }
  .mc-table th { padding:8px 12px; text-align:left; font-size:10px; font-weight:600;
    color:rgba(180,210,255,0.4); border-bottom:1px solid rgba(255,255,255,0.07);
    letter-spacing:0.05em; cursor:pointer; white-space:nowrap; }
  .mc-table td { padding:9px 12px; border-bottom:1px solid rgba(255,255,255,0.04);
    white-space:nowrap; }
  .mc-table tr:hover td { background:rgba(255,255,255,0.02); }
  /* skeleton */
  @keyframes mc-pulse { 0%,100%{opacity:.35} 50%{opacity:.12} }
  .mc-skel { background:rgba(255,255,255,0.08); border-radius:4px;
    animation:mc-pulse 1.4s ease-in-out infinite; }
  /* responsive */
  @media(max-width:760px){
    .mc-top { flex-direction:column; }
    .mc-sidebar { width:100%; flex-direction:row; flex-wrap:wrap; }
    .mc-card { flex:1 1 200px; }
    .mc-bottom-row { flex-direction:column; height:auto; }
    .mc-bottom-panel { min-height:240px; }
    .mc-charts-col { min-height:260px; }
  }
  @media(max-width:500px){
    .mc-sidebar { flex-direction:column; }
    .mc-card { flex:unset; }
    .mc-top,.mc-bottom-row,.mc-table-section { padding-left:8px; padding-right:8px; }
  }
  /* body scrollbar */
  .mc-body::-webkit-scrollbar { width:4px; }
  .mc-body::-webkit-scrollbar-track { background:transparent; }
  .mc-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const Skel: React.FC<{ h?: number; mb?: number }> = ({ h = 16, mb = 6 }) => (
  <div className="mc-skel" style={{ height: h, marginBottom: mb }} />
);

const Toggle: React.FC<{ value: Range; onChange: (v: Range) => void }> = ({ value, onChange }) => (
  <div className="mc-tog">
    {(['30d','1y','all'] as Range[]).map(opt => (
      <button key={opt} className={`mc-tbtn ${value === opt ? 'on' : 'off'}`}
        onClick={() => onChange(opt)}>
        {opt === 'all' ? 'All' : opt}
      </button>
    ))}
  </div>
);

// ── Log-scale y converter ─────────────────────────────────────────────────────
function logY(price: number, minLog: number, maxLog: number, ch: number, top: number): number {
  if (price <= 0) return top + ch;
  const logP = Math.log10(price);
  const frac  = (logP - minLog) / (maxLog - minLog);
  return top + ch - frac * ch;
}

// ── Generic canvas chart ──────────────────────────────────────────────────────
interface LineSpec { values: (number | null)[]; color: string; width?: number; dash?: number[] }
interface ZoneSpec { values: number[]; color: string } // fill between index and index+1

function useCanvasChart(
  containerRef: React.RefObject<HTMLDivElement | null>,
  draw: () => void
) {
  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw, containerRef]);
}

// ── Puell Multiple Chart ──────────────────────────────────────────────────────
const PuellChart: React.FC<{
  dates: string[]; prices: number[]; puell: (number | null)[]; range: Range;
  halvings?: { date: string; label: string }[];
}> = ({ dates, prices, puell, range, halvings }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tipIdx, setTipIdx] = useState<number | null>(null);

  const slDates  = sliceDates(dates, range);
  const slPrices = sliceRange(prices, range, prices.length) as number[];
  const slPuell  = sliceRange(puell, range, puell.length) as (number | null)[];
  const n = slDates.length;

  const draw = useCallback(() => {
    const canvas = canvasRef.current; const cont = containerRef.current;
    if (!canvas || !cont || n < 2) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;
    const W = cont.clientWidth; const H = cont.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR);
    ctx.clearRect(0, 0, W, H);

    const PAD = { top: 14, right: 46, bottom: 26, left: 8 };
    const cw = W - PAD.left - PAD.right;
    const ch = H - PAD.top  - PAD.bottom;

    // Price log scale
    const validP = slPrices.filter(p => p > 0);
    const minLogP = Math.log10(Math.min(...validP) * 0.8);
    const maxLogP = Math.log10(Math.max(...validP) * 1.2);
    const toX  = (i: number) => PAD.left + (i / (n - 1)) * cw;
    const toYP = (p: number) => logY(p, minLogP, maxLogP, ch, PAD.top);

    // Puell scale
    const validPuell = slPuell.filter(v => v !== null) as number[];
    const maxPuell   = Math.max(...validPuell, 2.5);
    const toYPuell   = (v: number) => PAD.top + ch - (v / maxPuell) * ch;

    // Undervalued zone (Puell < 0.5) – green
    ctx.fillStyle = 'rgba(34,197,94,0.12)';
    ctx.fillRect(PAD.left, toYPuell(0.5), cw, ch - (toYPuell(0.5) - PAD.top));

    // Overvalued zone (Puell > 2) – red
    ctx.fillStyle = 'rgba(239,68,68,0.12)';
    ctx.fillRect(PAD.left, PAD.top, cw, toYPuell(2) - PAD.top);

    // Grid + right labels (Puell)
    const fsz = Math.max(8, Math.min(10, W / 65));
    [0.2, 0.5, 1, 2, 4, 10, 20].forEach(v => {
      const y = toYPuell(v);
      if (y < PAD.top || y > PAD.top + ch) return;
      ctx.setLineDash([3, 6]); ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(200,220,255,0.4)'; ctx.font = `${fsz}px monospace`;
      ctx.textAlign = 'left'; ctx.fillText(String(v), W - PAD.right + 3, y + 3);
    });

    // Price log grid (left)
    [0.01,0.1,1,10,100,1000,10000,100000,1000000].forEach(p => {
      const y = toYP(p);
      if (y < PAD.top || y > PAD.top + ch) return;
      ctx.fillStyle = 'rgba(180,200,240,0.3)'; ctx.font = `${fsz}px monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(fmtPx(p), PAD.left - 2, y + 3);
    });

    // X labels
    const xN = Math.max(2, Math.min(8, Math.floor(W / 80)));
    ctx.fillStyle = 'rgba(180,200,240,0.3)'; ctx.font = `${fsz}px monospace`; ctx.textAlign = 'center';
    for (let i = 0; i < xN; i++) {
      const idx = Math.floor((i / (xN - 1)) * (n - 1));
      const d   = new Date(slDates[idx]);
      ctx.fillText('Jan ' + d.getFullYear(), toX(idx), H - 4);
    }

    // Puell area fill
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const v = slPuell[i]; if (v === null) continue;
      const x = toX(i); const y = toYPuell(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineTo(toX(n - 1), PAD.top + ch); ctx.lineTo(PAD.left, PAD.top + ch);
    ctx.closePath();
    const puellGrad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + ch);
    puellGrad.addColorStop(0, 'rgba(59,130,246,0.3)');
    puellGrad.addColorStop(1, 'rgba(59,130,246,0.03)');
    ctx.fillStyle = puellGrad; ctx.fill();

    // Puell line (blue)
    ctx.beginPath(); let first = true;
    for (let i = 0; i < n; i++) {
      const v = slPuell[i]; if (v === null) { first = true; continue; }
      const x = toX(i); const y = toYPuell(v);
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5; ctx.stroke();

    // BTC price line (white)
    ctx.beginPath(); first = true;
    for (let i = 0; i < n; i++) {
      const p = slPrices[i]; if (!p) { first = true; continue; }
      const x = toX(i); const y = toYP(p);
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(220,230,255,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();

    // Zone labels
    ctx.fillStyle = 'rgba(34,197,94,0.55)'; ctx.font = `${fsz}px monospace`; ctx.textAlign = 'right';
    ctx.fillText('Undervalued', W - PAD.right - 4, toYPuell(0.4) - 3);
    ctx.fillStyle = 'rgba(239,68,68,0.55)';
    ctx.fillText('Overvalued', W - PAD.right - 4, toYPuell(2.5));

    // Crosshair
    if (tipIdx !== null) {
      const tx = toX(tipIdx);
      ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, PAD.top); ctx.lineTo(tx, PAD.top + ch); ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [slDates, slPrices, slPuell, n, tipIdx]);

  useCanvasChart(containerRef, draw);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current; if (!c || n < 2) return;
    const r = c.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const cw = c.clientWidth - 8 - 46;
    setTipIdx(Math.max(0, Math.min(n - 1, Math.round((mx - 8) / cw * (n - 1)))));
  };

  const tipD = tipIdx !== null ? {
    date: slDates[tipIdx], price: slPrices[tipIdx], puell: slPuell[tipIdx],
  } : null;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => setTipIdx(null)} />
      {tipD && (
        <div style={{
          position: 'absolute',
          left: (tipIdx! / (n - 1)) > 0.6 ? undefined : `${(tipIdx! / (n - 1)) * 100}%`,
          right: (tipIdx! / (n - 1)) > 0.6 ? '60px' : undefined,
          top: 16,
          background: 'rgba(5,10,28,0.97)', border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: 6, padding: '8px 12px', fontSize: 10,
          color: '#a8c0f0', pointerEvents: 'none', zIndex: 20,
          fontFamily: 'monospace', minWidth: 180,
        }}>
          <div style={{ color: 'rgba(180,200,255,0.5)', marginBottom: 5, borderBottom: '1px solid rgba(59,130,246,0.1)', paddingBottom: 4 }}>
            {new Date(tipD.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ color: 'rgba(200,220,255,0.6)' }}>BTC Price:</span>
            <span style={{ color: '#fff', fontWeight: 700 }}>{fmtP(tipD.price)}</span>
          </div>
          {tipD.puell !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(59,130,246,0.7)' }}>Puell Multiple:</span>
              <span style={{ color: '#93c5fd', fontWeight: 700 }}>{tipD.puell.toFixed(3)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Pi Cycle Chart ────────────────────────────────────────────────────────────
const PiChart: React.FC<{
  dates: string[]; prices: number[];
  dma111: (number | null)[]; dma350x2: (number | null)[];
  range: Range;
}> = ({ dates, prices, dma111, dma350x2, range }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tipIdx, setTipIdx] = useState<number | null>(null);

  const slDates  = sliceDates(dates, range);
  const slP      = sliceRange(prices, range, prices.length) as number[];
  const sl111    = sliceRange(dma111, range, dma111.length) as (number | null)[];
  const sl350x2  = sliceRange(dma350x2, range, dma350x2.length) as (number | null)[];
  const n = slDates.length;

  const draw = useCallback(() => {
    const canvas = canvasRef.current; const cont = containerRef.current;
    if (!canvas || !cont || n < 2) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;
    const W = cont.clientWidth; const H = cont.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR); ctx.clearRect(0, 0, W, H);

    const PAD = { top: 14, right: 46, bottom: 26, left: 8 };
    const cw = W - PAD.left - PAD.right;
    const ch = H - PAD.top  - PAD.bottom;

    const allVals = [...slP.filter(p => p > 0),
      ...(sl111.filter(v => v !== null) as number[]),
      ...(sl350x2.filter(v => v !== null) as number[])];
    const minLog = Math.log10(Math.min(...allVals) * 0.8);
    const maxLog = Math.log10(Math.max(...allVals) * 1.2);
    const toX  = (i: number) => PAD.left + (i / (n - 1)) * cw;
    const toYL = (p: number) => logY(p, minLog, maxLog, ch, PAD.top);

    const fsz = Math.max(8, Math.min(10, W / 65));
    // Price log grid
    [0.01,0.1,1,10,100,1000,10000,100000,1000000].forEach(p => {
      const y = toYL(p);
      if (y < PAD.top || y > PAD.top + ch) return;
      ctx.setLineDash([3, 6]); ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(180,200,240,0.35)'; ctx.font = `${fsz}px monospace`;
      ctx.textAlign = 'left'; ctx.fillText(fmtPx(p), W - PAD.right + 3, y + 3);
    });

    // X labels
    const xN = Math.max(2, Math.min(7, Math.floor(W / 80)));
    ctx.fillStyle = 'rgba(180,200,240,0.3)'; ctx.font = `${fsz}px monospace`; ctx.textAlign = 'center';
    for (let i = 0; i < xN; i++) {
      const idx = Math.floor((i / (xN - 1)) * (n - 1));
      ctx.fillText('Jan ' + new Date(slDates[idx]).getFullYear(), toX(idx), H - 4);
    }

    // Lines helper
    const drawLine = (vals: (number | null)[], color: string, width = 1.4, dash: number[] = []) => {
      ctx.beginPath(); let first = true; ctx.setLineDash(dash);
      for (let i = 0; i < n; i++) {
        const v = vals[i]; if (!v) { first = true; continue; }
        const x = toX(i); const y = toYL(v);
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.setLineDash([]);
    };

    drawLine(slP,     'rgba(220,230,255,0.55)', 1.2);
    drawLine(sl350x2, '#22c55e', 1.6);
    drawLine(sl111,   '#3b82f6', 1.6);

    if (tipIdx !== null) {
      const tx = toX(tipIdx);
      ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, PAD.top); ctx.lineTo(tx, PAD.top + ch); ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [slDates, slP, sl111, sl350x2, n, tipIdx]);

  useCanvasChart(containerRef, draw);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current; if (!c || n < 2) return;
    const r = c.getBoundingClientRect();
    const cw = c.clientWidth - 8 - 46;
    setTipIdx(Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left - 8) / cw * (n - 1)))));
  };

  const tipD = tipIdx !== null ? {
    date: slDates[tipIdx], price: slP[tipIdx],
    dma111: sl111[tipIdx], dma350x2: sl350x2[tipIdx],
  } : null;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => setTipIdx(null)} />
      {tipD && (
        <div style={{
          position: 'absolute',
          left: (tipIdx! / (n - 1)) > 0.6 ? undefined : `${(tipIdx! / (n - 1)) * 100}%`,
          right: (tipIdx! / (n - 1)) > 0.6 ? '60px' : undefined,
          top: 16, background: 'rgba(5,10,28,0.97)',
          border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6,
          padding: '8px 12px', fontSize: 10, color: '#a8c0f0',
          pointerEvents: 'none', zIndex: 20, fontFamily: 'monospace', minWidth: 195,
        }}>
          <div style={{ color: 'rgba(180,200,255,0.5)', marginBottom: 5, borderBottom: '1px solid rgba(59,130,246,0.1)', paddingBottom: 4 }}>
            {new Date(tipD.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          {[
            { label: 'BTC Price:', val: tipD.price ? fmtP(tipD.price) : '—', color: 'rgba(220,230,255,0.7)' },
            { label: '111 DMA:', val: tipD.dma111 ? fmtP(tipD.dma111) : '—', color: '#3b82f6' },
            { label: '350DMA×2:', val: tipD.dma350x2 ? fmtP(tipD.dma350x2) : '—', color: '#22c55e' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color }}>{label}</span>
              <span style={{ color: '#fff', fontWeight: 700 }}>{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Rainbow Chart ─────────────────────────────────────────────────────────────
const RainbowChart: React.FC<{
  dates: string[]; prices: number[];
  rainbow: RainbowBand[];
  halvings: { date: string; label: string }[];
  range: Range;
}> = ({ dates, prices, rainbow, halvings, range }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tipIdx, setTipIdx] = useState<number | null>(null);

  const slDates  = sliceDates(dates, range);
  const slP      = sliceRange(prices, range, prices.length) as number[];
  const slRainbow = rainbow.map(b => ({ ...b, values: sliceRange(b.values, range, b.values.length) as number[] }));
  const n = slDates.length;

  const draw = useCallback(() => {
    const canvas = canvasRef.current; const cont = containerRef.current;
    if (!canvas || !cont || n < 2 || rainbow.length === 0) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;
    const W = cont.clientWidth; const H = cont.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR); ctx.clearRect(0, 0, W, H);

    const PAD = { top: 14, right: 52, bottom: 26, left: 8 };
    const cw = W - PAD.left - PAD.right;
    const ch = H - PAD.top  - PAD.bottom;

    // Determine price range from rainbow bands + price
    const allVals = slP.filter(p => p > 0);
    slRainbow.forEach(b => allVals.push(...b.values.filter(v => v > 0)));
    if (!allVals.length) return;
    const minLog = Math.log10(Math.min(...allVals) * 0.7);
    const maxLog = Math.log10(Math.max(...allVals) * 1.3);
    const toX  = (i: number) => PAD.left + (i / (n - 1)) * cw;
    const toYL = (p: number) => logY(p, minLog, maxLog, ch, PAD.top);

    // Draw rainbow bands (bottom to top)
    for (let b = slRainbow.length - 1; b >= 0; b--) {
      const band = slRainbow[b];
      const nextBand = slRainbow[b - 1];
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const y = toYL(band.values[i]);
        i === 0 ? ctx.moveTo(toX(i), y) : ctx.lineTo(toX(i), y);
      }
      if (nextBand) {
        for (let i = n - 1; i >= 0; i--) ctx.lineTo(toX(i), toYL(nextBand.values[i]));
      } else {
        ctx.lineTo(toX(n - 1), PAD.top + ch); ctx.lineTo(PAD.left, PAD.top + ch);
      }
      ctx.closePath();
      ctx.fillStyle = band.color.replace('0.7', '0.65'); ctx.fill();
    }

    // Grid
    const fsz = Math.max(8, Math.min(10, W / 65));
    [0.01,0.1,1,10,100,1000,10000,100000,1000000].forEach(p => {
      const y = toYL(p);
      if (y < PAD.top || y > PAD.top + ch) return;
      ctx.setLineDash([3, 6]); ctx.lineWidth = 0.4; ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(200,220,255,0.4)'; ctx.font = `${fsz}px monospace`;
      ctx.textAlign = 'left'; ctx.fillText(fmtPx(p), W - PAD.right + 3, y + 3);
    });

    // Halving markers
    halvings.forEach(hv => {
      const hvDate = hv.date;
      const idx = slDates.findIndex(d => d >= hvDate);
      if (idx < 0) return;
      const tx = toX(idx);
      ctx.strokeStyle = 'rgba(200,200,200,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(tx, PAD.top); ctx.lineTo(tx, PAD.top + ch); ctx.stroke();
      ctx.setLineDash([]);
      // Label pill
      ctx.fillStyle = 'rgba(40,50,70,0.85)';
      const lw = ctx.measureText(hv.label).width + 10;
      ctx.beginPath(); ctx.roundRect(tx - lw / 2, PAD.top + ch - 16, lw, 14, 3); ctx.fill();
      ctx.fillStyle = 'rgba(200,220,255,0.6)'; ctx.font = `${Math.max(7, fsz - 1)}px monospace`;
      ctx.textAlign = 'center'; ctx.fillText(hv.label, tx, PAD.top + ch - 5);
    });

    // X labels
    const xN = Math.max(2, Math.min(7, Math.floor(W / 80)));
    ctx.fillStyle = 'rgba(180,200,240,0.3)'; ctx.font = `${fsz}px monospace`; ctx.textAlign = 'center';
    for (let i = 0; i < xN; i++) {
      const idx = Math.floor((i / (xN - 1)) * (n - 1));
      ctx.fillText('01 Jan ' + new Date(slDates[idx]).getFullYear(), toX(idx), H - 4);
    }

    // BTC Price line (white)
    ctx.beginPath(); let first = true;
    for (let i = 0; i < n; i++) {
      const p = slP[i]; if (!p) { first = true; continue; }
      if (first) { ctx.moveTo(toX(i), toYL(p)); first = false; } else ctx.lineTo(toX(i), toYL(p));
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();

    if (tipIdx !== null) {
      const tx = toX(tipIdx);
      ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, PAD.top); ctx.lineTo(tx, PAD.top + ch); ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [slDates, slP, slRainbow, n, halvings, tipIdx]);

  useCanvasChart(containerRef, draw);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current; if (!c || n < 2) return;
    const r = c.getBoundingClientRect();
    const cw = c.clientWidth - 8 - 52;
    setTipIdx(Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left - 8) / cw * (n - 1)))));
  };

  const tipD = tipIdx !== null ? {
    date: slDates[tipIdx], price: slP[tipIdx],
    bandIdx: slRainbow.findIndex((b, bi) =>
      slP[tipIdx] >= (b.values[tipIdx] ?? 0) &&
      (bi === 0 || slP[tipIdx] < (slRainbow[bi - 1].values[tipIdx] ?? Infinity))
    ),
  } : null;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => setTipIdx(null)} />
      {tipD && (
        <div style={{
          position: 'absolute',
          left: (tipIdx! / (n - 1)) > 0.65 ? undefined : `${(tipIdx! / (n - 1)) * 100}%`,
          right: (tipIdx! / (n - 1)) > 0.65 ? '60px' : undefined,
          top: 16, background: 'rgba(5,10,28,0.97)',
          border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6,
          padding: '8px 12px', fontSize: 10, color: '#a8c0f0',
          pointerEvents: 'none', zIndex: 20, fontFamily: 'monospace', minWidth: 180,
        }}>
          <div style={{ color: 'rgba(180,200,255,0.5)', marginBottom: 5, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 4 }}>
            {new Date(tipD.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: 'rgba(220,230,255,0.6)' }}>BTC Price:</span>
            <span style={{ color: '#fff', fontWeight: 700 }}>{fmtP(tipD.price)}</span>
          </div>
          {tipD.bandIdx >= 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(200,220,255,0.6)' }}>Zone:</span>
              <span style={{ color: rainbow[tipD.bandIdx]?.color.replace('0.7)', '1)') ?? '#fff', fontWeight: 700, maxWidth: 120, textAlign: 'right' }}>
                {rainbow[tipD.bandIdx]?.name ?? '—'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Indicator table ───────────────────────────────────────────────────────────
const IndicatorTable: React.FC<{ indicators: Indicator[] }> = ({ indicators }) => (
  <table className="mc-table">
    <thead>
      <tr>
        <th style={{ width: 32 }}>#</th>
        <th>Indicator</th>
        <th>Current</th>
        <th>24h %</th>
        <th>Reference</th>
        <th>Triggered</th>
      </tr>
    </thead>
    <tbody>
      {indicators.map(ind => (
        <tr key={ind.id}>
          <td style={{ color: 'rgba(180,210,255,0.4)', fontSize: 11 }}>{ind.id}</td>
          <td style={{ fontWeight: 700, color: '#e2f0ff', display: 'flex', alignItems: 'center', gap: 5 }}>
            {ind.name}
            <span className="mc-info-icon">ⓘ</span>
          </td>
          <td style={{ color: '#e2f0ff' }}>{ind.current}</td>
          <td style={{ color: ind.change24h >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
            {ind.change24h >= 0 ? '▲' : '▼'} {Math.abs(ind.change24h).toFixed(2)}%
          </td>
          <td style={{ color: 'rgba(180,210,255,0.5)' }}>{ind.reference}</td>
          <td style={{ textAlign: 'center' }}>
            {ind.triggered
              ? <span style={{ color: '#22c55e', fontSize: 14 }}>✓</span>
              : <span style={{ color: '#ef4444', fontSize: 14 }}>✗</span>
            }
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const MarketCycleTab: React.FC = () => {
  const [data,    setData]    = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [updated, setUpdated] = useState('');
  const [puellRange,   setPuellRange]   = useState<Range>('all');
  const [piRange,      setPiRange]      = useState<Range>('all');
  const [rainbowRange, setRainbowRange] = useState<Range>('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res  = await fetch('/api/market-cycle?days=max');
      const json: ApiData = await res.json();
      if (!json.success) throw new Error(json.error ?? 'API error');
      setData(json);
      setUpdated(new Date().toLocaleTimeString());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(fetchData, 3_600_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const c = data?.chart;

  // Puell slider position (0–100 based on value 0–5)
  const puellSliderPct = data?.currentPuell !== null && data?.currentPuell !== undefined
    ? Math.min(100, (data.currentPuell / 4) * 100)
    : 50;

  return (
    <>
      <style>{CSS}</style>
      <div className="mc-root">

        {/* Header */}
        <div className="mc-hdr">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#e2f0ff' }}>Crypto Market Cycle Indicators</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {data && <span style={{ fontSize: 9, color: 'rgba(200,220,255,0.35)', lineHeight: 1.6 }}>
                {data.source}<br />Updated: {updated}
              </span>}
              <button onClick={fetchData} disabled={loading} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#c8d8f0', padding: '3px 10px', fontSize: 10,
                cursor: loading ? 'default' : 'pointer', borderRadius: 3,
                fontFamily: 'monospace', opacity: loading ? 0.5 : 1,
              }}>{loading ? '↻ Loading…' : '↺ Refresh'}</button>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(200,220,255,0.3)', marginTop: 4, lineHeight: 1.5 }}>
            Does the Bitcoin 4-year cycle exist? Discover crypto market cycle indicators to help spot the top of a bull run.
            This is a collection of publicly available signals including Pi Cycle and Puell Multiple. No guarantee these signals
            will accurately call market movements. Please DYOR!
          </div>
        </div>

        {error && (
          <div style={{ margin: '6px 16px 0', background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5',
            padding: '6px 12px', borderRadius: 5, fontSize: 11, flexShrink: 0 }}>
            ⚠ {error}
          </div>
        )}

        <div className="mc-body">
          {/* Top row */}
          <div className="mc-top">

            {/* Sidebar */}
            <div className="mc-sidebar">

              {/* Puell Status */}
              <div className="mc-card">
                <div className="mc-card-title">Puell Multiple Status <span className="mc-info-icon">ⓘ</span></div>
                {loading && !data ? <><Skel h={32} /><Skel h={8} mb={4} /><Skel h={18} /></>
                : data ? (
                  <>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#e2f0ff', lineHeight: 1 }}>
                      {data.currentPuell !== null ? data.currentPuell.toFixed(4) : '—'}
                    </div>
                    <div className="mc-slider-track" style={{ marginTop: 10 }}>
                      <div className="mc-slider-dot" style={{ left: `${puellSliderPct}%` }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(200,220,255,0.35)' }}>
                      <span>Undervalued</span><span>Overvalued</span>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Pi Cycle Status */}
              <div className="mc-card">
                <div className="mc-card-title">Pi Cycle Top Status <span className="mc-info-icon">ⓘ</span></div>
                {loading && !data ? <><Skel h={22} /><Skel h={22} /></>
                : data ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'center' }}>
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 5, padding: '6px 8px' }}>
                        <div style={{ fontSize: 9, color: 'rgba(200,220,255,0.35)', marginBottom: 2 }}>111DMA</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2f0ff' }}>
                          {data.current111DMA !== null ? fmtP(data.current111DMA) : '—'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 9, color: 'rgba(200,220,255,0.35)' }}>
                        {data.piCycleCrossed ? <span style={{ color: '#ef4444' }}>⚠ Crossed</span> : <><div>⊘</div><div>Didn't</div><div>cross</div></>}
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 5, padding: '6px 8px' }}>
                        <div style={{ fontSize: 9, color: 'rgba(200,220,255,0.35)', marginBottom: 2 }}>350DMA x2</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2f0ff' }}>
                          {data.current350DMAx2 !== null ? fmtP(data.current350DMAx2) : '—'}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Top Indicators status */}
              <div className="mc-card" style={{ flex: 1 }}>
                <div className="mc-card-title">Crypto Market Cycle Top Indicators <span className="mc-info-icon">ⓘ</span></div>
                {loading && !data ? <><Skel h={28} /><Skel h={8} mb={4} /><Skel h={18} /></>
                : data ? (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#e2f0ff', lineHeight: 1 }}>
                      {data.pct}%
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(200,220,255,0.4)', marginTop: 3, marginBottom: 8 }}>
                      Hit: {data.hitCount}/{data.totalCount}
                    </div>
                    <div className="mc-slider-track" style={{
                      background: 'linear-gradient(to right,#22c55e,#eab308 50%,#ef4444)',
                    }}>
                      <div className="mc-slider-dot" style={{ left: `${data.pct}%` }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(200,220,255,0.35)' }}>
                      <span>Hold</span><span>Sell</span>
                    </div>
                  </>
                ) : null}
              </div>

            </div>

            {/* Puell Multiple Chart */}
            <div className="mc-charts-col">
              <div className="mc-chart-panel" style={{ flex: 1, minHeight: 0 }}>
                <div className="mc-ch-hdr">
                  <div className="mc-ch-title">Puell Multiple <span className="mc-info-icon">ⓘ</span></div>
                  <Toggle value={puellRange} onChange={setPuellRange} />
                </div>
                <div className="mc-legend">
                  {[
                    { color: '#3b82f6', label: 'Puell Multiple' },
                    { color: '#22c55e', label: 'Undervalued' },
                    { color: '#ef4444', label: 'Overvalued' },
                    { color: 'rgba(220,230,255,0.6)', label: 'Bitcoin Price' },
                  ].map(({ color, label }) => (
                    <div key={label} className="mc-leg-item">
                      <span className="mc-leg-dot" style={{ background: color }} />
                      {label}
                    </div>
                  ))}
                </div>
                <div className="mc-chart-area">
                  {loading && !c?.dates?.length
                    ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(200,220,255,0.3)', fontSize: 12 }}>Loading chart data…</div>
                    : c?.dates?.length
                      ? <PuellChart dates={c.dates} prices={c.prices} puell={c.puell} range={puellRange} halvings={data?.halvings} />
                      : null
                  }
                </div>
              </div>
            </div>

          </div>

          {/* Bottom charts row */}
          <div className="mc-bottom-row">

            {/* Pi Cycle */}
            <div className="mc-bottom-panel mc-chart-panel">
              <div className="mc-ch-hdr">
                <div className="mc-ch-title">Pi Cycle Top Indicator <span className="mc-info-icon">ⓘ</span></div>
                <Toggle value={piRange} onChange={setPiRange} />
              </div>
              <div className="mc-legend">
                {[
                  { color: '#3b82f6', label: '111DMA' },
                  { color: '#22c55e', label: '350DMA x2' },
                  { color: 'rgba(220,230,255,0.6)', label: 'Bitcoin Price' },
                ].map(({ color, label }) => (
                  <div key={label} className="mc-leg-item">
                    <span className="mc-leg-dot" style={{ background: color }} />
                    {label}
                  </div>
                ))}
              </div>
              <div className="mc-chart-area">
                {loading && !c?.dates?.length
                  ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(200,220,255,0.3)', fontSize: 12 }}>Loading…</div>
                  : c?.dates?.length
                    ? <PiChart dates={c.dates} prices={c.prices} dma111={c.dma111} dma350x2={c.dma350x2} range={piRange} />
                    : null
                }
              </div>
            </div>

            {/* Rainbow */}
            <div className="mc-bottom-panel mc-chart-panel">
              <div className="mc-ch-hdr">
                <div className="mc-ch-title">Bitcoin Rainbow Price Chart Indicator <span className="mc-info-icon">ⓘ</span></div>
                <Toggle value={rainbowRange} onChange={setRainbowRange} />
              </div>
              <div className="mc-legend">
                {(data?.chart?.rainbow ?? []).slice(0, 5).map(b => (
                  <div key={b.name} className="mc-leg-item">
                    <span className="mc-leg-dot" style={{ background: b.color.replace('0.7', '1') }} />
                    <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</span>
                  </div>
                ))}
              </div>
              <div className="mc-chart-area">
                {loading && !c?.dates?.length
                  ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(200,220,255,0.3)', fontSize: 12 }}>Loading…</div>
                  : c?.dates?.length && c?.rainbow?.length
                    ? <RainbowChart dates={c.dates} prices={c.prices} rainbow={c.rainbow}
                        halvings={data?.halvings ?? []} range={rainbowRange} />
                    : null
                }
              </div>
            </div>

          </div>

          {/* Indicator table */}
          <div className="mc-table-section">
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2f0ff', marginBottom: 10 }}>
              Crypto Market Cycle Top Indicators
            </div>
            {loading && !data?.indicators?.length
              ? Array.from({ length: 5 }, (_, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                    <Skel h={20} mb={0} /><Skel h={20} mb={0} /><Skel h={20} mb={0} />
                  </div>
                ))
              : data?.indicators?.length
                ? <IndicatorTable indicators={data.indicators} />
                : null
            }
          </div>

        </div>
      </div>
    </>
  );
};

export default MarketCycleTab;