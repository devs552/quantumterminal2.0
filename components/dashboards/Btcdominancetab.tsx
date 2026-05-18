'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface DomSnapshot { btc: number; eth: number; others: number }
interface DominancePoint { date: string; btc: number; eth: number; others: number }
interface TopCoin {
  id: string; symbol: string; name: string; image: string;
  market_cap: number; dominance: number; price_change_24h: number;
}
interface ApiData {
  success: boolean;
  current: { btc: number; eth: number; bnb: number; usdt: number; sol: number; others: number };
  historical: { yesterday: DomSnapshot; lastWeek: DomSnapshot; lastMonth: DomSnapshot };
  yearly: {
    high: { date: string; btc: number; eth: number; others: number };
    low:  { date: string; btc: number; eth: number; others: number };
  };
  chart: DominancePoint[];
  topCoins: TopCoin[];
  othersPiePct: number;
  source: string;
  updatedAt: number;
  error?: string;
}
type ChartView = 'dominance' | 'topCoins';
type Range     = '30d' | '1y' | 'all';

// ── Constants ──────────────────────────────────────────────────────────────────
const BTC_COLOR    = '#f7931a';
const ETH_COLOR    = '#627eea';
const OTHERS_COLOR = '#8b9dbd';

const COIN_COLORS: Record<string, string> = {
  BTC:    '#f7931a',
  ETH:    '#627eea',
  USDT:   '#26a17b',
  BNB:    '#f0b90b',
  SOL:    '#9945ff',
  XRP:    '#346aa9',
  USDC:   '#2775ca',
  ADA:    '#0033ad',
  DOGE:   '#c2a633',
  TRX:    '#e50915',
  Others: '#6b7280',
};
function coinColor(symbol: string) {
  return COIN_COLORS[symbol] ?? COIN_COLORS.Others;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const p1  = (n: number) => n.toFixed(1) + '%';
const p2  = (n: number) => n.toFixed(2) + '%';
const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
function fmtMcap(n: number) {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(1) + 'B';
  return '$' + (n / 1e6).toFixed(0) + 'M';
}
function sliceDates(data: DominancePoint[], range: Range) {
  if (range === '30d') return data.slice(-30);
  if (range === '1y')  return data.slice(-365);
  return data;
}

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
  .btcd-root {
    display:flex; flex-direction:column; height:100%;
    background:#0a0f1e;
    font-family:"IBM Plex Mono","Courier New",monospace;
    color:#c8d8f4; overflow:hidden; box-sizing:border-box;
  }
  .btcd-hdr { padding:11px 16px 8px; flex-shrink:0; border-bottom:1px solid rgba(255,255,255,0.06); }
  .btcd-hrow { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px; }
  /* body scrolls; top panel is a fixed-height flex row so the chart gets real px */
  .btcd-body { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden;
    display:flex; flex-direction:column; }
  /* ── top panel — fixed height so chart canvas resolves clientHeight ── */
  .btcd-top {
    display:flex; gap:10px; padding:10px 16px;
    flex-shrink:0;
    height:420px;       /* explicit height → chart panel fills this */
  }
  .btcd-sidebar {
    width:260px; flex-shrink:0;
    display:flex; flex-direction:column; gap:8px;
    overflow-y:auto; overflow-x:hidden;
  }
  .btcd-card {
    background:rgba(255,255,255,0.025);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; padding:12px 14px;
  }
  .btcd-card-title { font-size:11px; font-weight:700; color:rgba(200,220,255,0.55);
    text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px; }
  /* dominance numbers */
  .btcd-dom-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-bottom:8px; }
  .btcd-dom-val  { font-size:22px; font-weight:900; line-height:1; }
  .btcd-dom-chg  { font-size:10px; margin-top:2px; font-weight:600; }
  /* stacked bar */
  .btcd-bar-track { height:7px; border-radius:4px; display:flex; overflow:hidden; margin-top:6px; }
  /* hist row */
  .btcd-hist-row {
    display:flex; justify-content:space-between; align-items:center;
    padding:5px 0; border-bottom:1px solid rgba(255,255,255,0.05); gap:6px;
  }
  .btcd-hist-row:last-child { border-bottom:none; }
  .btcd-hist-label { font-size:11px; color:rgba(180,210,255,0.6); flex-shrink:0; width:70px; }
  .btcd-pill {
    display:inline-flex; align-items:center; gap:4px;
    padding:2px 7px; border-radius:4px; font-size:10px; font-weight:700;
    background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
  }
  /* chart panel — must fill .btcd-top height explicitly */
  .btcd-chart-panel {
    flex:1; min-width:0;
    height:100%; box-sizing:border-box;
    display:flex; flex-direction:column;
    background:rgba(255,255,255,0.02);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; overflow:hidden;
  }
  .btcd-ch-hdr {
    padding:9px 14px; display:flex; justify-content:space-between; align-items:center;
    border-bottom:1px solid rgba(255,255,255,0.05); flex-wrap:wrap; gap:6px; flex-shrink:0;
  }
  .btcd-ch-title { font-size:13px; font-weight:700; color:#e2f0ff; }
  .btcd-legend { display:flex; gap:12px; padding:5px 14px; flex-shrink:0; flex-wrap:wrap;
    border-bottom:1px solid rgba(255,255,255,0.04); }
  .btcd-leg-item { display:flex; align-items:center; gap:4px; font-size:10px; color:rgba(180,210,255,0.5); }
  .btcd-leg-dot  { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  /* chart-area: flex:1 makes it fill remaining panel height; position:relative lets canvas fill it */
  .btcd-chart-area {
    flex:1; min-height:0; min-width:0;
    position:relative; overflow:hidden;
  }
  /* canvas fills the chart-area via absolute positioning */
  .btcd-chart-area > div {
    position:absolute; inset:0; width:100%; height:100%;
  }
  /* view toggle group */
  .btcd-view-grp { display:flex; gap:2px; }
  .btcd-vbtn {
    border-radius:3px; font-family:monospace; font-size:10px;
    cursor:pointer; padding:2px 9px; transition:all .15s; line-height:1.6;
  }
  .btcd-vbtn.on-view {
    background:rgba(247,147,26,0.22); border:1px solid rgba(247,147,26,0.5); color:#f7931a; }
  .btcd-vbtn.off-view {
    background:transparent; border:1px solid rgba(255,255,255,0.1); color:rgba(200,220,255,0.3); }
  .btcd-vbtn.off-view:hover { border-color:rgba(255,255,255,0.2); color:rgba(200,220,255,0.6); }
  /* range toggle */
  .btcd-range-grp { display:flex; gap:2px; }
  .btcd-rbtn {
    border-radius:3px; font-family:monospace; font-size:10px;
    cursor:pointer; padding:2px 8px; transition:all .15s; line-height:1.6;
  }
  .btcd-rbtn.on-range  { background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); color:#e2f0ff; }
  .btcd-rbtn.off-range { background:transparent; border:1px solid rgba(255,255,255,0.1); color:rgba(200,220,255,0.3); }
  .btcd-rbtn.off-range:hover { border-color:rgba(255,255,255,0.22); color:rgba(200,220,255,0.6); }
  /* skeleton */
  @keyframes btcd-pulse { 0%,100%{opacity:.35} 50%{opacity:.12} }
  .btcd-skel { background:rgba(255,255,255,0.08); border-radius:4px; animation:btcd-pulse 1.4s ease-in-out infinite; }
  /* about */
  .btcd-about { padding:10px 16px 14px; flex-shrink:0; }
  .btcd-accord { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; overflow:hidden; }
  .btcd-accord-hdr { padding:10px 14px; cursor:pointer; display:flex;
    justify-content:space-between; align-items:center; }
  /* scroll */
  .btcd-body::-webkit-scrollbar { width:4px; }
  .btcd-body::-webkit-scrollbar-track { background:transparent; }
  .btcd-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
  /* responsive */
  @media(max-width:760px){
    .btcd-top { flex-direction:column; height:auto; min-height:500px; }
    .btcd-sidebar { width:100%; flex-direction:row; flex-wrap:wrap; overflow:visible; }
    .btcd-card { flex:1 1 200px; }
    .btcd-chart-panel { flex:none; height:300px; min-height:300px; }
  }
  @media(max-width:500px){
    .btcd-sidebar { flex-direction:column; }
    .btcd-card { flex:unset; }
    .btcd-top,.btcd-about { padding-left:8px; padding-right:8px; }
    .btcd-dom-val { font-size:18px; }
  }
`;

// ── Skeleton ───────────────────────────────────────────────────────────────────
const Skel: React.FC<{ h?: number; mb?: number }> = ({ h = 14, mb = 6 }) => (
  <div className="btcd-skel" style={{ height: h, marginBottom: mb }} />
);

// ── Pill badge ─────────────────────────────────────────────────────────────────
const Pill: React.FC<{ color: string; value: number }> = ({ color, value }) => (
  <span className="btcd-pill" style={{ borderColor: color + '40', color }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
    {p1(value)}
  </span>
);

// ── Stacked bar ────────────────────────────────────────────────────────────────
const StackedBar: React.FC<{ btc: number; eth: number; others: number }> = ({ btc, eth, others }) => (
  <div className="btcd-bar-track">
    <div style={{ width: `${btc}%`, background: BTC_COLOR }} />
    <div style={{ width: `${eth}%`, background: ETH_COLOR }} />
    <div style={{ width: `${others}%`, background: OTHERS_COLOR }} />
  </div>
);

// ── Toggle helpers ─────────────────────────────────────────────────────────────
const ViewToggle: React.FC<{ value: ChartView; onChange: (v: ChartView) => void }> = ({ value, onChange }) => (
  <div className="btcd-view-grp">
    {(['dominance', 'topCoins'] as ChartView[]).map(v => (
      <button key={v} className={`btcd-vbtn ${value === v ? 'on-view' : 'off-view'}`}
        onClick={() => onChange(v)}>
        {v === 'dominance' ? 'Bitcoin Dominance' : 'Top Coins'}
      </button>
    ))}
  </div>
);

const RangeToggle: React.FC<{ value: Range; onChange: (v: Range) => void }> = ({ value, onChange }) => (
  <div className="btcd-range-grp">
    {(['30d', '1y', 'all'] as Range[]).map(v => (
      <button key={v} className={`btcd-rbtn ${value === v ? 'on-range' : 'off-range'}`}
        onClick={() => onChange(v)}>
        {v === 'all' ? 'All' : v}
      </button>
    ))}
  </div>
);

// ── Dominance Line Chart ───────────────────────────────────────────────────────
const DominanceChart: React.FC<{ data: DominancePoint[]; range: Range }> = ({ data, range }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tipIdx, setTipIdx] = useState<number | null>(null);

  const sliced = sliceDates(data, range);
  const n      = sliced.length;

  const draw = useCallback(() => {
    const canvas = canvasRef.current; const cont = containerRef.current;
    if (!canvas || !cont || n < 2) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;
    const W = cont.clientWidth; const H = cont.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR); ctx.clearRect(0, 0, W, H);

    const PAD = { top: 14, right: 58, bottom: 28, left: 10 };
    const cw  = W - PAD.left - PAD.right;
    const ch  = H - PAD.top  - PAD.bottom;

    const toX = (i: number) => PAD.left + (i / (n - 1)) * cw;
    const toY = (v: number) => PAD.top + ch - (v / 100) * ch;

    const fsz = Math.max(8, Math.min(10, W / 70));

    // Grid lines + right % labels
    [0, 25, 50, 75, 100].forEach(v => {
      const y = toY(v);
      ctx.setLineDash([3, 6]); ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(200,220,255,0.35)'; ctx.font = `${fsz}px monospace`;
      ctx.textAlign = 'left'; ctx.fillText(v + '.00%', W - PAD.right + 4, y + 3);
    });

    // X-axis labels
    const xN = Math.max(2, Math.min(8, Math.floor(W / 80)));
    ctx.fillStyle = 'rgba(180,200,240,0.3)'; ctx.font = `${fsz}px monospace`; ctx.textAlign = 'center';
    for (let i = 0; i < xN; i++) {
      const idx = Math.floor((i / (xN - 1)) * (n - 1));
      const d = new Date(sliced[idx].date);
      const lbl = range === '30d'
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '01 Jan ' + d.getFullYear();
      ctx.fillText(lbl, toX(idx), H - 5);
    }

    // Draw a line series
    const drawLine = (
      vals: number[], color: string, width = 1.5,
      badge?: { text: string; color: string }
    ) => {
      ctx.beginPath();
      vals.forEach((v, i) => { i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); });
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();

      if (badge) {
        const lx = toX(n - 1); const ly = toY(vals[n - 1]);
        ctx.font = `bold 10px monospace`;
        const bw = ctx.measureText(badge.text).width + 10;
        ctx.fillStyle = badge.color;
        ctx.beginPath(); ctx.roundRect(lx - bw - 3, ly - 9, bw, 18, 3); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText(badge.text, lx - 3 - bw / 2, ly + 4);
      }
    };

    const btcVals    = sliced.map(d => d.btc);
    const ethVals    = sliced.map(d => d.eth);
    const othersVals = sliced.map(d => d.others);

    drawLine(othersVals, OTHERS_COLOR, 1.3);
    drawLine(ethVals,    ETH_COLOR,    1.5, { text: p2(ethVals[n - 1]),    color: ETH_COLOR    });
    drawLine(btcVals,    BTC_COLOR,    2.0, { text: p2(btcVals[n - 1]),    color: BTC_COLOR    });

    // Crosshair
    if (tipIdx !== null && sliced[tipIdx]) {
      const tx = toX(tipIdx);
      ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, PAD.top); ctx.lineTo(tx, PAD.top + ch); ctx.stroke();
      ctx.setLineDash([]);
      // Dots
      [[btcVals, BTC_COLOR], [ethVals, ETH_COLOR], [othersVals, OTHERS_COLOR]].forEach(([arr, col]) => {
        const vals = arr as number[]; const color = col as string;
        ctx.beginPath(); ctx.arc(tx, toY(vals[tipIdx]), 4, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
      });
    }
  }, [sliced, n, range, tipIdx]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current; if (!c || n < 2) return;
    const r = c.getBoundingClientRect();
    const cw = c.clientWidth - 10 - 58;
    setTipIdx(Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left - 10) / cw * (n - 1)))));
  };

  const tipD = tipIdx !== null ? sliced[tipIdx] : null;
  const tipXPct = tipIdx !== null ? tipIdx / Math.max(n - 1, 1) : 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => setTipIdx(null)} />
      {tipD && (
        <div style={{
          position: 'absolute',
          left: tipXPct > 0.65 ? undefined : `calc(${tipXPct * 100}% + 14px)`,
          right: tipXPct > 0.65 ? '65px' : undefined,
          top: 16,
          background: 'rgba(5,10,28,0.97)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6, padding: '9px 13px', fontSize: 10, color: '#a8c0f0',
          pointerEvents: 'none', zIndex: 20, fontFamily: 'monospace', minWidth: 185,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}>
          <div style={{ color: 'rgba(200,220,255,0.5)', marginBottom: 6,
            borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 5 }}>
            {fmtDate(tipD.date)}
          </div>
          {[
            { label: 'Bitcoin',  val: tipD.btc,    color: BTC_COLOR    },
            { label: 'Ethereum', val: tipD.eth,    color: ETH_COLOR    },
            { label: 'Others',   val: tipD.others, color: OTHERS_COLOR },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(180,200,240,0.65)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                {label}:
              </span>
              <span style={{ color, fontWeight: 800 }}>{p2(val)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Donut / Pie Chart (Top Coins) ──────────────────────────────────────────────
const DonutChart: React.FC<{ topCoins: TopCoin[]; othersPct: number }> = ({ topCoins, othersPct }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovIdx, setHovIdx] = useState<number | null>(null);

  // Build slices: top coins + Others
  const slices = [
    ...topCoins.map((c, i) => ({ label: c.symbol, pct: c.dominance, color: coinColor(c.symbol), idx: i })),
    { label: 'Others', pct: othersPct, color: COIN_COLORS.Others, idx: topCoins.length },
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

    // Right half for donut, left for legend
    const legendW = Math.min(180, W * 0.38);
    const donutX  = legendW + (W - legendW) / 2;
    const donutY  = H / 2;
    const outerR  = Math.min((W - legendW) / 2, H / 2) * 0.80;
    const innerR  = outerR * 0.60;
    const gap     = 0.013;

    let angle = -Math.PI / 2;
    slices.forEach((s, si) => {
      const sweep  = (s.pct / 100) * Math.PI * 2 - gap;
      const isHov  = hovIdx === si;
      const ro     = isHov ? outerR * 1.06 : outerR;

      ctx.beginPath();
      ctx.arc(donutX, donutY, ro,     angle, angle + sweep);
      ctx.arc(donutX, donutY, innerR, angle + sweep, angle, true);
      ctx.closePath();
      ctx.fillStyle = isHov ? s.color : s.color + 'cc';
      ctx.fill();
      if (isHov) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
      angle += sweep + gap;
    });

    // Centre text
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (hovIdx !== null && slices[hovIdx]) {
      const s = slices[hovIdx];
      ctx.fillStyle = s.color; ctx.font = `bold 12px monospace`;
      ctx.fillText(s.label, donutX, donutY - 10);
      ctx.fillStyle = '#fff'; ctx.font = `bold 16px monospace`;
      ctx.fillText(p1(s.pct), donutX, donutY + 8);
    } else {
      ctx.fillStyle = 'rgba(180,210,255,0.45)'; ctx.font = `10px monospace`;
      ctx.fillText('Total Market', donutX, donutY - 10);
      ctx.fillStyle = '#e2f0ff'; ctx.font = `bold 13px monospace`;
      ctx.fillText('Dominance', donutX, donutY + 8);
    }

    // Legend (left side)
    const lineH = Math.min(22, H / (slices.length + 1));
    const startY = (H - slices.length * lineH) / 2;
    ctx.textBaseline = 'middle'; ctx.font = `${Math.max(9, Math.min(11, H / 22))}px monospace`;
    slices.forEach((s, si) => {
      const y = startY + si * lineH;
      const isHov = hovIdx === si;
      ctx.beginPath(); ctx.arc(10, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = s.color; ctx.fill();
      ctx.fillStyle = isHov ? '#fff' : 'rgba(180,210,255,0.7)';
      ctx.textAlign = 'left';
      ctx.fillText(s.label, 22, y);
      ctx.textAlign = 'right'; ctx.fillStyle = isHov ? s.color : 'rgba(180,210,255,0.5)';
      ctx.fillText(p1(s.pct), legendW - 4, y);
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
    const legendW = Math.min(180, cont.clientWidth * 0.38);
    const donutX  = legendW + (cont.clientWidth - legendW) / 2;
    const donutY  = cont.clientHeight / 2;
    const outerR  = Math.min((cont.clientWidth - legendW) / 2, cont.clientHeight / 2) * 0.80;
    const innerR  = outerR * 0.60;
    const dx = mx - donutX; const dy = my - donutY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < innerR || dist > outerR * 1.1) { setHovIdx(null); return; }
    let a = Math.atan2(dy, dx) + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    let start = 0;
    const gap = 0.013;
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

// ── About accordion ────────────────────────────────────────────────────────────
const About: React.FC = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="btcd-about">
      <div style={{ fontSize: 15, fontWeight: 700, color: '#e2f0ff', marginBottom: 10 }}>
        About Bitcoin Dominance
      </div>
      <div className="btcd-accord">
        <div className="btcd-accord-hdr" onClick={() => setOpen(o => !o)}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#ddf0ff' }}>What is Bitcoin dominance?</span>
          <span style={{ color: 'rgba(200,220,255,0.4)', fontSize: 14, lineHeight: 1 }}>{open ? '∧' : '∨'}</span>
        </div>
        {open && (
          <div style={{ padding: '10px 14px', fontSize: 11, color: 'rgba(180,210,255,0.55)', lineHeight: 1.75,
            borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            Bitcoin (BTC) dominance is a metric used to measure the relative market share or dominance of Bitcoin
            in the overall cryptocurrency market. It represents the percentage of Bitcoin's total market capitalization
            compared to the total market capitalization of all cryptocurrencies combined. Since Bitcoin was the first
            asset, it has remained the largest by market cap, which is why its dominance in the market is a number
            that many investors watch closely. A rising BTC dominance typically signals capital flowing into Bitcoin
            relative to altcoins, while falling dominance may indicate an "altcoin season."
            Data sourced from <span style={{ color: 'rgba(247,147,26,0.7)' }}>CoinGecko Free API</span>.
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const BtcDominanceTab: React.FC = () => {
  const [data,    setData]    = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [updated, setUpdated] = useState('');
  const [view,    setView]    = useState<ChartView>('dominance');
  const [range,   setRange]   = useState<Range>('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res  = await fetch('/api/btcdominance');
      const json: ApiData = await res.json();
      if (!json.success) throw new Error(json.error ?? 'API error');
      setData(json);
      console.log("data",json)
      setUpdated(new Date().toLocaleTimeString());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(fetchData, 300_000); // refresh every 5 min
    return () => clearInterval(id);
  }, [fetchData]);

  const cur  = data?.current;
  const hist = data?.historical;
  const yr   = data?.yearly;

  // compute 24h changes from yesterday snapshot
  const btcChg  = cur && hist ? cur.btc  - hist.yesterday.btc  : 0;
  const ethChg  = cur && hist ? cur.eth  - hist.yesterday.eth  : 0;
  const othChg  = cur && hist ? cur.others - hist.yesterday.others : 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="btcd-root">

        {/* ── Header ── */}
        <div className="btcd-hdr">
          <div className="btcd-hrow">
            <span style={{ fontSize: 16, fontWeight: 800, color: '#e2f0ff' }}>Bitcoin Dominance</span>
            <button style={{
              background: 'rgba(247,147,26,0.1)', border: '1px solid rgba(247,147,26,0.3)',
              color: '#f7931a', padding: '2px 10px', fontSize: 10, cursor: 'pointer',
              borderRadius: 4, fontFamily: 'monospace',
            }}>See API Details</button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {data && <span style={{ fontSize: 9, color: 'rgba(200,220,255,0.3)', lineHeight: 1.6 }}>
                {data.source}<br />Updated: {updated}
              </span>}
              <button onClick={fetchData} disabled={loading} style={{
                background: 'rgba(247,147,26,0.08)', border: '1px solid rgba(247,147,26,0.2)',
                color: '#f7931a', padding: '3px 10px', fontSize: 10,
                cursor: loading ? 'default' : 'pointer', borderRadius: 3,
                fontFamily: 'monospace', opacity: loading ? 0.5 : 1,
              }}>{loading ? '↻ Loading…' : '↺ Refresh'}</button>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(200,220,255,0.32)', lineHeight: 1.5 }}>
            Bitcoin (BTC) dominance is a metric used to measure the relative market share or dominance of Bitcoin
            in the overall cryptocurrency sector. It represents the percentage of Bitcoin's total market capitalization
            compared to the total market capitalization of all cryptocurrencies combined.
          </div>
        </div>

        {error && (
          <div style={{ margin: '6px 16px 0', background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5',
            padding: '6px 12px', borderRadius: 5, fontSize: 11, flexShrink: 0 }}>
            ⚠ {error}
          </div>
        )}

        <div className="btcd-body">
          {/* ── Top panel ── */}
          <div className="btcd-top">

            {/* Sidebar */}
            <div className="btcd-sidebar">

              {/* Current Dominance */}
              <div className="btcd-card">
                <div className="btcd-card-title">Bitcoin Dominance</div>
                {loading && !cur ? (
                  <><Skel h={28} /><Skel h={10} mb={4} /><Skel h={7} /></>
                ) : cur ? (
                  <>
                    {/* Legend dots */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                      {[['Bitcoin', BTC_COLOR], ['Ethereum', ETH_COLOR], ['Others', OTHERS_COLOR]].map(([l, c]) => (
                        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(180,210,255,0.55)' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: c as string, display: 'inline-block' }} />
                          {l}
                        </span>
                      ))}
                    </div>
                    {/* Values */}
                    <div className="btcd-dom-grid">
                      <div>
                        <div className="btcd-dom-val" style={{ color: BTC_COLOR }}>{p1(cur.btc)}</div>
                        <div className="btcd-dom-chg" style={{ color: btcChg >= 0 ? '#22c55e' : '#ef4444' }}>
                          {btcChg >= 0 ? '▲' : '▼'} {Math.abs(btcChg).toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="btcd-dom-val" style={{ color: ETH_COLOR }}>{p1(cur.eth)}</div>
                        <div className="btcd-dom-chg" style={{ color: ethChg >= 0 ? '#22c55e' : '#ef4444' }}>
                          {ethChg >= 0 ? '▲' : '▼'} {Math.abs(ethChg).toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="btcd-dom-val" style={{ color: OTHERS_COLOR }}>{p1(cur.others)}</div>
                        <div className="btcd-dom-chg" style={{ color: othChg >= 0 ? '#22c55e' : '#ef4444' }}>
                          {othChg >= 0 ? '▲' : '▼'} {Math.abs(othChg).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    <StackedBar btc={cur.btc} eth={cur.eth} others={cur.others} />
                  </>
                ) : null}
              </div>

              {/* Historical Values */}
              <div className="btcd-card">
                <div className="btcd-card-title">Historical Values</div>
                {loading && !hist ? (
                  <><Skel h={20} /><Skel h={20} /><Skel h={20} /></>
                ) : hist ? (
                  <>
                    {([
                      { label: 'Yesterday', d: hist.yesterday },
                      { label: 'Last Week',  d: hist.lastWeek  },
                      { label: 'Last Month', d: hist.lastMonth },
                    ] as const).map(({ label, d }) => (
                      <div key={label} className="btcd-hist-row">
                        <span className="btcd-hist-label">{label}</span>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <Pill color={BTC_COLOR}    value={d.btc}    />
                          <Pill color={ETH_COLOR}    value={d.eth}    />
                          <Pill color={OTHERS_COLOR} value={d.others} />
                        </div>
                      </div>
                    ))}
                  </>
                ) : null}
              </div>

              {/* Yearly High & Low */}
              <div className="btcd-card">
                <div className="btcd-card-title">Yearly High and Low</div>
                {loading && !yr ? (
                  <><Skel h={32} /><Skel h={32} /></>
                ) : yr ? (
                  <>
                    {([
                      { label: 'Yearly High', d: yr.high },
                      { label: 'Yearly Low',  d: yr.low  },
                    ] as const).map(({ label, d }) => (
                      <div key={label} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: 'rgba(180,210,255,0.4)', marginBottom: 4 }}>
                          {label} ({fmtDate(d.date)})
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <Pill color={BTC_COLOR}    value={d.btc}    />
                          <Pill color={ETH_COLOR}    value={d.eth}    />
                          <Pill color={OTHERS_COLOR} value={d.others} />
                        </div>
                      </div>
                    ))}
                  </>
                ) : null}
              </div>

            </div>

            {/* Chart Panel */}
            <div className="btcd-chart-panel">
              <div className="btcd-ch-hdr">
                <span className="btcd-ch-title">Bitcoin Dominance Chart</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <ViewToggle  value={view}  onChange={setView}  />
                  {view === 'dominance' && <RangeToggle value={range} onChange={setRange} />}
                </div>
              </div>

              {/* Legend */}
              {view === 'dominance' ? (
                <div className="btcd-legend">
                  {[
                    { color: BTC_COLOR,    label: 'Bitcoin'  },
                    { color: ETH_COLOR,    label: 'Ethereum' },
                    { color: OTHERS_COLOR, label: 'Others'   },
                  ].map(({ color, label }) => (
                    <div key={label} className="btcd-leg-item">
                      <span className="btcd-leg-dot" style={{ background: color }} />
                      {label}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="btcd-legend">
                  {(data?.topCoins ?? []).slice(0, 6).map(c => (
                    <div key={c.symbol} className="btcd-leg-item">
                      <span className="btcd-leg-dot" style={{ background: coinColor(c.symbol) }} />
                      {c.symbol}
                    </div>
                  ))}
                  <div className="btcd-leg-item">
                    <span className="btcd-leg-dot" style={{ background: COIN_COLORS.Others }} />
                    Others
                  </div>
                </div>
              )}

              {/* Chart area */}
              <div className="btcd-chart-area">
                {loading && !data?.chart?.length ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: '100%', color: 'rgba(200,220,255,0.3)', fontSize: 12 }}>
                    Loading chart data…
                  </div>
                ) : view === 'dominance' && data?.chart?.length ? (
                  <DominanceChart data={data.chart} range={range} /> 
                ) : view === 'topCoins' && data?.topCoins?.length ? (
                  <DonutChart topCoins={data.topCoins} othersPct={data.othersPiePct} />
                ) : "no data available"}
              </div>
            </div>

          </div>

          {/* Top coins table (bonus below chart) */}
          {data?.topCoins?.length ? (
            <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2f0ff', marginBottom: 8 }}>
                Top Coins by Market Cap Dominance
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    {['Coin', 'Symbol', 'Market Cap', 'Dominance', '24h Change'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10,
                        fontWeight: 600, color: 'rgba(180,210,255,0.4)',
                        borderBottom: '1px solid rgba(255,255,255,0.07)', letterSpacing: '.04em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.topCoins.map((c, i) => (
                    <tr key={c.id}
                      style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(247,147,26,0.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent')}
                    >
                      <td style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 7 }}>
                        <img src={c.image} alt={c.symbol} width={18} height={18}
                          style={{ borderRadius: '50%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <span style={{ color: '#e2f0ff', fontWeight: 700 }}>{c.name}</span>
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{ background: coinColor(c.symbol) + '1a', color: coinColor(c.symbol),
                          border: `1px solid ${coinColor(c.symbol)}40`, padding: '1px 6px', borderRadius: 3,
                          fontSize: 10, fontWeight: 700 }}>
                          {c.symbol}
                        </span>
                      </td>
                      <td style={{ padding: '7px 10px', color: 'rgba(180,210,255,0.7)' }}>{fmtMcap(c.market_cap)}</td>
                      <td style={{ padding: '7px 10px', color: '#e2f0ff', fontWeight: 600 }}>{p2(c.dominance)}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 600,
                        color: c.price_change_24h >= 0 ? '#22c55e' : '#ef4444' }}>
                        {c.price_change_24h >= 0 ? '▲' : '▼'} {Math.abs(c.price_change_24h).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {/* About */}
          <About />
        </div>
      </div>
    </>
  );
};

export default BtcDominanceTab;