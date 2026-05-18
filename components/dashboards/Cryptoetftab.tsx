'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface FlowPoint { date: string; btcFlow: number; ethFlow: number; btcAum: number; ethAum: number; totalAum: number }
interface AumPctPoint { date: string; btcAum: number; ethAum: number; totalAum: number; btcPct: number; ethPct: number; totalPct: number }
interface EtfRow {
  ticker: string; name: string; coin: string; type: string; fee: number;
  price: number; volume: number; aum: number; marketCap: number;
  premium: number; change24h: number;
}
interface ApiData {
  success: boolean;
  todayDate: string;
  todayNetFlow: number; btcFlow: number; ethFlow: number;
  historical: { lastWeek: number; lastMonth: number; last3Months: number };
  yearly: { strongest: { label: string; value: number }; weakest: { label: string; value: number } };
  aum: { total: number; btc: number; eth: number; btcPct: number; ethPct: number; totalPct: number };
  flowHistory: FlowPoint[];
  aumPctHistory: AumPctPoint[];
  etfTable: EtfRow[];
  btcPrice: number; ethPrice: number;
  source: string; updatedAt: number; error?: string;
}
type Range = '30d' | '1y' | 'all';
type ChartView = 'coins' | 'funds';
type TableTab = 'overview' | 'flows';

// ── Colours ────────────────────────────────────────────────────────────────────
const BTC_COLOR = '#f7931a';
const ETH_COLOR = '#627eea';
const TOT_COLOR = '#94a3b8';

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtFlow(n: number, showSign = true) {
  const sign = showSign ? (n >= 0 ? '+' : '-') : '';
  const abs = Math.abs(n);
  if (abs >= 1e9) return sign + '$' + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return sign + '$' + (abs / 1e3).toFixed(1) + 'K';
  return sign + '$' + abs.toFixed(0);
}
function fmtB(n: number) {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(1)  + 'M';
  return '$' + n.toFixed(0);
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function sliceRange<T>(arr: T[], range: Range): T[] {
  if (range === '30d') return arr.slice(-22);  // ~22 trading days
  if (range === '1y')  return arr.slice(-252);
  return arr;
}
function flowColor(v: number) { return v >= 0 ? BTC_COLOR : '#3b82f6'; }

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
  .etf-root {
    display:flex; flex-direction:column; height:100%;
    background:#090f1e; font-family:"IBM Plex Mono","Courier New",monospace;
    color:#c8d8f4; overflow:hidden; box-sizing:border-box;
  }
  .etf-hdr { padding:10px 16px 8px; flex-shrink:0; border-bottom:1px solid rgba(255,255,255,0.06); }
  .etf-hrow { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .etf-body { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; display:flex; flex-direction:column; }
  /* ── top panel: sidebar + bar chart ── */
  .etf-top  { display:flex; gap:10px; padding:10px 16px; flex-shrink:0; height:300px; }
  .etf-sidebar { width:240px; flex-shrink:0; display:flex; flex-direction:column; gap:8px; overflow:hidden; }
  .etf-card {
    background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; padding:11px 13px; flex-shrink:0;
  }
  .etf-card-title { font-size:10px; font-weight:700; color:rgba(200,220,255,0.45);
    text-transform:uppercase; letter-spacing:.07em; margin-bottom:8px; }
  .etf-netflow-big { font-size:22px; font-weight:900; line-height:1; margin-bottom:2px; }
  .etf-hist-row { display:flex; justify-content:space-between; align-items:center;
    padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05); }
  .etf-hist-row:last-child { border-bottom:none; }
  .etf-hist-lbl { font-size:10px; color:rgba(180,210,255,0.55); }
  .etf-hist-val { font-size:11px; font-weight:700; }
  /* bar chart panel */
  .etf-bar-panel {
    flex:1; min-width:0; height:100%;
    display:flex; flex-direction:column;
    background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; overflow:hidden; box-sizing:border-box;
  }
  /* ── middle row: AUM + AUM% ── */
  .etf-mid { display:flex; gap:10px; padding:0 16px 10px; flex-shrink:0; height:260px; }
  .etf-mid-panel {
    flex:1; min-width:0; height:100%; display:flex; flex-direction:column;
    background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; overflow:hidden; box-sizing:border-box;
  }
  /* chart panel shared */
  .etf-ch-hdr {
    padding:8px 13px; display:flex; justify-content:space-between; align-items:center;
    border-bottom:1px solid rgba(255,255,255,0.05); flex-wrap:wrap; gap:6px; flex-shrink:0;
  }
  .etf-ch-title { font-size:12px; font-weight:700; color:#e2f0ff; }
  .etf-legend { display:flex; gap:12px; padding:4px 13px; flex-shrink:0; flex-wrap:wrap;
    border-bottom:1px solid rgba(255,255,255,0.04); }
  .etf-leg-item { display:flex; align-items:center; gap:4px; font-size:10px; color:rgba(180,210,255,0.5); }
  .etf-leg-dot  { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
  .etf-chart-area { flex:1; min-height:0; position:relative; overflow:hidden; }
  .etf-chart-area > div { position:absolute; inset:0; }
  /* table */
  .etf-table-sec { padding:0 16px 14px; flex-shrink:0; }
  .etf-tabs { display:flex; gap:4px; margin-bottom:10px; }
  .etf-tab-btn {
    padding:4px 14px; border-radius:4px; font-size:11px; cursor:pointer;
    font-family:monospace; transition:all .15s; border:1px solid rgba(255,255,255,0.1);
  }
  .etf-tab-btn.on  { background:rgba(247,147,26,0.18); border-color:rgba(247,147,26,0.45); color:#f7931a; }
  .etf-tab-btn.off { background:transparent; color:rgba(200,220,255,0.35); }
  .etf-tab-btn.off:hover { color:rgba(200,220,255,0.65); border-color:rgba(255,255,255,0.18); }
  .etf-tbl { width:100%; border-collapse:collapse; font-size:11px; }
  .etf-tbl th { padding:7px 10px; text-align:left; font-size:9px; font-weight:600;
    color:rgba(180,210,255,0.4); border-bottom:1px solid rgba(255,255,255,0.07);
    letter-spacing:.05em; cursor:pointer; white-space:nowrap; user-select:none; }
  .etf-tbl td { padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.04); white-space:nowrap; }
  .etf-tbl tr:hover td { background:rgba(247,147,26,0.04); }
  /* toggle */
  .etf-tog { display:flex; gap:2px; }
  .etf-tbtn {
    border-radius:3px; font-family:monospace; font-size:10px;
    cursor:pointer; padding:2px 7px; line-height:1.6; transition:all .15s;
  }
  .etf-tbtn.on  { background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); color:#e2f0ff; }
  .etf-tbtn.off { background:transparent; border:1px solid rgba(255,255,255,0.1); color:rgba(200,220,255,0.3); }
  .etf-tbtn.off:hover { border-color:rgba(255,255,255,0.22); color:rgba(200,220,255,0.65); }
  /* coin toggle */
  .etf-vtog { display:flex; gap:2px; }
  .etf-vbtn {
    border-radius:3px; font-family:monospace; font-size:10px;
    cursor:pointer; padding:2px 7px; line-height:1.6; transition:all .15s;
  }
  .etf-vbtn.on  { background:rgba(247,147,26,0.18); border:1px solid rgba(247,147,26,0.45); color:#f7931a; }
  .etf-vbtn.off { background:transparent; border:1px solid rgba(255,255,255,0.1); color:rgba(200,220,255,0.3); }
  /* skeleton */
  @keyframes etf-pulse { 0%,100%{opacity:.35} 50%{opacity:.12} }
  .etf-skel { background:rgba(255,255,255,0.08); border-radius:4px; animation:etf-pulse 1.4s ease-in-out infinite; }
  /* responsive */
  @media(max-width:800px){
    .etf-top { flex-direction:column; height:auto; }
    .etf-sidebar { width:100%; flex-direction:row; flex-wrap:wrap; overflow:visible; }
    .etf-card { flex:1 1 180px; }
    .etf-bar-panel { flex:none; height:240px; }
    .etf-mid  { flex-direction:column; height:auto; }
    .etf-mid-panel { flex:none; height:220px; }
  }
  @media(max-width:520px){
    .etf-sidebar { flex-direction:column; }
    .etf-card { flex:unset; }
    .etf-top,.etf-mid,.etf-table-sec { padding-left:8px; padding-right:8px; }
  }
  .etf-body::-webkit-scrollbar { width:4px; }
  .etf-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
`;

// ── Shared helpers ─────────────────────────────────────────────────────────────
const Skel: React.FC<{ h?: number; mb?: number }> = ({ h = 14, mb = 6 }) => (
  <div className="etf-skel" style={{ height: h, marginBottom: mb }} />
);
const Toggle: React.FC<{ value: Range; onChange: (v: Range) => void }> = ({ value, onChange }) => (
  <div className="etf-tog">
    {(['30d','1y','all'] as Range[]).map(v => (
      <button key={v} className={`etf-tbtn ${value === v ? 'on' : 'off'}`} onClick={() => onChange(v)}>
        {v === 'all' ? 'All' : v}
      </button>
    ))}
  </div>
);

// ── Bar Chart (ETF Net Flows) ──────────────────────────────────────────────────
const FlowBarChart: React.FC<{ data: FlowPoint[]; range: Range; view: ChartView }> = ({ data, range, view }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tipIdx, setTipIdx] = useState<number | null>(null);

  const sliced = sliceRange(data, range);
  const n = sliced.length;

  const draw = useCallback(() => {
    const canvas = canvasRef.current; const cont = containerRef.current;
    if (!canvas || !cont || n < 1) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;
    const W = cont.clientWidth; const H = cont.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR); ctx.clearRect(0, 0, W, H);

    const PAD = { top: 12, right: 52, bottom: 28, left: 10 };
    const cw = W - PAD.left - PAD.right;
    const ch = H - PAD.top - PAD.bottom;

    const totals = sliced.map(d => d.btcFlow + d.ethFlow);
    const maxAbs = Math.max(...totals.map(Math.abs), 1);

    const zero = PAD.top + ch / 2; // zero line in centre
    const toY = (v: number) => zero - (v / maxAbs) * (ch / 2);
    const toX = (i: number) => PAD.left + (i / n) * cw;
    const barW = Math.max(2, (cw / n) - 2);
    const fsz = Math.max(8, Math.min(10, W / 70));

    // Grid
    [maxAbs / 2, 0, -maxAbs / 2].forEach(v => {
      const y = toY(v);
      ctx.setLineDash([3, 6]); ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(200,220,255,0.35)'; ctx.font = `${fsz}px monospace`; ctx.textAlign = 'left';
      const lbl = v === 0 ? '$0' : fmtFlow(v, false);
      ctx.fillText(lbl, W - PAD.right + 3, y + 3);
    });

    // Bars (BTC behind, ETH on top)
    sliced.forEach((d, i) => {
      const x = toX(i) + 1;
      const btcH = Math.abs((d.btcFlow / maxAbs) * (ch / 2));
      const ethH = Math.abs((d.ethFlow / maxAbs) * (ch / 2));
      const btcY = d.btcFlow >= 0 ? zero - btcH : zero;
      const ethY = d.ethFlow >= 0 ? zero - ethH : zero;
      const hw   = barW * 0.52;

      // BTC bar
      ctx.fillStyle = BTC_COLOR + (tipIdx === i ? 'ff' : 'cc');
      ctx.fillRect(x - hw, btcY, hw, btcH || 1);

      // ETH bar
      ctx.fillStyle = ETH_COLOR + (tipIdx === i ? 'ff' : 'cc');
      ctx.fillRect(x, ethY, hw, ethH || 1);
    });

    // Zero line
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(PAD.left, zero); ctx.lineTo(W - PAD.right, zero); ctx.stroke();

    // X labels — sparse
    const xN = Math.max(2, Math.min(10, Math.floor(W / 70)));
    ctx.fillStyle = 'rgba(180,200,240,0.3)'; ctx.font = `${fsz}px monospace`; ctx.textAlign = 'center';
    for (let i = 0; i < xN; i++) {
      const idx = Math.floor((i / (xN - 1)) * (n - 1));
      const d = new Date(sliced[idx].date);
      const lbl = range === 'all'
        ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        : `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}`;
      ctx.fillText(lbl, toX(idx) + barW / 2, H - 5);
    }
  }, [sliced, n, range, view, tipIdx]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current; if (!c || n < 1) return;
    const r = c.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const cw = c.clientWidth - 10 - 52;
    setTipIdx(Math.max(0, Math.min(n - 1, Math.floor((mx - 10) / (cw / n)))));
  };

  const tipD = tipIdx !== null ? sliced[tipIdx] : null;

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => setTipIdx(null)} />
      {tipD && (
        <div style={{
          position: 'absolute', left: Math.min((tipIdx! / n) * 100, 60) + '%',
          top: 16, background: 'rgba(5,10,28,0.97)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
          padding: '8px 12px', fontSize: 10, color: '#a8c0f0',
          pointerEvents: 'none', zIndex: 20, minWidth: 170,
        }}>
          <div style={{ color: 'rgba(200,220,255,0.5)', marginBottom: 5, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 4 }}>
            {fmtDate(tipD.date)}
          </div>
          {[
            { label: 'BTC', val: tipD.btcFlow, color: BTC_COLOR },
            { label: 'ETH', val: tipD.ethFlow, color: ETH_COLOR },
            { label: 'Total', val: tipD.btcFlow + tipD.ethFlow, color: '#fff' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, gap: 12 }}>
              <span style={{ color: 'rgba(180,200,240,0.6)' }}>{label}:</span>
              <span style={{ color, fontWeight: 700 }}>{fmtFlow(val)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Area + Line chart (AUM / AUM%) ─────────────────────────────────────────────
const AumAreaChart: React.FC<{ data: FlowPoint[]; range: Range }> = ({ data, range }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tipIdx, setTipIdx] = useState<number | null>(null);

  const sliced = sliceRange(data, range);
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

    const PAD = { top: 12, right: 52, bottom: 26, left: 10 };
    const cw = W - PAD.left - PAD.right;
    const ch = H - PAD.top - PAD.bottom;

    const totals = sliced.map(d => d.btcAum + d.ethAum);
    const maxV = Math.max(...totals) * 1.08;
    const toX = (i: number) => PAD.left + (i / (n - 1)) * cw;
    const toY = (v: number) => PAD.top + ch - (v / maxV) * ch;
    const fsz = Math.max(8, Math.min(10, W / 70));

    // Grid
    [0, maxV * 0.25, maxV * 0.5, maxV * 0.75, maxV].forEach(v => {
      const y = toY(v);
      ctx.setLineDash([3, 6]); ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(200,220,255,0.35)'; ctx.font = `${fsz}px monospace`; ctx.textAlign = 'left';
      ctx.fillText(fmtB(v), W - PAD.right + 3, y + 3);
    });

    // ETH area
    ctx.beginPath();
    sliced.forEach((d, i) => { i === 0 ? ctx.moveTo(toX(i), toY(d.ethAum)) : ctx.lineTo(toX(i), toY(d.ethAum)); });
    ctx.lineTo(toX(n - 1), PAD.top + ch); ctx.lineTo(PAD.left, PAD.top + ch);
    ctx.closePath();
    const ethGrad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + ch);
    ethGrad.addColorStop(0, ETH_COLOR + '55'); ethGrad.addColorStop(1, ETH_COLOR + '08');
    ctx.fillStyle = ethGrad; ctx.fill();

    // BTC area (stacked on top of ETH)
    ctx.beginPath();
    sliced.forEach((d, i) => { i === 0 ? ctx.moveTo(toX(i), toY(d.btcAum + d.ethAum)) : ctx.lineTo(toX(i), toY(d.btcAum + d.ethAum)); });
    sliced.forEach((d, i) => { const j = n - 1 - i; ctx.lineTo(toX(j), toY(sliced[j].ethAum)); });
    ctx.closePath();
    const btcGrad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + ch);
    btcGrad.addColorStop(0, BTC_COLOR + '88'); btcGrad.addColorStop(1, BTC_COLOR + '22');
    ctx.fillStyle = btcGrad; ctx.fill();

    // Lines
    const drawLine = (vals: number[], color: string, w = 1.4) => {
      ctx.beginPath(); vals.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
    };
    drawLine(sliced.map(d => d.ethAum), ETH_COLOR + 'cc', 1.2);
    drawLine(sliced.map(d => d.btcAum + d.ethAum), BTC_COLOR + 'cc', 1.4);

    // X labels
    const xN = Math.max(2, Math.min(7, Math.floor(W / 80)));
    ctx.fillStyle = 'rgba(180,200,240,0.3)'; ctx.font = `${fsz}px monospace`; ctx.textAlign = 'center';
    for (let i = 0; i < xN; i++) {
      const idx = Math.floor((i / (xN - 1)) * (n - 1));
      const d = new Date(sliced[idx].date);
      ctx.fillText(`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, toX(idx), H - 4);
    }

    // Crosshair
    if (tipIdx !== null) {
      const tx = toX(tipIdx);
      ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, PAD.top); ctx.lineTo(tx, PAD.top + ch); ctx.stroke(); ctx.setLineDash([]);
      const d = sliced[tipIdx];
      [[d.ethAum, ETH_COLOR], [d.btcAum + d.ethAum, BTC_COLOR]].forEach(([v, col]) => {
        ctx.beginPath(); ctx.arc(tx, toY(v as number), 4, 0, Math.PI * 2);
        ctx.fillStyle = col as string; ctx.fill();
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
    const cw = c.clientWidth - 10 - 52;
    setTipIdx(Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left - 10) / cw * (n - 1)))));
  };

  const tipD = tipIdx !== null ? sliced[tipIdx] : null;
  const tipXPct = tipIdx !== null ? tipIdx / Math.max(n - 1, 1) : 0;

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => setTipIdx(null)} />
      {tipD && (
        <div style={{
          position: 'absolute',
          left: tipXPct > 0.6 ? undefined : `calc(${tipXPct * 100}% + 14px)`,
          right: tipXPct > 0.6 ? '58px' : undefined,
          top: 14, background: 'rgba(5,10,28,0.97)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
          padding: '8px 12px', fontSize: 10, color: '#a8c0f0',
          pointerEvents: 'none', zIndex: 20, minWidth: 170,
        }}>
          <div style={{ color: 'rgba(200,220,255,0.5)', marginBottom: 5 }}>{fmtDate(tipD.date)}</div>
          {[
            { label: 'BTC AUM', val: tipD.btcAum, color: BTC_COLOR },
            { label: 'ETH AUM', val: tipD.ethAum, color: ETH_COLOR },
            { label: 'Total',   val: tipD.btcAum + tipD.ethAum, color: '#fff' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, gap: 10 }}>
              <span style={{ color: 'rgba(180,200,240,0.6)' }}>{label}:</span>
              <span style={{ color, fontWeight: 700 }}>{fmtB(val)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── AUM % Line Chart ───────────────────────────────────────────────────────────
const AumPctChart: React.FC<{ data: AumPctPoint[]; range: Range }> = ({ data, range }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tipIdx, setTipIdx] = useState<number | null>(null);

  const sliced = sliceRange(data, range);
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

    const PAD = { top: 12, right: 40, bottom: 26, left: 10 };
    const cw = W - PAD.left - PAD.right;
    const ch = H - PAD.top - PAD.bottom;

    const allPct = [...sliced.map(d => d.totalPct), ...sliced.map(d => d.btcPct), ...sliced.map(d => d.ethPct)];
    const maxV = Math.max(...allPct) * 1.15;
    const toX = (i: number) => PAD.left + (i / (n - 1)) * cw;
    const toY = (v: number) => PAD.top + ch - (v / maxV) * ch;
    const fsz = Math.max(8, Math.min(10, W / 70));

    // Grid
    [0, maxV * 0.25, maxV * 0.5, maxV * 0.75, maxV].forEach(v => {
      const y = toY(v);
      ctx.setLineDash([3, 6]); ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(200,220,255,0.35)'; ctx.font = `${fsz}px monospace`; ctx.textAlign = 'left';
      ctx.fillText(v.toFixed(1) + '%', W - PAD.right + 3, y + 3);
    });

    const drawLine = (vals: number[], color: string, w = 1.5) => {
      ctx.beginPath(); vals.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
    };
    drawLine(sliced.map(d => d.ethPct),   ETH_COLOR, 1.4);
    drawLine(sliced.map(d => d.btcPct),   BTC_COLOR, 1.6);
    drawLine(sliced.map(d => d.totalPct), TOT_COLOR, 1.2);

    // X labels
    const xN = Math.max(2, Math.min(7, Math.floor(W / 80)));
    ctx.fillStyle = 'rgba(180,200,240,0.3)'; ctx.font = `${fsz}px monospace`; ctx.textAlign = 'center';
    for (let i = 0; i < xN; i++) {
      const idx = Math.floor((i / (xN - 1)) * (n - 1));
      const d = new Date(sliced[idx].date);
      ctx.fillText(`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, toX(idx), H - 4);
    }

    if (tipIdx !== null) {
      const tx = toX(tipIdx);
      ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, PAD.top); ctx.lineTo(tx, PAD.top + ch); ctx.stroke(); ctx.setLineDash([]);
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
    const cw = c.clientWidth - 10 - 40;
    setTipIdx(Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left - 10) / cw * (n - 1)))));
  };

  const tipD = tipIdx !== null ? sliced[tipIdx] : null;
  const tipXPct = tipIdx !== null ? tipIdx / Math.max(n - 1, 1) : 0;

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => setTipIdx(null)} />
      {tipD && (
        <div style={{
          position: 'absolute',
          left: tipXPct > 0.6 ? undefined : `calc(${tipXPct * 100}% + 14px)`,
          right: tipXPct > 0.6 ? '45px' : undefined,
          top: 14, background: 'rgba(5,10,28,0.97)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
          padding: '8px 12px', fontSize: 10, color: '#a8c0f0',
          pointerEvents: 'none', zIndex: 20, minWidth: 165,
        }}>
          <div style={{ color: 'rgba(200,220,255,0.5)', marginBottom: 5 }}>{fmtDate(tipD.date)}</div>
          {[
            { label: 'BTC+ETH', val: tipD.totalPct, color: TOT_COLOR },
            { label: 'BTC',     val: tipD.btcPct,   color: BTC_COLOR },
            { label: 'ETH',     val: tipD.ethPct,   color: ETH_COLOR },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, gap: 10 }}>
              <span style={{ color: 'rgba(180,200,240,0.6)' }}>{label}:</span>
              <span style={{ color, fontWeight: 700 }}>{val.toFixed(2)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── ETF Table ─────────────────────────────────────────────────────────────────
type SortKey = keyof EtfRow;
const ETFTable: React.FC<{ rows: EtfRow[] }> = ({ rows }) => {
  const [sk, setSk] = useState<SortKey>('aum');
  const [asc, setAsc] = useState(false);

  const sorted = [...rows].sort((a, b) => {
    const av = a[sk]; const bv = b[sk];
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv : String(av).localeCompare(String(bv));
    return asc ? cmp : -cmp;
  });

  const TH = ({ label, k, style }: { label: string; k: SortKey; style?: React.CSSProperties }) => (
    <th style={{ ...style, color: sk === k ? '#f7931a' : undefined }}
      onClick={() => { if (sk === k) setAsc(a => !a); else { setSk(k); setAsc(false); } }}>
      {label} {sk === k ? (asc ? '▲' : '▼') : '⇅'}
    </th>
  );

  return (
    <table className="etf-tbl">
      <thead>
        <tr>
          <TH label="Ticker"     k="ticker"    />
          <TH label="Fund Name"  k="name"      />
          <TH label="Price"      k="price"     />
          <TH label="Volume"     k="volume"    />
          <TH label="AUM"        k="aum"       />
          <TH label="Market Cap" k="marketCap" />
          <TH label="Premium"    k="premium"   />
          <TH label="Net Fee"    k="fee"       />
          <TH label="Type"       k="type"      />
        </tr>
      </thead>
      <tbody>
        {sorted.map((r, i) => (
          <tr key={r.ticker}
            style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
            <td>
              <div style={{ fontWeight: 800, color: '#e2f0ff', fontSize: 12 }}>{r.ticker}</div>
              <div style={{ fontSize: 9, color: r.coin === 'BTC' ? BTC_COLOR : ETH_COLOR, marginTop: 1 }}>{r.coin}</div>
            </td>
            <td style={{ color: 'rgba(180,210,255,0.8)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r.name}
            </td>
            <td style={{ color: '#e2f0ff', fontWeight: 600 }}>
              {r.price > 0 ? `$${r.price.toFixed(2)}` : '—'}
            </td>
            <td style={{ color: 'rgba(180,210,255,0.7)' }}>
              {r.volume > 0 ? fmtB(r.volume) : '—'}
            </td>
            <td style={{ color: '#e2f0ff', fontWeight: 700 }}>
              {r.aum > 0 ? fmtB(r.aum) : '—'}
            </td>
            <td style={{ color: 'rgba(180,210,255,0.7)' }}>
              {r.marketCap > 0 ? fmtB(r.marketCap) : '—'}
            </td>
            <td style={{ color: r.premium >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
              {r.premium !== 0 ? (r.premium >= 0 ? '+' : '') + r.premium.toFixed(2) + '%' : '—'}
            </td>
            <td style={{ color: 'rgba(180,210,255,0.7)' }}>{r.fee.toFixed(2)}%</td>
            <td>
              <span style={{
                padding: '2px 7px', borderRadius: 3, fontSize: 10, fontWeight: 700,
                background: r.type === 'Spot' ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.12)',
                color:      r.type === 'Spot' ? '#22c55e'              : '#f97316',
                border: `1px solid ${r.type === 'Spot' ? '#22c55e40' : '#f9731640'}`,
              }}>{r.type}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const CryptoETFTab: React.FC = () => {
  const [data,    setData]    = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [updated, setUpdated] = useState('');
  const [flowRange,   setFlowRange]   = useState<Range>('30d');
  const [aumRange,    setAumRange]    = useState<Range>('all');
  const [aumPctRange, setAumPctRange] = useState<Range>('all');
  const [chartView,   setChartView]   = useState<ChartView>('coins');
  const [tableTab,    setTableTab]    = useState<TableTab>('overview');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res  = await fetch('/api/crypto-etf');
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
    const id = setInterval(fetchData, 300_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const netFlow = data?.todayNetFlow ?? 0;
  const isPos   = netFlow >= 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="etf-root">

        {/* ── Header ── */}
        <div className="etf-hdr">
          <div className="etf-hrow">
            <span style={{ fontSize: 15, fontWeight: 800, color: '#e2f0ff' }}>Cryptocurrency ETF Tracker</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {data && <span style={{ fontSize: 9, color: 'rgba(200,220,255,0.3)', lineHeight: 1.6 }}>
                {data.source}<br />Updated: {updated}
              </span>}
              <button onClick={fetchData} disabled={loading} style={{
                background: 'rgba(247,147,26,0.08)', border: '1px solid rgba(247,147,26,0.25)',
                color: '#f7931a', padding: '3px 10px', fontSize: 10,
                cursor: loading ? 'default' : 'pointer', borderRadius: 3,
                fontFamily: 'monospace', opacity: loading ? 0.5 : 1,
              }}>{loading ? '↻ Loading…' : '↺ Refresh'}</button>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(200,220,255,0.3)', marginTop: 3, lineHeight: 1.5 }}>
            Listed below are ETFs (exchange-traded funds) invested in cryptocurrencies. We provide details on
            inflows and outflows, assets under management (AUM) and net asset value (NAV). Live prices from Yahoo Finance.
          </div>
        </div>

        {error && (
          <div style={{ margin: '6px 16px 0', background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5',
            padding: '6px 12px', borderRadius: 5, fontSize: 11, flexShrink: 0 }}>
            ⚠ {error}
          </div>
        )}

        <div className="etf-body">

          {/* ── Top row: sidebar + bar chart ── */}
          <div className="etf-top">

            {/* Sidebar */}
            <div className="etf-sidebar">

              {/* Net Flow */}
              <div className="etf-card">
                <div className="etf-card-title">ETF Net Flow {data ? `(${data.todayDate})` : ''}</div>
                {loading && !data ? <Skel h={26} /> : data ? (
                  <>
                    <div className="etf-netflow-big" style={{ color: isPos ? '#22c55e' : '#ef4444' }}>
                      {isPos ? '+' : ''}{fmtFlow(netFlow, false)}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: BTC_COLOR }}>{fmtFlow(data.btcFlow)}</span>
                      <span style={{ fontSize: 10, color: ETH_COLOR }}>{fmtFlow(data.ethFlow)}</span>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Historical */}
              <div className="etf-card">
                <div className="etf-card-title">Historical Values</div>
                {loading && !data ? <><Skel h={16} /><Skel h={16} /><Skel h={16} /></> : data ? (
                  <>
                    {[
                      { label: 'Last Week',     val: data.historical.lastWeek    },
                      { label: 'Last Month',    val: data.historical.lastMonth   },
                      { label: 'Last 3 Months', val: data.historical.last3Months },
                    ].map(({ label, val }) => (
                      <div key={label} className="etf-hist-row">
                        <span className="etf-hist-lbl">{label}</span>
                        <span className="etf-hist-val" style={{ color: val >= 0 ? '#22c55e' : '#ef4444' }}>
                          {fmtFlow(val)}
                        </span>
                      </div>
                    ))}
                  </>
                ) : null}
              </div>

              {/* Yearly Performance */}
              <div className="etf-card">
                <div className="etf-card-title">Yearly Performance</div>
                {loading && !data ? <><Skel h={16} /><Skel h={16} /></> : data ? (
                  <>
                    <div className="etf-hist-row">
                      <span className="etf-hist-lbl">Strongest ({data.yearly.strongest.label})</span>
                      <span className="etf-hist-val" style={{ color: '#22c55e' }}>
                        {fmtFlow(data.yearly.strongest.value)}
                      </span>
                    </div>
                    <div className="etf-hist-row">
                      <span className="etf-hist-lbl">Weakest ({data.yearly.weakest.label})</span>
                      <span className="etf-hist-val" style={{ color: '#ef4444' }}>
                        {fmtFlow(data.yearly.weakest.value)}
                      </span>
                    </div>
                  </>
                ) : null}
              </div>

            </div>

            {/* Bar chart panel */}
            <div className="etf-bar-panel">
              <div className="etf-ch-hdr">
                <div>
                  <div className="etf-ch-title">ETF Net Flow Chart {data ? `(${data.todayDate})` : ''}</div>
                  {data && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: BTC_COLOR }}>● BTC</span>
                      <span style={{ fontSize: 10, color: ETH_COLOR }}>● ETH</span>
                      <span style={{ fontSize: 10, color: BTC_COLOR }}>{fmtFlow(data.btcFlow)}</span>
                      <span style={{ fontSize: 10, color: ETH_COLOR }}>{fmtFlow(data.ethFlow)}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div className="etf-vtog">
                    {(['coins','funds'] as ChartView[]).map(v => (
                      <button key={v} className={`etf-vbtn ${chartView === v ? 'on' : 'off'}`}
                        onClick={() => setChartView(v)}>
                        {v === 'coins' ? 'By Coins' : 'By Funds'}
                      </button>
                    ))}
                  </div>
                  <Toggle value={flowRange} onChange={setFlowRange} />
                </div>
              </div>
              <div className="etf-chart-area">
                {loading && !data?.flowHistory?.length
                  ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(200,220,255,0.3)', fontSize: 12 }}>Loading…</div>
                  : data?.flowHistory?.length
                    ? <FlowBarChart data={data.flowHistory} range={flowRange} view={chartView} />
                    : null
                }
              </div>
            </div>

          </div>

          {/* ── Middle row: AUM + AUM% ── */}
          <div className="etf-mid">

            {/* Total AUM */}
            <div className="etf-mid-panel">
              <div className="etf-ch-hdr">
                <div>
                  <div className="etf-ch-title">Total AUM</div>
                  {data && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: 'rgba(200,220,255,0.55)' }}>Total</span>
                      <span style={{ fontSize: 10, color: BTC_COLOR }}>● BTC</span>
                      <span style={{ fontSize: 10, color: ETH_COLOR }}>● ETH</span>
                    </div>
                  )}
                  {data && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#e2f0ff' }}>↑ {fmtB(data.aum.total)}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: BTC_COLOR   }}>↑ {fmtB(data.aum.btc)}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: ETH_COLOR   }}>↑ {fmtB(data.aum.eth)}</span>
                    </div>
                  )}
                </div>
                <Toggle value={aumRange} onChange={setAumRange} />
              </div>
              <div className="etf-chart-area">
                {loading && !data?.flowHistory?.length
                  ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(200,220,255,0.3)', fontSize: 12 }}>Loading…</div>
                  : data?.flowHistory?.length
                    ? <AumAreaChart data={data.flowHistory} range={aumRange} />
                    : null
                }
              </div>
            </div>

            {/* AUM % of Market Cap */}
            <div className="etf-mid-panel">
              <div className="etf-ch-hdr">
                <div>
                  <div className="etf-ch-title">AUM as a Percentage of Market Cap ⓘ</div>
                  {data && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: TOT_COLOR }}>● BTC+ETH</span>
                      <span style={{ fontSize: 10, color: BTC_COLOR }}>● BTC</span>
                      <span style={{ fontSize: 10, color: ETH_COLOR }}>● ETH</span>
                    </div>
                  )}
                  {data && (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: TOT_COLOR }}>{data.aum.totalPct.toFixed(2)}%</span>
                      <span style={{ fontSize: 12, fontWeight: 900, color: BTC_COLOR }}>{data.aum.btcPct.toFixed(2)}%</span>
                      <span style={{ fontSize: 12, fontWeight: 900, color: ETH_COLOR }}>{data.aum.ethPct.toFixed(2)}%</span>
                    </div>
                  )}
                </div>
                <Toggle value={aumPctRange} onChange={setAumPctRange} />
              </div>
              <div className="etf-chart-area">
                {loading && !data?.aumPctHistory?.length
                  ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(200,220,255,0.3)', fontSize: 12 }}>Loading…</div>
                  : data?.aumPctHistory?.length
                    ? <AumPctChart data={data.aumPctHistory} range={aumPctRange} />
                    : null
                }
              </div>
            </div>

          </div>

          {/* ── Table ── */}
          <div className="etf-table-sec">
            <div className="etf-tabs">
              {(['overview','flows'] as TableTab[]).map(t => (
                <button key={t} className={`etf-tab-btn ${tableTab === t ? 'on' : 'off'}`}
                  onClick={() => setTableTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {loading && !data?.etfTable?.length
              ? Array.from({ length: 8 }, (_, i) => <Skel key={i} h={36} mb={4} />)
              : data?.etfTable?.length
                ? <ETFTable rows={data.etfTable} />
                : null
            }
          </div>

        </div>
      </div>
    </>
  );
};

export default CryptoETFTab;