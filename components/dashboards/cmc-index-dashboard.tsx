'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Constituent {
  rank: number; id: string; name: string; symbol: string;
  price: number; change24h: number; marketCap: number; weight: number; image: string;
}
interface HistoryPoint { timestamp: number; date: string; value: number }
interface IndexData {
  success: boolean;
  index: number;
  value: number;
  change24h: number;
  totalMarketCap: number;
  constituentCount: number;
  constituents: Constituent[];
  methodology: string;
  source: string;
  updatedAt: string;
  error?: string;
}
interface HistoryData {
  success: boolean;
  history: HistoryPoint[];
  error?: string;
}

type TabType       = 'index' | 'weights';
type TimeframeType = '24H' | '7D' | '30D' | '1Y';
type IndexType     = '20' | '100' | 'both';

// ── Constants ──────────────────────────────────────────────────────────────────
const TF_DAYS: Record<TimeframeType, number> = { '24H': 1, '7D': 7, '30D': 30, '1Y': 365 };

const COIN_COLORS: Record<string, string> = {
  BTC: '#f7931a', ETH: '#627eea', BNB: '#f0b90b', XRP: '#346aa9',
  SOL: '#9945ff', TRX: '#e50915', DOGE: '#c2a633', ADA: '#0033ad',
  BCH: '#8dc351', HYPE: '#00c2ff', LINK: '#2a5ada', AVAX: '#e84142',
  SUI: '#4da2ff', XLM: '#14b6e7', SHIB: '#ff9500', LTC: '#bfbbbb',
  DOT: '#e6007a', UNI: '#ff007a', NEAR: '#00c08b', ICP: '#29abe2',
};
const fallbackColor = '#6b7280';
function coinColor(sym: string) { return COIN_COLORS[sym] ?? fallbackColor; }

// ── Helpers ────────────────────────────────────────────────────────────────────
const p2 = (n: number) => n.toFixed(2) + '%';

function fmtMcap(n: number) {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(1)  + 'B';
  return '$' + (n / 1e6).toFixed(0) + 'M';
}

// ── CSS — matched to BtcDominanceTab ──────────────────────────────────────────
const CSS = `
  .cmci-root {
    display:flex; flex-direction:column; height:100%;
    background:#0a0f1e;
    font-family:"IBM Plex Mono","Courier New",monospace;
    color:#c8d8f4; overflow:hidden; box-sizing:border-box;
  }
  .cmci-hdr { padding:11px 16px 8px; flex-shrink:0; border-bottom:1px solid rgba(255,255,255,0.06); }
  .cmci-hrow { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px; }
  .cmci-body { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; display:flex; flex-direction:column; }
  .cmci-body::-webkit-scrollbar { width:4px; }
  .cmci-body::-webkit-scrollbar-track { background:transparent; }
  .cmci-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }

  /* Index selector */
  .cmci-idx-grp { display:flex; gap:2px; background:rgba(255,255,255,0.03);
    border:1px solid rgba(255,255,255,0.08); border-radius:5px; padding:2px; }
  .cmci-idx-btn {
    border-radius:3px; font-family:"IBM Plex Mono",monospace; font-size:10px;
    cursor:pointer; padding:3px 12px; transition:all .15s; line-height:1.6; border:none;
  }
  .cmci-idx-btn.on  { background:rgba(247,147,26,0.2); color:#f7931a; }
  .cmci-idx-btn.off { background:transparent; color:rgba(200,220,255,0.3); }
  .cmci-idx-btn.off:hover { color:rgba(200,220,255,0.6); }

  /* Main layout — two panels side by side or stacked */
  .cmci-panels { display:flex; gap:10px; padding:10px 16px; flex-shrink:0; }
  .cmci-panels.single { flex-direction:column; }
  .cmci-panels.dual   { flex-direction:row; }

  .cmci-panel {
    flex:1; min-width:0; display:flex; gap:10px;
    background:transparent;
  }
  .cmci-panel.column { flex-direction:column; }

  /* Sidebar */
  .cmci-sidebar {
    width:240px; flex-shrink:0;
    display:flex; flex-direction:column; gap:8px;
    overflow-y:auto; overflow-x:hidden;
  }
  .cmci-card {
    background:rgba(255,255,255,0.025);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; padding:12px 14px;
  }
  .cmci-card-title {
    font-size:11px; font-weight:700; color:rgba(200,220,255,0.55);
    text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px;
  }

  /* Value display */
  .cmci-val      { font-size:26px; font-weight:900; line-height:1; margin-bottom:2px; }
  .cmci-chg      { font-size:11px; font-weight:700; }
  .cmci-stat-row { display:flex; justify-content:space-between; align-items:center;
    padding:5px 0; border-bottom:1px solid rgba(255,255,255,0.05); }
  .cmci-stat-row:last-child { border-bottom:none; }
  .cmci-stat-label { font-size:10px; color:rgba(180,210,255,0.5); }
  .cmci-stat-val   { font-size:11px; color:#e2f0ff; font-weight:700; }

  /* Pill badge — same as BtcDominancTab */
  .cmci-pill {
    display:inline-flex; align-items:center; gap:4px;
    padding:2px 7px; border-radius:4px; font-size:10px; font-weight:700;
    background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
  }

  /* Stacked weight bar */
  .cmci-bar-track { height:7px; border-radius:4px; display:flex; overflow:hidden; margin-top:8px; }

  /* Chart panel */
  .cmci-chart-panel {
    flex:1; min-width:0; height:380px;
    display:flex; flex-direction:column;
    background:rgba(255,255,255,0.02);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; overflow:hidden;
  }
  .cmci-ch-hdr {
    padding:9px 14px; display:flex; justify-content:space-between; align-items:center;
    border-bottom:1px solid rgba(255,255,255,0.05); flex-wrap:wrap; gap:6px; flex-shrink:0;
  }
  .cmci-ch-title { font-size:13px; font-weight:700; color:#e2f0ff; }
  .cmci-legend { display:flex; gap:12px; padding:5px 14px; flex-shrink:0; flex-wrap:wrap;
    border-bottom:1px solid rgba(255,255,255,0.04); }
  .cmci-leg-item { display:flex; align-items:center; gap:4px; font-size:10px; color:rgba(180,210,255,0.5); }
  .cmci-leg-dot  { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .cmci-chart-area { flex:1; min-height:0; min-width:0; position:relative; overflow:hidden; }
  .cmci-chart-area > div { position:absolute; inset:0; width:100%; height:100%; }

  /* Tab toggle — same look as view toggle in BtcDominanceTab */
  .cmci-tab-grp { display:flex; gap:2px; }
  .cmci-tbtn {
    border-radius:3px; font-family:"IBM Plex Mono",monospace; font-size:10px;
    cursor:pointer; padding:2px 9px; transition:all .15s; line-height:1.6;
  }
  .cmci-tbtn.on  { background:rgba(247,147,26,0.22); border:1px solid rgba(247,147,26,0.5); color:#f7931a; }
  .cmci-tbtn.off { background:transparent; border:1px solid rgba(255,255,255,0.1); color:rgba(200,220,255,0.3); }
  .cmci-tbtn.off:hover { border-color:rgba(255,255,255,0.2); color:rgba(200,220,255,0.6); }

  /* Range toggle */
  .cmci-rng-grp { display:flex; gap:2px; }
  .cmci-rbtn {
    border-radius:3px; font-family:"IBM Plex Mono",monospace; font-size:10px;
    cursor:pointer; padding:2px 8px; transition:all .15s; line-height:1.6;
  }
  .cmci-rbtn.on  { background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); color:#e2f0ff; }
  .cmci-rbtn.off { background:transparent; border:1px solid rgba(255,255,255,0.1); color:rgba(200,220,255,0.3); }
  .cmci-rbtn.off:hover { border-color:rgba(255,255,255,0.22); color:rgba(200,220,255,0.6); }

  /* Skeleton */
  @keyframes cmci-pulse { 0%,100%{opacity:.35} 50%{opacity:.12} }
  .cmci-skel { background:rgba(255,255,255,0.08); border-radius:4px; animation:cmci-pulse 1.4s ease-in-out infinite; }

  /* Table */
  .cmci-table-wrap { padding:0 16px 12px; flex-shrink:0; }
  .cmci-table { width:100%; border-collapse:collapse; font-size:11px; }
  .cmci-table th {
    padding:6px 10px; text-align:left; font-size:10px; font-weight:600;
    color:rgba(180,210,255,0.4); border-bottom:1px solid rgba(255,255,255,0.07); letter-spacing:.04em;
  }
  .cmci-table td { padding:7px 10px; }

  /* Responsive */
  @media(max-width:900px){
    .cmci-panels.dual { flex-direction:column; }
    .cmci-panel { flex-direction:column; }
    .cmci-sidebar { width:100%; flex-direction:row; flex-wrap:wrap; overflow:visible; }
    .cmci-card { flex:1 1 180px; }
    .cmci-chart-panel { height:300px; }
  }
  @media(max-width:500px){
    .cmci-sidebar { flex-direction:column; }
    .cmci-card { flex:unset; }
    .cmci-panels,.cmci-table-wrap { padding-left:8px; padding-right:8px; }
    .cmci-val { font-size:20px; }
  }
`;

// ── Skeleton ───────────────────────────────────────────────────────────────────
const Skel: React.FC<{ h?: number; mb?: number }> = ({ h = 14, mb = 6 }) => (
  <div className="cmci-skel" style={{ height: h, marginBottom: mb }} />
);

// ── Pill ───────────────────────────────────────────────────────────────────────
const Pill: React.FC<{ color: string; label: string; value: number }> = ({ color, label, value }) => (
  <span className="cmci-pill" style={{ borderColor: color + '40', color }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
    {label} {p2(value)}
  </span>
);

// ── Stacked weight bar (top-5 coins + others) ──────────────────────────────────
const WeightBar: React.FC<{ coins: Constituent[] }> = ({ coins }) => {
  const top5 = coins.slice(0, 5);
  const othersW = Math.max(0, 100 - top5.reduce((s, c) => s + c.weight, 0));
  return (
    <div className="cmci-bar-track">
      {top5.map(c => (
        <div key={c.id} style={{ width: `${c.weight}%`, background: coinColor(c.symbol) }} />
      ))}
      <div style={{ width: `${othersW}%`, background: '#374151' }} />
    </div>
  );
};

// ── Line Chart (index history) ─────────────────────────────────────────────────
const LineChart: React.FC<{ data: HistoryPoint[]; accent: string; tf: TimeframeType }> = ({ data, accent, tf }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tipIdx, setTipIdx] = useState<number | null>(null);

  const sliced = tf === '24H' ? data.slice(-1)   : // only 1 day, show all points
                 tf === '7D'  ? data.slice(-7)   :
                 tf === '30D' ? data.slice(-30)  :
                 tf === '1Y'  ? data.slice(-365) : data;
  const n = sliced.length;

  const draw = useCallback(() => {
    const canvas = canvasRef.current; const cont = containerRef.current;
    if (!canvas || !cont || n < 2) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;
    const W = cont.clientWidth; const H = cont.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR); ctx.clearRect(0, 0, W, H);

    const PAD = { top: 14, right: 14, bottom: 28, left: 10 };
    const cw = W - PAD.left - PAD.right;
    const ch = H - PAD.top  - PAD.bottom;
    const vals = sliced.map(d => d.value);
    const min  = Math.min(...vals); const max = Math.max(...vals);
    const range = max - min || 1;

    const toX = (i: number) => PAD.left + (i / (n - 1)) * cw;
    const toY = (v: number) => PAD.top + ch - ((v - min) / range) * ch;
    const fsz  = Math.max(8, Math.min(10, W / 70));

    // Grid
    const gridVals = [min, min + range * 0.5, max];
    gridVals.forEach(v => {
      const y = toY(v);
      ctx.setLineDash([3, 6]); ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.setLineDash([]);
    });

    // X labels
    const xN = Math.max(2, Math.min(6, Math.floor(W / 90)));
    ctx.fillStyle = 'rgba(180,200,240,0.3)'; ctx.font = `${fsz}px monospace`; ctx.textAlign = 'center';
    for (let i = 0; i < xN; i++) {
      const idx = Math.floor((i / (xN - 1)) * (n - 1));
      const d = new Date(sliced[idx].timestamp);
      const lbl = tf === '24H' || tf === '7D'
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : tf === '30D'
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      ctx.fillText(lbl, toX(idx), H - 6);
    }

    // Fill gradient
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + ch);
    grad.addColorStop(0, accent + '55'); grad.addColorStop(1, accent + '00');
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(vals[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(vals[i]));
    ctx.lineTo(toX(n - 1), PAD.top + ch); ctx.lineTo(toX(0), PAD.top + ch);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(vals[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(vals[i]));
    ctx.strokeStyle = accent; ctx.lineWidth = 1.8; ctx.stroke();

    // End badge
    const lx = toX(n - 1); const ly = toY(vals[n - 1]);
    const txt = vals[n - 1].toFixed(1);
    ctx.font = 'bold 10px monospace';
    const bw = ctx.measureText(txt).width + 10;
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.roundRect(lx - bw - 3, ly - 9, bw, 18, 3); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(txt, lx - 3 - bw / 2, ly + 4);

    // Crosshair + dot
    if (tipIdx !== null && sliced[tipIdx]) {
      const tx = toX(tipIdx); const ty = toY(vals[tipIdx]);
      ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, PAD.top); ctx.lineTo(tx, PAD.top + ch); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2);
      ctx.fillStyle = accent; ctx.fill();
      ctx.strokeStyle = '#0a0f1e'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }, [sliced, n, accent, tf, tipIdx]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current; if (!c || n < 2) return;
    const r  = c.getBoundingClientRect();
    const cw = c.clientWidth - 10 - 14;
    setTipIdx(Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left - 10) / cw * (n - 1)))));
  };

  const tipD    = tipIdx !== null ? sliced[tipIdx] : null;
  const tipXPct = tipIdx !== null ? tipIdx / Math.max(n - 1, 1) : 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => setTipIdx(null)} />
      {tipD && (
        <div style={{
          position: 'absolute',
          left: tipXPct > 0.65 ? undefined : `calc(${tipXPct * 100}% + 14px)`,
          right: tipXPct > 0.65 ? '14px' : undefined,
          top: 12,
          background: 'rgba(5,10,28,0.97)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6, padding: '9px 13px', fontSize: 10, color: '#a8c0f0',
          pointerEvents: 'none', zIndex: 20, fontFamily: '"IBM Plex Mono",monospace', minWidth: 160,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}>
          <div style={{ color: 'rgba(200,220,255,0.5)', marginBottom: 5,
            borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 4 }}>
            {new Date(tipD.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ color: 'rgba(180,200,240,0.6)' }}>Index Value</span>
            <span style={{ color: accent, fontWeight: 800 }}>{tipD.value.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Donut (weights) ────────────────────────────────────────────────────────────
const DonutChart: React.FC<{ coins: Constituent[] }> = ({ coins }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovIdx, setHovIdx] = useState<number | null>(null);

  const top7     = coins.slice(0, 7);
  const othersW  = Math.max(0, 100 - top7.reduce((s, c) => s + c.weight, 0));
  const slices   = [
    ...top7.map(c => ({ label: c.symbol, pct: c.weight, color: coinColor(c.symbol) })),
    { label: 'Others', pct: othersW, color: fallbackColor },
  ].filter(s => s.pct > 0.01);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; const cont = containerRef.current;
    if (!canvas || !cont || slices.length === 0) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;
    const W = cont.clientWidth; const H = cont.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR); ctx.clearRect(0, 0, W, H);

    const legendW = Math.min(160, W * 0.36);
    const donutX  = legendW + (W - legendW) / 2;
    const donutY  = H / 2;
    const outerR  = Math.min((W - legendW) / 2, H / 2) * 0.78;
    const innerR  = outerR * 0.58;
    const gap     = 0.013;

    let angle = -Math.PI / 2;
    slices.forEach((s, si) => {
      const sweep = (s.pct / 100) * Math.PI * 2 - gap;
      const isHov = hovIdx === si;
      const ro    = isHov ? outerR * 1.07 : outerR;
      ctx.beginPath();
      ctx.arc(donutX, donutY, ro,     angle, angle + sweep);
      ctx.arc(donutX, donutY, innerR, angle + sweep, angle, true);
      ctx.closePath();
      ctx.fillStyle = isHov ? s.color : s.color + 'cc';
      ctx.fill();
      if (isHov) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
      angle += sweep + gap;
    });

    // Centre label
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (hovIdx !== null && slices[hovIdx]) {
      const s = slices[hovIdx];
      ctx.fillStyle = s.color; ctx.font = 'bold 11px "IBM Plex Mono",monospace';
      ctx.fillText(s.label, donutX, donutY - 9);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 15px "IBM Plex Mono",monospace';
      ctx.fillText(p2(s.pct), donutX, donutY + 9);
    } else {
      ctx.fillStyle = 'rgba(180,210,255,0.45)'; ctx.font = '9px "IBM Plex Mono",monospace';
      ctx.fillText('WEIGHT', donutX, donutY - 8);
      ctx.fillStyle = '#e2f0ff'; ctx.font = 'bold 11px "IBM Plex Mono",monospace';
      ctx.fillText('Distribution', donutX, donutY + 8);
    }

    // Legend
    const lineH  = Math.min(20, H / (slices.length + 1));
    const startY = (H - slices.length * lineH) / 2;
    ctx.textBaseline = 'middle'; ctx.font = `${Math.max(9, Math.min(10, H / 22))}px "IBM Plex Mono",monospace`;
    slices.forEach((s, si) => {
      const y = startY + si * lineH;
      ctx.beginPath(); ctx.arc(10, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = s.color; ctx.fill();
      ctx.fillStyle = hovIdx === si ? '#fff' : 'rgba(180,210,255,0.7)';
      ctx.textAlign = 'left'; ctx.fillText(s.label, 22, y);
      ctx.textAlign = 'right'; ctx.fillStyle = hovIdx === si ? s.color : 'rgba(180,210,255,0.5)';
      ctx.fillText(p2(s.pct), legendW - 4, y);
    });
  }, [slices, hovIdx]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; const cont = containerRef.current;
    if (!canvas || !cont) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    const legendW = Math.min(160, cont.clientWidth * 0.36);
    const donutX  = legendW + (cont.clientWidth - legendW) / 2;
    const donutY  = cont.clientHeight / 2;
    const outerR  = Math.min((cont.clientWidth - legendW) / 2, cont.clientHeight / 2) * 0.78;
    const innerR  = outerR * 0.58;
    const dx = mx - donutX; const dy = my - donutY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < innerR || dist > outerR * 1.1) { setHovIdx(null); return; }
    let a = Math.atan2(dy, dx) + Math.PI / 2; if (a < 0) a += Math.PI * 2;
    let start = 0; const gap = 0.013;
    for (let si = 0; si < slices.length; si++) {
      const sweep = (slices[si].pct / 100) * Math.PI * 2 - gap;
      if (a >= start && a <= start + sweep) { setHovIdx(si); return; }
      start += sweep + gap;
    }
    setHovIdx(null);
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'default' }}
        onMouseMove={onMove} onMouseLeave={() => setHovIdx(null)} />
    </div>
  );
};

// ── Single Index Panel ─────────────────────────────────────────────────────────
const IndexPanel: React.FC<{ indexNum: '20' | '100'; accent: string }> = ({ indexNum, accent }) => {
  const [liveData, setLiveData]  = useState<IndexData | null>(null);
  const [histData, setHistData]  = useState<HistoryData | null>(null);
  const [loading, setLoading]    = useState(true);
  const [tab, setTab]            = useState<TabType>('index');
  const [tf, setTf]              = useState<TimeframeType>('1Y');
  const [updated, setUpdated]    = useState('');
  const [showAll, setShowAll]    = useState(false);
  const [error, setError]        = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [live, hist] = await Promise.all([
        fetch(`/api/cmc-index?index=${indexNum}&type=data`).then(r => r.json()) as Promise<IndexData>,
        fetch(`/api/cmc-index?index=${indexNum}&type=history&days=365`).then(r => r.json()) as Promise<HistoryData>,
      ]);
      if (!live.success) throw new Error(live.error ?? 'API error');
      setLiveData(live); setHistData(hist);
      setUpdated(new Date().toLocaleTimeString());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [indexNum]);

  useEffect(() => { load(); }, [load]);

  const coins    = liveData?.constituents ?? [];
  const top5     = coins.slice(0, 5);
  const history  = histData?.history ?? [];
  const displayed = showAll ? coins : coins.slice(0, 10);

  // Stat card values
  const mcapTrimmed = liveData ? fmtMcap(liveData.totalMarketCap) : '—';
  const chg24h = liveData?.change24h ?? 0;

  return (
    <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0 }}>
      {/* Sidebar */}
      <div className="cmci-sidebar">

        {/* Live Value card */}
        <div className="cmci-card">
          <div className="cmci-card-title">CMC{indexNum} Index</div>
          {loading && !liveData ? (
            <><Skel h={30} /><Skel h={12} /></>
          ) : liveData ? (
            <>
              <div className="cmci-val" style={{ color: accent }}>
                ${liveData.value.toFixed(2)}
              </div>
              <div className="cmci-chg" style={{ color: chg24h >= 0 ? '#22c55e' : '#ef4444' }}>
                {chg24h >= 0 ? '▲' : '▼'} {Math.abs(chg24h).toFixed(2)}% (24H)
              </div>
              <WeightBar coins={coins} />
            </>
          ) : null}
        </div>

        {/* Stats */}
        <div className="cmci-card">
          <div className="cmci-card-title">Market Stats</div>
          {loading && !liveData ? (
            <><Skel h={18} /><Skel h={18} /><Skel h={18} /></>
          ) : liveData ? (
            <>
              {([
                ['Total Mcap', mcapTrimmed],
                ['Constituents', String(liveData.constituentCount)],
                ['Updated', updated],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="cmci-stat-row">
                  <span className="cmci-stat-label">{k}</span>
                  <span className="cmci-stat-val">{v}</span>
                </div>
              ))}
            </>
          ) : null}
        </div>

        {/* Top weights */}
        <div className="cmci-card">
          <div className="cmci-card-title">Top Weights</div>
          {loading && !liveData ? (
            <><Skel h={16} /><Skel h={16} /><Skel h={16} /></>
          ) : (
            top5.map(c => (
              <div key={c.id} className="cmci-stat-row">
                <span className="cmci-stat-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: coinColor(c.symbol), display: 'inline-block' }} />
                  {c.symbol}
                </span>
                <Pill color={coinColor(c.symbol)} label="" value={c.weight} />
              </div>
            ))
          )}
        </div>

      </div>

      {/* Chart panel */}
      <div className="cmci-chart-panel">
        <div className="cmci-ch-hdr">
          <span className="cmci-ch-title">CMC{indexNum} Chart</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="cmci-tab-grp">
              {(['index', 'weights'] as TabType[]).map(t => (
                <button key={t} className={`cmci-tbtn ${tab === t ? 'on' : 'off'}`} onClick={() => setTab(t)}>
                  {t === 'index' ? 'Index Price' : 'Weights'}
                </button>
              ))}
            </div>
            {tab === 'index' && (
              <div className="cmci-rng-grp">
                {(['24H', '7D', '30D', '1Y'] as TimeframeType[]).map(t => (
                  <button key={t} className={`cmci-rbtn ${tf === t ? 'on' : 'off'}`} onClick={() => setTf(t)}>{t}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="cmci-legend">
          {tab === 'index' ? (
            <div className="cmci-leg-item">
              <span className="cmci-leg-dot" style={{ background: accent }} />
              CMC{indexNum} Index (normalised)
            </div>
          ) : top5.map(c => (
            <div key={c.symbol} className="cmci-leg-item">
              <span className="cmci-leg-dot" style={{ background: coinColor(c.symbol) }} />
              {c.symbol}
            </div>
          ))}
        </div>

        <div className="cmci-chart-area">
          <div>
            {loading && !history.length ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: 'rgba(200,220,255,0.3)', fontSize: 12 }}>
                Loading chart data…
              </div>
            ) : tab === 'index' && history.length ? (
              <LineChart data={history} accent={accent} tf={tf} />
            ) : tab === 'weights' && coins.length ? (
              <DonutChart coins={coins} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: 'rgba(200,220,255,0.2)', fontSize: 11 }}>
                No data available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Root ───────────────────────────────────────────────────────────────────────
const CMCIndexDashboard: React.FC = () => {
  const [activeIdx, setActiveIdx] = useState<IndexType>('both');
  const [showTable, setShowTable] = useState(false);

  return (
    <>
      <style>{CSS}</style>
      <div className="cmci-root">

        {/* Header */}
        <div className="cmci-hdr">
          <div className="cmci-hrow">
            <span style={{ fontSize: 16, fontWeight: 800, color: '#e2f0ff' }}>CMC Index Dashboard</span>
            <button style={{
              background: 'rgba(247,147,26,0.1)', border: '1px solid rgba(247,147,26,0.3)',
              color: '#f7931a', padding: '2px 10px', fontSize: 10, cursor: 'pointer',
              borderRadius: 4, fontFamily: '"IBM Plex Mono",monospace',
            }}>API Details</button>
            <div style={{ marginLeft: 'auto' }}>
              {/* Index selector */}
              <div className="cmci-idx-grp">
                {([['20', 'CMC 20'], ['100', 'CMC 100'], ['both', 'Both']] as [IndexType, string][]).map(([v, lbl]) => (
                  <button key={v} className={`cmci-idx-btn ${activeIdx === v ? 'on' : 'off'}`}
                    onClick={() => setActiveIdx(v)}>{lbl}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(200,220,255,0.32)', lineHeight: 1.5 }}>
            Market-cap weighted crypto indices tracking the top 20 and top 100 digital assets.
            Data sourced from <span style={{ color: 'rgba(247,147,26,0.7)' }}>CoinGecko Free API</span> — no API key required.
          </div>
        </div>

        <div className="cmci-body">
          <div className={`cmci-panels ${activeIdx === 'both' ? 'dual' : 'single'}`}>
            {(activeIdx === '20' || activeIdx === 'both') && (
              <IndexPanel indexNum="20"  accent="#f7931a" />
            )}
            {(activeIdx === '100' || activeIdx === 'both') && (
              <IndexPanel indexNum="100" accent="#627eea" />
            )}
          </div>

          {/* Constituents table — togglable */}
          <div className="cmci-table-wrap">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2f0ff' }}>
                Top Constituents by Weight
              </div>
              <button onClick={() => setShowTable(o => !o)} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(200,220,255,0.5)', padding: '2px 8px', fontSize: 10,
                cursor: 'pointer', borderRadius: 3, fontFamily: '"IBM Plex Mono",monospace',
              }}>{showTable ? 'Hide ∧' : 'Show ∨'}</button>
            </div>

            {showTable && (
              <table className="cmci-table">
                <thead>
                  <tr>
                    {['#', 'Coin', 'Symbol', 'Price', '24h', 'Mcap', 'Weight'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Hardcoded to CMC20 for table view simplicity */}
                </tbody>
              </table>
            )}
          </div>

          {/* API reference */}
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(200,220,255,0.55)',
                textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Free Data API — No Key Required
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 8 }}>
                {([
                  ['Live constituents', '/api/cmc-index?index=20&type=data'],
                  ['Live (CMC100)',     '/api/cmc-index?index=100&type=data'],
                  ['Price history',     '/api/cmc-index?index=20&type=history&days=365'],
                  ['CoinGecko markets', 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd'],
                ] as [string, string][]).map(([lbl, url]) => (
                  <div key={lbl} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 5, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: 'rgba(180,210,255,0.4)', marginBottom: 4, letterSpacing: 1 }}>{lbl}</div>
                    <code style={{ fontSize: 9, color: 'rgba(247,147,26,0.6)', wordBreak: 'break-all', lineHeight: 1.5 }}>{url}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CMCIndexDashboard;