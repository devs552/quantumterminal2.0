'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
type TF = '15m' | '1h' | '4h' | '1d' | '7d';

interface MACDPoint { ts: number; macd: number; signal: number; histogram: number; normalizedMACD: number }
interface CoinMACD {
  id: string; name: string; symbol: string; image: string;
  price: number; marketCap: number; volume24h: number; change24h: number;
  macd15m: number; macd1h: number; macd4h: number; macd1d: number; macd7d: number;
  currentMACD: number; signal: 'bullish' | 'bearish' | 'neutral'; color: string;
}
interface HistEntry { label: string; value: number }
interface OverviewData {
  success: boolean;
  avgNormalizedMACD: number; marketSignal: string;
  positivePct: number; negativePct: number;
  positiveCount: number; negativeCount: number;
  historicalMACD: HistEntry[];
  coins: CoinMACD[];
  error?: string;
}
interface ChartData {
  success: boolean;
  coinId: string; tf: string;
  timeframes: Record<TF, MACDPoint[]>;
  error?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const GREEN  = '#00c853';
const RED    = '#ff3d3d';
const BLUE   = '#4da6ff';
const ORANGE = '#f7931a';
const NAVY   = '#0a0f1e';

const TF_LABELS: TF[] = ['15m','1h','4h','1d','7d'];

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtPrice(p: number) {
  if (p >= 1000) return '$' + p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1)    return '$' + p.toFixed(4);
  return '$' + p.toPrecision(4);
}
function fmtMcap(n: number) {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(1)  + 'B';
  return '$' + (n / 1e6).toFixed(0) + 'M';
}
function macdColor(v: number) { return v > 0.3 ? GREEN : v < -0.3 ? RED : 'rgba(180,210,255,0.5)'; }

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
  .macd-root {
    display:flex; flex-direction:column; height:100%;
    background:#0a0f1e;
    font-family:"IBM Plex Mono","Courier New",monospace;
    color:#c8d8f4; overflow:hidden; box-sizing:border-box;
  }
  .macd-hdr { padding:10px 16px 7px; flex-shrink:0;
    border-bottom:1px solid rgba(255,255,255,0.06); }
  .macd-title { font-size:15px; font-weight:800; color:#e2f0ff; margin-bottom:2px; }
  .macd-sub   { font-size:10px; color:rgba(200,220,255,0.32); line-height:1.5; }
  .macd-hrow  { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:3px; }

  /* TF pill row */
  .macd-tf-grp { display:flex; gap:2px; }
  .macd-tfbtn  {
    border-radius:3px; font-family:"IBM Plex Mono",monospace; font-size:10px;
    cursor:pointer; padding:2px 9px; line-height:1.6; transition:all .15s;
  }
  .macd-tfbtn.on  { background:rgba(247,147,26,0.22); border:1px solid rgba(247,147,26,0.5); color:#f7931a; }
  .macd-tfbtn.off { background:transparent; border:1px solid rgba(255,255,255,0.1); color:rgba(200,220,255,0.3); }
  .macd-tfbtn.off:hover { border-color:rgba(255,255,255,0.22); color:rgba(200,220,255,0.6); }

  /* Refresh btn */
  .macd-refresh {
    background:rgba(247,147,26,0.08); border:1px solid rgba(247,147,26,0.2);
    color:#f7931a; padding:2px 9px; font-size:10px; cursor:pointer;
    border-radius:3px; font-family:"IBM Plex Mono",monospace;
  }
  .macd-refresh:disabled { opacity:.4; cursor:default; }

  /* Normalized toggle */
  .macd-norm-grp { display:flex; gap:0; margin-left:auto; }
  .macd-nbtn {
    padding:3px 12px; font-size:10px; cursor:pointer; border:1px solid rgba(255,255,255,0.12);
    font-family:"IBM Plex Mono",monospace; transition:all .15s; line-height:1.6;
  }
  .macd-nbtn:first-child { border-radius:3px 0 0 3px; }
  .macd-nbtn:last-child  { border-radius:0 3px 3px 0; border-left:none; }
  .macd-nbtn.on  { background:rgba(255,255,255,0.12); color:#e2f0ff; }
  .macd-nbtn.off { background:transparent; color:rgba(200,220,255,0.25); }

  /* Body */
  .macd-body { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden;
    display:flex; flex-direction:column; }
  .macd-body::-webkit-scrollbar { width:4px; }
  .macd-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }

  /* Top split layout */
  .macd-top { display:flex; gap:10px; padding:10px 16px; flex-shrink:0; min-height:340px; }
  .macd-sidebar { width:230px; flex-shrink:0; display:flex; flex-direction:column; gap:8px; }
  .macd-card {
    background:rgba(255,255,255,0.025);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; padding:12px 14px;
  }
  .macd-card-label {
    font-size:10px; font-weight:700; color:rgba(200,220,255,0.5);
    text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px;
  }

  /* Average MACD value */
  .macd-avg-val  { font-size:28px; font-weight:900; line-height:1; margin-bottom:5px; }
  .macd-signal-badge {
    display:inline-flex; align-items:center; gap:5px;
    padding:2px 9px; border-radius:3px; font-size:10px; font-weight:800;
    letter-spacing:.04em;
  }
  /* Slider bar */
  .macd-slider-track {
    height:6px; border-radius:3px; margin-top:8px;
    background:linear-gradient(to right,#3b82f6,#22c55e,#ef4444);
    position:relative;
  }
  .macd-slider-thumb {
    position:absolute; top:50%; transform:translate(-50%,-50%);
    width:12px; height:12px; border-radius:50%;
    background:#fff; border:2px solid #0a0f1e;
    box-shadow:0 0 6px rgba(255,255,255,0.4);
    transition:left .4s ease;
  }
  .macd-slider-labels { display:flex; justify-content:space-between;
    font-size:9px; color:rgba(180,210,255,0.4); margin-top:3px; }

  /* Pos/Neg row */
  .macd-pn-row { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
  .macd-pn-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
  .macd-pn-val { font-size:18px; font-weight:900; }
  .macd-pn-bar { height:5px; border-radius:3px; overflow:hidden;
    background:rgba(255,255,255,0.06); margin-top:4px; }

  /* Historical rows */
  .macd-hist-row { display:flex; justify-content:space-between; align-items:center;
    padding:5px 0; border-bottom:1px solid rgba(255,255,255,0.05); }
  .macd-hist-row:last-child { border-bottom:none; }
  .macd-hist-label { font-size:10px; color:rgba(180,210,255,0.5); }
  .macd-hist-val   {
    font-size:11px; font-weight:800; padding:1px 8px; border-radius:3px;
    min-width:46px; text-align:center;
  }

  /* Chart panel */
  .macd-chart-panel {
    flex:1; min-width:0; display:flex; flex-direction:column;
    background:rgba(255,255,255,0.02);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; overflow:hidden;
  }
  .macd-ch-hdr {
    padding:9px 14px; display:flex; justify-content:space-between; align-items:center;
    border-bottom:1px solid rgba(255,255,255,0.05); flex-wrap:wrap; gap:6px; flex-shrink:0;
  }
  .macd-ch-title { font-size:12px; font-weight:700; color:#e2f0ff; }
  .macd-legend   { display:flex; gap:14px; padding:5px 14px; flex-shrink:0; flex-wrap:wrap;
    border-bottom:1px solid rgba(255,255,255,0.04); }
  .macd-leg-item { display:flex; align-items:center; gap:5px; font-size:10px; color:rgba(180,210,255,0.5); }
  .macd-leg-dot  { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .macd-leg-line { width:16px; height:2px; border-radius:1px; flex-shrink:0; }
  .macd-chart-area { flex:1; min-height:0; position:relative; }
  .macd-chart-area > div { position:absolute; inset:0; width:100%; height:100%; }

  /* Coin selector row (for chart view) */
  .macd-coin-row { display:flex; gap:4px; padding:6px 14px; flex-wrap:wrap;
    border-bottom:1px solid rgba(255,255,255,0.04); flex-shrink:0; overflow-x:auto; }
  .macd-coin-btn {
    padding:2px 8px; border-radius:3px; font-size:9px; font-weight:700;
    cursor:pointer; border:1px solid rgba(255,255,255,0.1); background:transparent;
    color:rgba(180,210,255,0.5); transition:all .12s; font-family:"IBM Plex Mono",monospace;
    white-space:nowrap;
  }
  .macd-coin-btn.active { color:#e2f0ff; background:rgba(255,255,255,0.08);
    border-color:rgba(255,255,255,0.25); }

  /* Table */
  .macd-table-wrap { padding:0 16px 16px; flex-shrink:0; }
  .macd-table-hdr  { font-size:14px; font-weight:800; color:#e2f0ff; margin-bottom:8px; padding-top:4px; }
  table.macd-tbl { width:100%; border-collapse:collapse; font-size:11px; }
  table.macd-tbl th {
    padding:6px 8px; text-align:right; font-size:9px; font-weight:700;
    color:rgba(180,210,255,0.4); border-bottom:1px solid rgba(255,255,255,0.07);
    letter-spacing:.04em; text-transform:uppercase; white-space:nowrap; cursor:pointer;
  }
  table.macd-tbl th:first-child,
  table.macd-tbl th:nth-child(2) { text-align:left; }
  table.macd-tbl td { padding:7px 8px; border-bottom:1px solid rgba(255,255,255,0.04); white-space:nowrap; }
  table.macd-tbl tr:hover td { background:rgba(247,147,26,0.04); }
  table.macd-tbl td.r { text-align:right; }
  .macd-tbl-val {
    display:inline-block; padding:1px 7px; border-radius:3px;
    font-size:10px; font-weight:800; min-width:44px; text-align:center;
  }

  /* Skeleton */
  @keyframes macd-pulse { 0%,100%{opacity:.35} 50%{opacity:.12} }
  .macd-skel { background:rgba(255,255,255,0.08); border-radius:4px;
    animation:macd-pulse 1.4s ease-in-out infinite; }

  /* Error */
  .macd-err { margin:6px 16px 0; background:rgba(239,68,68,0.08);
    border:1px solid rgba(239,68,68,0.25); color:#fca5a5;
    padding:5px 10px; border-radius:5px; font-size:11px; flex-shrink:0; }

  @media(max-width:780px){
    .macd-top { flex-direction:column; min-height:auto; }
    .macd-sidebar { width:100%; flex-direction:row; flex-wrap:wrap; }
    .macd-card { flex:1 1 180px; }
    .macd-chart-panel { min-height:320px; }
  }
`;

const Skel: React.FC<{ h?: number; mb?: number; w?: string }> = ({ h=14, mb=6, w='100%' }) => (
  <div className="macd-skel" style={{ height:h, marginBottom:mb, width:w }} />
);

// ── MACD Line + Histogram Chart ────────────────────────────────────────────────
const MACDChart: React.FC<{ points: MACDPoint[]; tf: TF }> = ({ points, tf }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tipIdx, setTipIdx] = useState<number | null>(null);
  const n = points.length;

  const draw = useCallback(() => {
    const canvas = canvasRef.current; const cont = containerRef.current;
    if (!canvas || !cont || n < 2) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;
    const W = cont.clientWidth; const H = cont.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width  = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR); ctx.clearRect(0, 0, W, H);

    const PAD = { top:12, right:14, bottom:28, left:16 };
    const cw  = W - PAD.left - PAD.right;
    const ch  = H - PAD.top  - PAD.bottom;

    const allVals = [...points.map(p => p.macd), ...points.map(p => p.signal), ...points.map(p => p.histogram)];
    const minV = Math.min(...allVals); const maxV = Math.max(...allVals);
    const range = maxV - minV || 1;
    const zeroY = PAD.top + ch - ((0 - minV) / range) * ch;

    const toX = (i: number) => PAD.left + (i / (n - 1)) * cw;
    const toY = (v: number) => PAD.top + ch - ((v - minV) / range) * ch;
    const fsz = Math.max(8, Math.min(10, W / 70));

    // Grid + zero line
    [minV, 0, maxV].forEach(v => {
      const y = toY(v); const isZero = v === 0;
      ctx.setLineDash(isZero ? [] : [3, 6]);
      ctx.strokeStyle = isZero ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)';
      ctx.lineWidth   = isZero ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.setLineDash([]);
      if (isZero) {
        ctx.fillStyle = 'rgba(200,220,255,0.3)'; ctx.font = `${fsz}px monospace`;
        ctx.textAlign = 'right'; ctx.fillText('0', PAD.left - 2, y + 3);
      }
    });

    // X-axis labels
    const xN = Math.max(2, Math.min(6, Math.floor(W / 90)));
    ctx.fillStyle = 'rgba(180,200,240,0.3)'; ctx.font = `${fsz}px monospace`; ctx.textAlign = 'center';
    for (let i = 0; i < xN; i++) {
      const idx = Math.floor((i / (xN - 1)) * (n - 1));
      const d   = new Date(points[idx].ts);
      ctx.fillText(
        d.toLocaleDateString('en-US', { month:'short', day:'numeric' }),
        toX(idx), H - 5
      );
    }

    // Histogram bars
    const barW = Math.max(1, cw / n - 1);
    points.forEach((p, i) => {
      const x     = PAD.left + (i / n) * cw;
      const isPos = p.histogram >= 0;
      const y1    = isPos ? toY(p.histogram) : zeroY;
      const y2    = isPos ? zeroY : toY(p.histogram);
      const isHov = tipIdx === i;
      ctx.fillStyle = isPos
        ? (isHov ? GREEN : GREEN + '99')
        : (isHov ? RED   : RED   + '99');
      ctx.fillRect(x, Math.min(y1, y2), barW, Math.abs(y2 - y1) || 1);
    });

    // Signal line
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(toX(i), toY(p.signal)) : ctx.lineTo(toX(i), toY(p.signal)));
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 1.5; ctx.stroke();

    // MACD line
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(toX(i), toY(p.macd)) : ctx.lineTo(toX(i), toY(p.macd)));
    ctx.strokeStyle = BLUE; ctx.lineWidth = 2; ctx.stroke();

    // Crosshair + dots
    if (tipIdx !== null && points[tipIdx]) {
      const tx = toX(tipIdx);
      ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, PAD.top); ctx.lineTo(tx, PAD.top + ch); ctx.stroke();
      ctx.setLineDash([]);
      [[points[tipIdx].macd, BLUE],[points[tipIdx].signal, ORANGE]].forEach(([v, c]) => {
        ctx.beginPath(); ctx.arc(tx, toY(v as number), 4, 0, Math.PI * 2);
        ctx.fillStyle = c as string; ctx.fill();
        ctx.strokeStyle = NAVY; ctx.lineWidth = 1.5; ctx.stroke();
      });
    }
  }, [points, n, tipIdx]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current; if (!c || n < 2) return;
    const r  = c.getBoundingClientRect();
    const cw = c.clientWidth - 16 - 14;
    setTipIdx(Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left - 16) / cw * (n - 1)))));
  };

  const tip    = tipIdx !== null ? points[tipIdx] : null;
  const tipPct = tipIdx !== null ? tipIdx / Math.max(n - 1, 1) : 0;

  return (
    <div ref={containerRef} style={{ position:'relative', width:'100%', height:'100%' }}>
      <canvas ref={canvasRef}
        style={{ width:'100%', height:'100%', display:'block', cursor:'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => setTipIdx(null)} />
      {tip && (
        <div style={{
          position:'absolute',
          left: tipPct > 0.65 ? undefined : `calc(${tipPct * 100}% + 14px)`,
          right: tipPct > 0.65 ? '14px' : undefined,
          top:10,
          background:'rgba(5,10,28,0.97)', border:'1px solid rgba(255,255,255,0.12)',
          borderRadius:6, padding:'9px 13px', fontSize:10, color:'#a8c0f0',
          pointerEvents:'none', zIndex:20, fontFamily:'"IBM Plex Mono",monospace', minWidth:180,
          boxShadow:'0 4px 20px rgba(0,0,0,0.6)',
        }}>
          <div style={{ color:'rgba(200,220,255,0.5)', marginBottom:6,
            borderBottom:'1px solid rgba(255,255,255,0.08)', paddingBottom:4 }}>
            {new Date(tip.ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
            {' — '}{tf}
          </div>
          {[
            { label:'MACD',      val: tip.macd.toFixed(4),      color: BLUE   },
            { label:'Signal',    val: tip.signal.toFixed(4),    color: ORANGE },
            { label:'Histogram', val: tip.histogram.toFixed(4), color: tip.histogram >= 0 ? GREEN : RED },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', marginBottom:3, gap:12 }}>
              <span style={{ color:'rgba(180,200,240,0.6)' }}>{label}:</span>
              <span style={{ color, fontWeight:800 }}>{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── MACD Heatmap (Scatter) ─────────────────────────────────────────────────────
const MACDHeatmap: React.FC<{ coins: CoinMACD[]; tf: TF }> = ({ coins, tf }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovCoin, setHovCoin] = useState<CoinMACD | null>(null);
  const [hovPos,  setHovPos]  = useState({ x:0, y:0 });

  const getMacd = (c: CoinMACD) =>
    tf === '15m' ? c.macd15m : tf === '1h' ? c.macd1h : tf === '4h' ? c.macd4h :
    tf === '1d'  ? c.macd1d  : c.macd7d;

  const draw = useCallback((hov: CoinMACD | null) => {
    const canvas = canvasRef.current; const cont = containerRef.current;
    if (!canvas || !cont || coins.length === 0) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;
    const W = cont.clientWidth; const H = cont.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR); ctx.clearRect(0, 0, W, H);

    const PAD = { top:14, right:70, bottom:28, left:10 };
    const cw  = W - PAD.left - PAD.right;
    const ch  = H - PAD.top  - PAD.bottom;

    const mcaps   = coins.map(c => c.marketCap);
    const minMcap = Math.min(...mcaps); const maxMcap = Math.max(...mcaps);
    const macds   = coins.map(c => getMacd(c));
    const minM    = Math.min(...macds, -5); const maxM = Math.max(...macds, 5);
    const fsz = Math.max(8, Math.min(10, W / 70));

    const toX = (mc: number) => PAD.left + (Math.log(mc / minMcap) / Math.log(maxMcap / minMcap)) * cw;
    const toY = (m:  number) => PAD.top  + ch - ((m - minM) / (maxM - minM)) * ch;

    // Right axis labels
    [-20,-10,0,10,20].forEach(v => {
      if (v < minM || v > maxM) return;
      const y = toY(v);
      ctx.setLineDash(v === 0 ? [] : [3,6]);
      ctx.strokeStyle = v === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)';
      ctx.lineWidth   = v === 0 ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = v === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(200,220,255,0.3)';
      ctx.font = `${fsz}px monospace`; ctx.textAlign = 'left';
      ctx.fillText(v.toString(), W - PAD.right + 4, y + 3);
    });

    // Zone labels (right axis)
    ctx.font = `${fsz}px monospace`; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,200,83,0.5)';
    ctx.fillText('Bullish Momentum', W - PAD.right + 4, PAD.top + 12);
    ctx.fillStyle = 'rgba(255,61,61,0.5)';
    ctx.fillText('Bearish Momentum', W - PAD.right + 4, PAD.top + ch - 4);

    // Zone shading
    const zeroY = toY(0);
    ctx.fillStyle = 'rgba(0,200,83,0.04)';
    ctx.fillRect(PAD.left, PAD.top, cw, zeroY - PAD.top);
    ctx.fillStyle = 'rgba(255,61,61,0.04)';
    ctx.fillRect(PAD.left, zeroY, cw, PAD.top + ch - zeroY);

    // X-axis labels (market cap)
    const xLabels = ['$2T','$1T','$800B','$600B','$400B','$200B','$100B','$80B','$60B','$40M'];
    ctx.font = `${fsz}px monospace`; ctx.fillStyle = 'rgba(180,200,240,0.3)';
    xLabels.forEach((lbl, i) => {
      const frac = i / (xLabels.length - 1);
      ctx.textAlign = 'center';
      ctx.fillText(lbl, PAD.left + frac * cw, H - 5);
    });

    // Dots
    coins.forEach(c => {
      const m     = getMacd(c);
      const x     = toX(c.marketCap);
      const y     = toY(m);
      const r     = Math.max(4, Math.min(12, Math.log10(c.marketCap / 1e8) * 2.5));
      const isHov = hov?.id === c.id;
      const col   = m > 0.3 ? GREEN : m < -0.3 ? RED : 'rgba(180,210,255,0.5)';

      ctx.beginPath(); ctx.arc(x, y, r + (isHov ? 3 : 0), 0, Math.PI * 2);
      ctx.fillStyle = isHov ? col : col + (m === 0 ? '99' : 'cc');
      ctx.fill();
      if (isHov) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }

      // Symbol label for large coins or hovered
      if (c.marketCap > 2e10 || isHov) {
        ctx.font = `${isHov ? 9 : 8}px monospace`;
        ctx.fillStyle = isHov ? '#fff' : 'rgba(220,235,255,0.8)';
        ctx.textAlign = 'center';
        ctx.fillText(c.symbol, x, y - r - 3);
      }
    });
  }, [coins, tf, hovCoin]);

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
    const PAD = { top:14, right:70, bottom:28, left:10 };
    const cw  = cont.clientWidth - PAD.left - PAD.right;
    const ch  = cont.clientHeight - PAD.top - PAD.bottom;
    const mcaps   = coins.map(c => c.marketCap);
    const minMcap = Math.min(...mcaps); const maxMcap = Math.max(...mcaps);
    const macds   = coins.map(c => getMacd(c));
    const minM = Math.min(...macds, -5); const maxM = Math.max(...macds, 5);
    const toX = (mc: number) => PAD.left + (Math.log(mc / minMcap) / Math.log(maxMcap / minMcap)) * cw;
    const toY = (m: number)  => PAD.top  + ch - ((m - minM) / (maxM - minM)) * ch;

    let closest: CoinMACD | null = null; let minDist = 20;
    coins.forEach(c => {
      const dx = mx - toX(c.marketCap); const dy = my - toY(getMacd(c));
      const d  = Math.sqrt(dx*dx + dy*dy);
      if (d < minDist) { minDist = d; closest = c; }
    });
    setHovCoin(closest);
    setHovPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const tipMacd = hovCoin ? getMacd(hovCoin) : 0;

  return (
    <div ref={containerRef} style={{ position:'relative', width:'100%', height:'100%' }}>
      <canvas ref={canvasRef}
        style={{ width:'100%', height:'100%', display:'block', cursor:'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => setHovCoin(null)} />
      {hovCoin && (
        <div style={{
          position:'absolute', left: hovPos.x + 14, top: hovPos.y - 10,
          background:'rgba(5,10,28,0.97)', border:'1px solid rgba(255,255,255,0.12)',
          borderRadius:6, padding:'9px 13px', fontSize:10, color:'#a8c0f0',
          pointerEvents:'none', zIndex:20, fontFamily:'"IBM Plex Mono",monospace', minWidth:195,
          boxShadow:'0 4px 20px rgba(0,0,0,0.6)',
        }}>
          <div style={{ color: macdColor(tipMacd), fontWeight:800, marginBottom:5,
            borderBottom:'1px solid rgba(255,255,255,0.08)', paddingBottom:4 }}>
            {hovCoin.name} ({hovCoin.symbol})
          </div>
          {[
            ['Price',       fmtPrice(hovCoin.price)],
            ['Market Cap',  fmtMcap(hovCoin.marketCap)],
            ['Price 24h %', (hovCoin.change24h >= 0 ? '+' : '') + hovCoin.change24h.toFixed(2) + '%'],
            [`MACD (${tf})`, tipMacd.toFixed(2)],
          ].map(([k, v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:3, gap:12 }}>
              <span style={{ color:'rgba(180,200,240,0.6)' }}>{k}:</span>
              <span style={{ color: k === `MACD (${tf})` ? macdColor(tipMacd) : '#e2f0ff', fontWeight:700 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop:6, paddingTop:5, borderTop:'1px solid rgba(255,255,255,0.07)' }}>
            {(['15m','1h','4h','1d','7d'] as TF[]).map(t => {
              const v = t==='15m' ? hovCoin.macd15m : t==='1h' ? hovCoin.macd1h :
                        t==='4h' ? hovCoin.macd4h  : t==='1d' ? hovCoin.macd1d : hovCoin.macd7d;
              return (
                <div key={t} style={{ display:'flex', justifyContent:'space-between', marginBottom:2, gap:10 }}>
                  <span style={{ color:'rgba(160,190,240,0.5)', fontSize:9 }}>MACD ({t}):</span>
                  <span style={{ color: macdColor(v), fontWeight:700, fontSize:9 }}>{v.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Root Component ─────────────────────────────────────────────────────────────
const MACDDashboard: React.FC = () => {
  const [tf,           setTf]           = useState<TF>('7d');
  const [normalized,   setNormalized]   = useState(true);
  const [overview,     setOverview]     = useState<OverviewData | null>(null);
  const [chartData,    setChartData]    = useState<ChartData | null>(null);
  const [selectedCoin, setSelectedCoin] = useState('bitcoin');
  const [loading,      setLoading]      = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [sortCol,      setSortCol]      = useState<keyof CoinMACD>('currentMACD');
  const [sortAsc,      setSortAsc]      = useState(false);

  // Load overview + heatmap
  const loadOverview = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d: OverviewData = await fetch(`/api/macd?type=overview&tf=${tf}`).then(r => r.json());
      if (!d.success) throw new Error(d.error ?? 'API error');
      setOverview(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
  }, [tf]);

  // Load MACD chart for selected coin
  const loadChart = useCallback(async () => {
    setChartLoading(true);
    try {
      const d: ChartData = await fetch(`/api/macd?type=chart&coinId=${selectedCoin}&tf=${tf}`).then(r => r.json());
      if (!d.success) throw new Error(d.error ?? 'Chart API error');
      setChartData(d);
    } catch { /* non-fatal */ } finally { setChartLoading(false); }
  }, [selectedCoin, tf]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadChart();    }, [loadChart]);

  const coins     = overview?.coins ?? [];
  const histMACD  = overview?.historicalMACD ?? [];
  const chartPts  = chartData?.timeframes?.[tf] ?? [];

  // Sort table
  const sorted = [...coins].sort((a, b) => {
    const av = a[sortCol] as number; const bv = b[sortCol] as number;
    return sortAsc ? av - bv : bv - av;
  });

  const avg      = overview?.avgNormalizedMACD ?? 0;
  const sliderPct = Math.max(0, Math.min(100, (avg + 10) / 20 * 100)); // map −10…+10 → 0…100%

  const thClick = (col: keyof CoinMACD) => {
    if (sortCol === col) setSortAsc(a => !a); else { setSortCol(col); setSortAsc(false); }
  };
  const thArr = (col: keyof CoinMACD) => sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : '';

  return (
    <>
      <style>{CSS}</style>
      <div className="macd-root">

        {/* Header */}
        <div className="macd-hdr">
          <div className="macd-hrow">
            <span className="macd-title">Crypto MACD</span>
            <button className="macd-refresh" onClick={loadOverview} disabled={loading}>
              {loading ? '↻ Loading…' : '↺ Refresh'}
            </button>
            <div className="macd-norm-grp">
              <button className={`macd-nbtn ${normalized ? 'on' : 'off'}`} onClick={() => setNormalized(true)}>
                Normalized (PPO)
              </button>
              <button className={`macd-nbtn ${!normalized ? 'on' : 'off'}`} onClick={() => setNormalized(false)}>
                Not normalized (MACD)
              </button>
            </div>
          </div>
          <div className="macd-sub">
            Use CoinMarketCap's MACD for crypto dashboard (Moving Average Convergence and Divergence)
            to measure price and trend momentum and potential entry or exit points to buy or sell.
          </div>
        </div>

        {error && <div className="macd-err">⚠ {error}</div>}

        <div className="macd-body">
          {/* Top split */}
          <div className="macd-top">

            {/* Sidebar */}
            <div className="macd-sidebar">

              {/* Average MACD */}
              <div className="macd-card">
                <div className="macd-card-label">Average Normalized MACD</div>
                {loading && !overview ? <><Skel h={32} /><Skel h={12} /></> : (
                  <>
                    <div className="macd-avg-val" style={{ color: avg >= 0 ? GREEN : RED }}>
                      {avg >= 0 ? '+' : ''}{avg.toFixed(2)}
                    </div>
                    <span className="macd-signal-badge" style={{
                      background: overview?.marketSignal?.includes('Bullish') ? 'rgba(0,200,83,0.15)' : 'rgba(255,61,61,0.15)',
                      color:      overview?.marketSignal?.includes('Bullish') ? GREEN : RED,
                      border:     `1px solid ${overview?.marketSignal?.includes('Bullish') ? GREEN+'40' : RED+'40'}`,
                    }}>
                      {overview?.marketSignal}
                    </span>
                    <div className="macd-slider-track">
                      <div className="macd-slider-thumb" style={{ left: `${sliderPct}%` }} />
                    </div>
                    <div className="macd-slider-labels"><span>Positive</span><span>Negative</span></div>
                  </>
                )}
              </div>

              {/* Pos vs Neg */}
              <div className="macd-card">
                <div className="macd-card-label">Positive vs Negative Momentum</div>
                {loading && !overview ? <Skel h={50} /> : (
                  <>
                    <div style={{ display:'flex', gap:10, marginBottom:6 }}>
                      {[
                        { label:'● Positive', color:GREEN, pct: overview?.positivePct ?? 0 },
                        { label:'● Negative', color:RED,   pct: overview?.negativePct ?? 0 },
                      ].map(({ label, color, pct }) => (
                        <div key={label}>
                          <div style={{ fontSize:10, color:'rgba(180,210,255,0.5)', marginBottom:2 }}>{label}</div>
                          <div className="macd-pn-val" style={{ color }}>{pct.toFixed(2)}%</div>
                        </div>
                      ))}
                    </div>
                    <div className="macd-pn-bar">
                      <div style={{
                        height:'100%', borderRadius:3,
                        width:`${overview?.positivePct ?? 50}%`,
                        background:`linear-gradient(to right, ${GREEN}, ${RED})`,
                      }} />
                    </div>
                  </>
                )}
              </div>

              {/* Historical */}
              <div className="macd-card">
                <div className="macd-card-label">Historical Normalized MACD</div>
                {loading && !overview ? <><Skel h={20} /><Skel h={20} /><Skel h={20} /></> : (
                  histMACD.slice(1).map(h => (
                    <div key={h.label} className="macd-hist-row">
                      <span className="macd-hist-label">{h.label}</span>
                      <span className="macd-hist-val" style={{
                        background: h.value >= 0 ? 'rgba(0,200,83,0.12)' : 'rgba(255,61,61,0.12)',
                        color:      h.value >= 0 ? GREEN : RED,
                      }}>
                        {h.value >= 0 ? '+' : ''}{h.value.toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>

            </div>

            {/* Chart panel */}
            <div className="macd-chart-panel">
              <div className="macd-ch-hdr">
                <span className="macd-ch-title">Crypto MACD Heatmap</span>
                <div className="macd-tf-grp">
                  {TF_LABELS.map(t => (
                    <button key={t} className={`macd-tfbtn ${tf === t ? 'on' : 'off'}`}
                      onClick={() => setTf(t)}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Heatmap chart area */}
              <div style={{ flex:1, minHeight:0, position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', inset:0 }}>
                  {loading && !coins.length ? (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                      height:'100%', color:'rgba(200,220,255,0.3)', fontSize:11 }}>
                      Loading heatmap…
                    </div>
                  ) : (
                    <MACDHeatmap coins={coins} tf={tf} />
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* MACD Line Chart */}
          <div style={{ padding:'0 16px 10px' }}>
            <div className="macd-chart-panel" style={{ height:280 }}>
              <div className="macd-ch-hdr">
                <span className="macd-ch-title">
                  MACD Chart — {coins.find(c => c.id === selectedCoin)?.name ?? selectedCoin} ({tf})
                </span>
                <div className="macd-tf-grp">
                  {TF_LABELS.map(t => (
                    <button key={t} className={`macd-tfbtn ${tf === t ? 'on' : 'off'}`}
                      onClick={() => setTf(t)}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Coin selector */}
              <div className="macd-coin-row">
                {coins.slice(0, 12).map(c => (
                  <button key={c.id}
                    className={`macd-coin-btn ${selectedCoin === c.id ? 'active' : ''}`}
                    onClick={() => setSelectedCoin(c.id)}
                    style={{ borderColor: selectedCoin === c.id ? c.color + '80' : undefined,
                             color:       selectedCoin === c.id ? c.color : undefined }}>
                    {c.symbol}
                  </button>
                ))}
              </div>

              <div className="macd-legend">
                {[
                  { type:'line', color:BLUE,   label:'MACD Line'  },
                  { type:'line', color:ORANGE, label:'Signal Line' },
                  { type:'dot',  color:GREEN,  label:'Bullish (Histogram)' },
                  { type:'dot',  color:RED,    label:'Bearish (Histogram)' },
                ].map(({ type, color, label }) => (
                  <div key={label} className="macd-leg-item">
                    {type === 'line'
                      ? <div className="macd-leg-line" style={{ background:color }} />
                      : <div className="macd-leg-dot"  style={{ background:color }} />}
                    {label}
                  </div>
                ))}
              </div>

              <div className="macd-chart-area">
                <div>
                  {chartLoading ? (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                      height:'100%', color:'rgba(200,220,255,0.3)', fontSize:11 }}>
                      Loading MACD chart…
                    </div>
                  ) : chartPts.length >= 2 ? (
                    <MACDChart points={chartPts} tf={tf} />
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                      height:'100%', color:'rgba(200,220,255,0.2)', fontSize:11 }}>
                      Not enough data for selected timeframe
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="macd-table-wrap  overflow-x-scroll">
            <div className="macd-table-hdr">Cryptocurrency MACD</div>
            <table className="macd-tbl">
              <thead>
                <tr>
                  <th onClick={() => thClick('id')} style={{ textAlign:'left' }}>#</th>
                  <th onClick={() => thClick('name')} style={{ textAlign:'left' }}>Name {thArr('name')}</th>
                  <th onClick={() => thClick('price')} className="r">Price {thArr('price')}</th>
                  <th onClick={() => thClick('marketCap')} className="r">Market Cap {thArr('marketCap')}</th>
                  <th onClick={() => thClick('volume24h')} className="r">Volume (24h) {thArr('volume24h')}</th>
                  <th onClick={() => thClick('change24h')} className="r">Price 24h % {thArr('change24h')}</th>
                  <th onClick={() => thClick('macd15m')} className="r">MACD (15m) {thArr('macd15m')}</th>
                  <th onClick={() => thClick('macd1h')}  className="r">MACD (1h) {thArr('macd1h')}</th>
                  <th onClick={() => thClick('macd4h')}  className="r">MACD (4h) {thArr('macd4h')}</th>
                  <th onClick={() => thClick('macd1d')}  className="r">MACD (1d) {thArr('macd1d')}</th>
                  <th onClick={() => thClick('macd7d')}  className="r">MACD (7d) {thArr('macd7d')}</th>
                </tr>
              </thead>
              <tbody>
                {loading && !coins.length ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}><td colSpan={11}><Skel h={26} mb={2} /></td></tr>
                  ))
                ) : sorted.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ color:'rgba(180,210,255,0.3)', fontSize:10 }}>{i + 1}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                        <img src={c.image} alt={c.symbol} width={18} height={18}
                          style={{ borderRadius:'50%' }}
                          onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                        <div>
                          <span style={{ color:'#e2f0ff', fontWeight:700 }}>{c.name}</span>
                          <span style={{ color:'rgba(180,210,255,0.4)', fontSize:9, marginLeft:5 }}>{c.symbol}</span>
                        </div>
                      </div>
                    </td>
                    <td className="r" style={{ color:'#c8d8f4' }}>{fmtPrice(c.price)}</td>
                    <td className="r" style={{ color:'rgba(180,210,255,0.7)' }}>{fmtMcap(c.marketCap)}</td>
                    <td className="r" style={{ color:'rgba(180,210,255,0.7)' }}>{fmtMcap(c.volume24h)}</td>
                    <td className="r" style={{ color: c.change24h >= 0 ? GREEN : RED, fontWeight:700 }}>
                      {c.change24h >= 0 ? '+' : ''}{c.change24h.toFixed(2)}%
                    </td>
                    {(['macd15m','macd1h','macd4h','macd1d','macd7d'] as const).map(key => {
                      const v = c[key];
                      return (
                        <td key={key} className="r">
                          <span className="macd-tbl-val" style={{
                            background: v > 0.3 ? 'rgba(0,200,83,0.1)' : v < -0.3 ? 'rgba(255,61,61,0.1)' : 'transparent',
                            color:      macdColor(v),
                          }}>
                            {v > 0 ? '+' : ''}{v.toFixed(2)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default MACDDashboard;