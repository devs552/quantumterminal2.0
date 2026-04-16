'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface ChartPoint  { date: string; marketCap: number; asi: number }
interface CoinPerf    { name: string; symbol: string; image: string; change90d: number; outperformsBtc: boolean; rank: number }
interface ApiData {
  success: boolean;
  current:    { value: number; season: string };
  historical: { yesterday: number; lastWeek: number; lastMonth: number };
  yearly:     { high: { value: number; date: string }; low: { value: number; date: string } };
  btcChange90d: number;
  chart:  ChartPoint[];
  top100: CoinPerf[];
  source: string;
  updatedAt: number;
  error?: string;
}
type Range = '7d' | '30d' | '90d';

// ── Helpers ────────────────────────────────────────────────────────────────────
function asiSeason(v: number): string {
  if (v >= 75) return 'Altcoin Season';
  if (v <= 25) return 'Bitcoin Season';
  return 'Neutral';
}
function asiColor(v: number): string {
  if (v >= 75) return '#60a5fa';
  if (v <= 25) return '#fbbf24';
  return '#94a3b8';
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtMarketCap(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(0) + 'M';
  return n.toFixed(0);
}

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
  .asi-root {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    background: #080e1c;
    font-family: "IBM Plex Mono", "Courier New", monospace;
    color: #c8d8f0;
    box-sizing: border-box;
  }
  *, *::before, *::after { box-sizing: inherit; }

  /* ─ Header ─ */
  .asi-header {
    padding: 14px 20px 10px;
    border-bottom: 1px solid rgba(59,130,246,0.12);
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
  }
  .asi-header-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .asi-title {
    font-size: 15px;
    font-weight: 800;
    color: #e8f0ff;
    letter-spacing: 0.02em;
  }
  .asi-meta {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .asi-source {
    font-size: 10px;
    color: rgba(100,150,255,0.45);
    line-height: 1.5;
    text-align: right;
  }
  .asi-refresh-btn {
    background: rgba(59,130,246,0.1);
    border: 1px solid rgba(59,130,246,0.28);
    color: #93c5fd;
    padding: 4px 12px;
    font-size: 11px;
    cursor: pointer;
    border-radius: 4px;
    font-family: monospace;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .asi-refresh-btn:hover { background: rgba(59,130,246,0.18); }
  .asi-refresh-btn:disabled { opacity: 0.45; cursor: default; }
  .asi-description {
    font-size: 11px;
    color: rgba(100,150,255,0.4);
    line-height: 1.6;
  }

  /* ─ Error ─ */
  .asi-error {
    margin: 8px 20px 0;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.25);
    color: #fca5a5;
    padding: 7px 14px;
    border-radius: 6px;
    font-size: 11px;
    flex-shrink: 0;
  }

  /* ─ Top section: sidebar + chart ─ */
  .asi-top {
    display: flex;
    gap: 14px;
    padding: 14px 20px;
    flex-shrink: 0;
  }

  /* ─ Sidebar ─ */
  .asi-sidebar {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 230px;
    flex-shrink: 0;
  }

  /* ─ Cards ─ */
  .asi-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(59,130,246,0.14);
    border-radius: 10px;
    padding: 13px 15px;
  }
  .asi-card-title {
    font-size: 11px;
    font-weight: 700;
    color: rgba(200,220,255,0.5);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 11px;
  }

  /* ─ ASI gauge ─ */
  .asi-value {
    font-size: 32px;
    font-weight: 900;
    color: #e8f0ff;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .asi-value-denom {
    font-size: 14px;
    color: rgba(200,220,255,0.3);
    font-weight: 400;
  }
  .asi-track {
    height: 5px;
    border-radius: 3px;
    position: relative;
    background: linear-gradient(to right, #fbbf24 0%, #fbbf24 50%, #60a5fa 50%, #60a5fa 100%);
    margin: 12px 0 5px;
  }
  .asi-dot {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid rgba(0,0,0,0.6);
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 0 3px rgba(255,255,255,0.15);
  }
  .asi-track-labels {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: rgba(200,220,255,0.3);
    margin-bottom: 8px;
  }

  /* ─ Season badge (inline) ─ */
  .asi-season-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 700;
  }

  /* ─ Hist rows ─ */
  .asi-hist-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid rgba(59,130,246,0.07);
    gap: 8px;
  }
  .asi-hist-row:last-child { border-bottom: none; }
  .asi-hist-label {
    font-size: 12px;
    color: rgba(180,210,255,0.6);
    white-space: nowrap;
  }
  .asi-yr-sub {
    font-size: 9px;
    color: rgba(180,210,255,0.3);
    margin-bottom: 2px;
  }
  .asi-yr-date {
    font-size: 10px;
    color: rgba(180,210,255,0.6);
  }

  /* ─ Chart panel ─ */
  .asi-chart-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(59,130,246,0.14);
    border-radius: 10px;
    overflow: hidden;
    /* Fixed height so chart has a defined container */
    height: 340px;
  }
  .asi-chart-hdr {
    padding: 10px 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(59,130,246,0.08);
    gap: 10px;
    flex-wrap: wrap;
    flex-shrink: 0;
  }
  .asi-chart-title {
    font-size: 13px;
    font-weight: 700;
    color: #e2f0ff;
  }
  .asi-legend {
    display: flex;
    gap: 16px;
    padding: 5px 15px;
    border-bottom: 1px solid rgba(59,130,246,0.06);
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .asi-legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: rgba(180,210,255,0.5);
  }
  .asi-legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .asi-chart-area {
    flex: 1;
    min-height: 0;
    position: relative;
  }

  /* ─ Toggle ─ */
  .asi-toggle {
    display: flex;
    gap: 3px;
  }
  .asi-tbtn {
    border-radius: 4px;
    font-family: monospace;
    font-size: 11px;
    cursor: pointer;
    padding: 3px 10px;
    line-height: 1.5;
    transition: all 0.15s;
  }
  .asi-tbtn.on  {
    background: rgba(59,130,246,0.2);
    border: 1px solid rgba(59,130,246,0.5);
    color: #93c5fd;
  }
  .asi-tbtn.off {
    background: transparent;
    border: 1px solid rgba(59,130,246,0.15);
    color: rgba(59,130,246,0.4);
  }
  .asi-tbtn.off:hover {
    border-color: rgba(59,130,246,0.35);
    color: rgba(59,130,246,0.7);
  }

  /* ─ Tooltip ─ */
  .asi-tooltip {
    position: absolute;
    top: 12px;
    background: rgba(5,10,26,0.97);
    border: 1px solid rgba(59,130,246,0.3);
    border-radius: 7px;
    padding: 10px 14px;
    font-size: 11px;
    color: #a8c0f0;
    pointer-events: none;
    z-index: 20;
    font-family: monospace;
    min-width: 200px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  }
  .asi-tooltip-date {
    font-size: 10px;
    color: rgba(100,150,255,0.5);
    margin-bottom: 7px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(59,130,246,0.1);
  }
  .asi-tooltip-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
  }
  .asi-tooltip-key {
    display: flex;
    align-items: center;
    gap: 5px;
    color: rgba(147,197,253,0.65);
    white-space: nowrap;
  }
  .asi-tooltip-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ─ Performance section ─ */
  .asi-perf {
    padding: 14px 20px 20px;
    overflow-y: auto;
  }
  .asi-perf-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }
  .asi-perf-title {
    font-size: 14px;
    font-weight: 700;
    color: #e8f0ff;
  }
  .asi-perf-meta {
    font-size: 10px;
    color: rgba(100,150,255,0.4);
    white-space: nowrap;
  }

  /* ─ Bar rows ─ */
  .asi-bar-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
  .asi-bar-track {
    position: relative;
    height: 18px;
    display: flex;
    align-items: center;
  }
  .asi-bar-fill {
    height: 14px;
    border-radius: 3px;
    min-width: 4px;
    transition: width 0.4s ease;
  }
  .asi-bar-info {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
    min-width: 140px;
    justify-content: flex-end;
  }
  .asi-bar-sym {
    color: #c8d8f0;
    font-size: 11px;
    min-width: 40px;
    text-align: right;
  }
  .asi-bar-pct {
    font-size: 11px;
    min-width: 52px;
    text-align: right;
  }
  .asi-coin-img {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  /* ─ Skeleton ─ */
  @keyframes asi-pulse { 0%,100%{opacity:.3} 50%{opacity:.1} }
  .asi-skel {
    background: rgba(59,130,246,0.1);
    border-radius: 4px;
    animation: asi-pulse 1.5s ease-in-out infinite;
  }

  /* ─ Empty/loading states ─ */
  .asi-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 8px;
    color: rgba(59,130,246,0.35);
    font-size: 12px;
  }

  /* ─ Divider ─ */
  .asi-divider {
    height: 1px;
    background: rgba(59,130,246,0.1);
    margin: 0 20px;
    flex-shrink: 0;
  }

  /* ─ Responsive ─ */
  @media (max-width: 900px) {
    .asi-top {
      flex-direction: column;
    }
    .asi-sidebar {
      width: 100%;
      flex-direction: row;
      flex-wrap: wrap;
    }
    .asi-card {
      flex: 1 1 200px;
    }
    .asi-chart-panel {
      height: 300px;
    }
  }
  @media (max-width: 600px) {
    .asi-top { padding: 12px; gap: 10px; }
    .asi-header { padding: 12px 14px 8px; }
    .asi-error { margin: 6px 14px 0; }
    .asi-perf { padding: 12px 14px 16px; }
    .asi-divider { margin: 0 14px; }
    .asi-sidebar { flex-direction: column; }
    .asi-card { flex: unset; width: 100%; }
    .asi-chart-panel { height: 260px; }
    .asi-chart-hdr { flex-direction: column; align-items: flex-start; gap: 8px; }
    .asi-toggle { width: 100%; }
    .asi-tbtn { flex: 1; text-align: center; }
    .asi-bar-info { min-width: 110px; gap: 4px; }
    .asi-bar-pct { min-width: 42px; font-size: 10px; }
    .asi-bar-sym { min-width: 32px; font-size: 10px; }
  }
`;

// ── Season Badge ───────────────────────────────────────────────────────────────
const SeasonBadge: React.FC<{ value: number }> = ({ value }) => {
  const color = asiColor(value);
  return (
    <span
      className="asi-season-badge"
      style={{
        background: color + '1a',
        border: `1px solid ${color}40`,
        color,
      }}
    >
      {asiSeason(value)} · {value}
    </span>
  );
};

// ── ASI Gauge Card ─────────────────────────────────────────────────────────────
const AsiGauge: React.FC<{ value: number }> = ({ value }) => {
  const color = asiColor(value);
  return (
    <>
      <div>
        <span className="asi-value">{value}</span>
        <span className="asi-value-denom">/100</span>
      </div>
      <div className="asi-track" style={{ marginTop: 12 }}>
        <div className="asi-dot" style={{ left: `${value}%` }} />
      </div>
      <div className="asi-track-labels">
        <span>Bitcoin Season</span>
        <span>Altcoin Season</span>
      </div>
      <div style={{ textAlign: 'center' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color,
            background: color + '18',
            padding: '3px 12px',
            borderRadius: 4,
            border: `1px solid ${color}35`,
            display: 'inline-block',
          }}
        >
          {asiSeason(value)}
        </span>
      </div>
    </>
  );
};

// ── Chart ──────────────────────────────────────────────────────────────────────
const AsiChart: React.FC<{ data: ChartPoint[]; range: Range }> = ({ data, range }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tipIdx, setTipIdx] = useState<number | null>(null);

  const sliced = range === '7d'  ? data.slice(-7)
               : range === '30d' ? data.slice(-30)
               : data;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const cont   = containerRef.current;
    if (!canvas || !cont || sliced.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;
    const W   = cont.clientWidth;
    const H   = cont.clientHeight;
    if (W < 20 || H < 20) return;
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR);
    ctx.clearRect(0, 0, W, H);

    const PAD = { top: 14, right: 52, bottom: 28, left: 52 };
    const cw  = W - PAD.left - PAD.right;
    const ch  = H - PAD.top  - PAD.bottom;

    const mcVals = sliced.map(d => d.marketCap).filter(Boolean);
    const hasAMC = mcVals.length > 0;
    const maxMC  = hasAMC ? Math.max(...mcVals) * 1.06 : 1;
    const minMC  = hasAMC ? Math.min(...mcVals) * 0.94 : 0;

    const toX  = (i: number) => PAD.left + (i / (sliced.length - 1)) * cw;
    const toYM = (v: number) => PAD.top  + ch - ((v - minMC) / (maxMC - minMC || 1)) * ch;
    const toYA = (v: number) => PAD.top  + ch - (v / 100) * ch;

    // Zone backgrounds
    [
      { yMin: 75, yMax: 100, color: 'rgba(59,130,246,0.07)' },
      { yMin: 25, yMax: 75,  color: 'rgba(100,100,140,0.04)' },
      { yMin: 0,  yMax: 25,  color: 'rgba(245,158,11,0.08)' },
    ].forEach(z => {
      ctx.fillStyle = z.color;
      ctx.fillRect(PAD.left, toYA(z.yMax), cw, toYA(z.yMin) - toYA(z.yMax));
    });

    // Zone labels
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(200,220,255,0.18)';
    ctx.fillText('Altcoin Season ▲', W - PAD.right - 2, toYA(100) + 13);
    ctx.fillText('Bitcoin Season ▼', W - PAD.right - 2, toYA(25) - 3);

    // Horizontal grid lines (ASI)
    [0, 25, 50, 75, 100].forEach(v => {
      const y = toYA(v);
      ctx.setLineDash([3, 6]);
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(160,190,240,0.08)';
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(160,190,240,0.35)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(String(v), W - PAD.right + 4, y + 3);
    });

    // Left axis (market cap)
    if (hasAMC) {
      ctx.fillStyle = 'rgba(180,200,240,0.28)';
      ctx.font = '9px monospace';
      for (let i = 0; i <= 4; i++) {
        const v = minMC + (i / 4) * (maxMC - minMC);
        ctx.textAlign = 'right';
        ctx.fillText(fmtMarketCap(v), PAD.left - 3, toYM(v) + 3);
      }
    }

    // X-axis labels
    const xN = Math.max(2, Math.min(6, Math.floor(W / 90)));
    ctx.fillStyle = 'rgba(160,190,240,0.3)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < xN; i++) {
      const idx = Math.floor((i / (xN - 1)) * (sliced.length - 1));
      const d   = new Date(sliced[idx].date);
      ctx.fillText(
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        toX(idx),
        H - PAD.bottom + 14,
      );
    }

    // Axis labels
    ctx.fillStyle = 'rgba(160,190,240,0.2)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';  ctx.fillText('AMC →', PAD.left, H - 2);
    ctx.textAlign = 'right'; ctx.fillText('ASI →', W - 2,     H - 2);

    // Market cap area + line
    if (hasAMC) {
      ctx.beginPath();
      sliced.forEach((d, i) => {
        const x = toX(i); const y = toYM(d.marketCap || minMC);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.lineTo(toX(sliced.length - 1), PAD.top + ch);
      ctx.lineTo(PAD.left, PAD.top + ch);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + ch);
      grad.addColorStop(0, 'rgba(160,180,220,0.12)');
      grad.addColorStop(1, 'rgba(160,180,220,0.01)');
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      sliced.forEach((d, i) => {
        const x = toX(i); const y = toYM(d.marketCap || minMC);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(170,185,220,0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // ASI line
    ctx.beginPath();
    sliced.forEach((d, i) => {
      i === 0 ? ctx.moveTo(toX(i), toYA(d.asi)) : ctx.lineTo(toX(i), toYA(d.asi));
    });
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Latest ASI label
    const last = sliced[sliced.length - 1];
    const lx   = toX(sliced.length - 1);
    const ly   = toYA(last.asi);
    const bText = String(last.asi);
    ctx.font = 'bold 10px monospace';
    const bw = ctx.measureText(bText).width + 10;
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
      .roundRect(lx - bw - 4, ly - 8, bw, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(bText, lx - 4 - bw / 2, ly + 4);

    // Crosshair
    if (tipIdx !== null && sliced[tipIdx]) {
      const tx = toX(tipIdx);
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, PAD.top); ctx.lineTo(tx, PAD.top + ch); ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(tx, toYA(sliced[tipIdx].asi), 4, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();

      if (sliced[tipIdx].marketCap && hasAMC) {
        ctx.beginPath();
        ctx.arc(tx, toYM(sliced[tipIdx].marketCap), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#aab8d0';
        ctx.fill();
      }
    }
  }, [sliced, tipIdx]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || sliced.length < 2) return;
    const rect   = canvas.getBoundingClientRect();
    const PAD_L  = 52;
    const PAD_R  = 52;
    const drawW  = canvas.clientWidth - PAD_L - PAD_R;
    const mx     = e.clientX - rect.left - PAD_L;
    const idx    = Math.max(0, Math.min(sliced.length - 1, Math.round((mx / drawW) * (sliced.length - 1))));
    setTipIdx(idx);
  };

  const tipData  = tipIdx !== null ? sliced[tipIdx] : null;
  const tipXFrac = tipIdx !== null ? tipIdx / Math.max(sliced.length - 1, 1) : 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setTipIdx(null)}
      />

      {tipData && (
        <div
          className="asi-tooltip"
          style={{
            left: tipXFrac > 0.6
              ? `calc(${tipXFrac * 100}% - 220px)`
              : `calc(${tipXFrac * 100}% + 20px)`,
          }}
        >
          <div className="asi-tooltip-date">{fmtDate(tipData.date)}</div>
          <div className="asi-tooltip-row">
            <span className="asi-tooltip-key">
              <span className="asi-tooltip-dot" style={{ background: '#3b82f6' }} />
              Altcoin Season Index
            </span>
            <span style={{ color: '#60a5fa', fontWeight: 800 }}>{tipData.asi}</span>
          </div>
          {tipData.marketCap > 0 && (
            <div className="asi-tooltip-row">
              <span className="asi-tooltip-key">
                <span className="asi-tooltip-dot" style={{ background: '#aab8d0' }} />
                Altcoin Market Cap
              </span>
              <span style={{ color: '#e2e8f0', fontWeight: 700 }}>${fmtMarketCap(tipData.marketCap)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Performance Bars ───────────────────────────────────────────────────────────
const PerfBars: React.FC<{ coins: CoinPerf[] }> = ({ coins }) => {
  const maxAbs = Math.max(...coins.map(c => Math.abs(c.change90d)), 1);

  return (
    <div>
      {coins.map(coin => {
        const pct    = coin.change90d;
        const isPos  = pct >= 0;
        const barPct = Math.min(100, (Math.abs(pct) / maxAbs) * 100);
        const color  = isPos ? '#22c55e' : '#ef4444';
        const sign   = isPos ? '+' : '';

        return (
          <div key={coin.symbol} className="asi-bar-row">
            <div className="asi-bar-track">
              <div
                className="asi-bar-fill"
                style={{
                  width: `${Math.max(barPct, 2)}%`,
                  background: color + 'bb',
                }}
              />
            </div>
            <div className="asi-bar-info">
              <span className="asi-bar-pct" style={{ color }}>{sign}{Math.abs(pct).toFixed(1)}%</span>
              {coin.image && (
                <img
                  src={coin.image}
                  alt={coin.symbol}
                  className="asi-coin-img"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <span className="asi-bar-sym">{coin.symbol}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Skeleton ───────────────────────────────────────────────────────────────────
const Skel: React.FC<{ h?: number; mb?: number }> = ({ h = 16, mb = 8 }) => (
  <div className="asi-skel" style={{ height: h, marginBottom: mb }} />
);

// ── Toggle ─────────────────────────────────────────────────────────────────────
const Toggle: React.FC<{ value: Range; onChange: (v: Range) => void }> = ({ value, onChange }) => (
  <div className="asi-toggle">
    {(['7d', '30d', '90d'] as Range[]).map(opt => (
      <button key={opt} onClick={() => onChange(opt)} className={`asi-tbtn ${value === opt ? 'on' : 'off'}`}>
        {opt}
      </button>
    ))}
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
const AltcoinSeasonTab: React.FC = () => {
  const [data,    setData]    = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [updated, setUpdated] = useState('');
  const [range,   setRange]   = useState<Range>('90d');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res  = await fetch('/api/altcoin-season');
      const json: ApiData = await res.json();
      if (!json.success) throw new Error(json.error ?? 'API error');
      setData(json);
      setUpdated(new Date().toLocaleTimeString());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(fetchData, 3_600_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const cur  = data?.current;
  const hist = data?.historical;
  const yr   = data?.yearly;

  return (
    <>
      <style>{CSS}</style>
      <div className="asi-root">

        {/* ── Header ── */}
        <div className="asi-header">
          <div className="asi-header-row">
            <span className="asi-title">CMC Altcoin Season Index</span>
            <div className="asi-meta">
              {data && (
                <span className="asi-source">
                  {data.source}<br />Updated {updated}
                </span>
              )}
              <button
                className="asi-refresh-btn"
                onClick={fetchData}
                disabled={loading}
              >
                {loading ? '↻ Loading…' : '↺ Refresh'}
              </button>
            </div>
          </div>
          <div className="asi-description">
            Real-time insights into whether the market is in Altcoin Season — based on top 100 altcoins' performance relative to Bitcoin over 90 days.
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="asi-error">⚠ {error}</div>
        )}

        {/* ── Top panel ── */}
        <div className="asi-top">

          {/* Sidebar */}
          <div className="asi-sidebar">

            {/* Current ASI */}
            <div className="asi-card">
              <div className="asi-card-title">ASI Index</div>
              {loading && !cur
                ? <><Skel h={36} mb={10} /><Skel h={6} mb={6} /><Skel h={22} /></>
                : cur
                  ? <AsiGauge value={cur.value} />
                  : <span style={{ fontSize: 11, color: 'rgba(200,220,255,0.35)' }}>No data</span>
              }
            </div>

            {/* Historical */}
            <div className="asi-card">
              <div className="asi-card-title">Historical</div>
              {loading && !hist
                ? <><Skel h={22} /><Skel h={22} /><Skel h={22} /></>
                : hist
                  ? (
                    <>
                      {([
                        { label: 'Yesterday', value: hist.yesterday },
                        { label: 'Last Week',  value: hist.lastWeek  },
                        { label: 'Last Month', value: hist.lastMonth },
                      ] as const).map(({ label, value }) => (
                        <div key={label} className="asi-hist-row">
                          <span className="asi-hist-label">{label}</span>
                          <SeasonBadge value={value} />
                        </div>
                      ))}
                    </>
                  )
                  : <span style={{ fontSize: 11, color: 'rgba(200,220,255,0.35)' }}>—</span>
              }
            </div>

            {/* Yearly H/L */}
            <div className="asi-card">
              <div className="asi-card-title">Yearly</div>
              {loading && !yr
                ? <><Skel h={22} /><Skel h={22} /></>
                : yr
                  ? (
                    <>
                      <div className="asi-hist-row">
                        <div>
                          <div className="asi-yr-sub">High</div>
                          <div className="asi-yr-date">{fmtDate(yr.high.date)}</div>
                        </div>
                        <SeasonBadge value={yr.high.value} />
                      </div>
                      <div className="asi-hist-row">
                        <div>
                          <div className="asi-yr-sub">Low</div>
                          <div className="asi-yr-date">{fmtDate(yr.low.date)}</div>
                        </div>
                        <SeasonBadge value={yr.low.value} />
                      </div>
                    </>
                  )
                  : <span style={{ fontSize: 11, color: 'rgba(200,220,255,0.35)' }}>—</span>
              }
            </div>

          </div>

          {/* Chart panel */}
          <div className="asi-chart-panel">
            <div className="asi-chart-hdr">
              <span className="asi-chart-title">Altcoin Season Index Chart</span>
              <Toggle value={range} onChange={setRange} />
            </div>
            <div className="asi-legend">
              {[
                { color: '#3b82f6', label: 'Altcoin Season Index' },
                { color: '#aab8d0', label: 'Altcoin Market Cap'   },
              ].map(({ color, label }) => (
                <span key={label} className="asi-legend-item">
                  <span className="asi-legend-dot" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
            <div className="asi-chart-area">
              {loading && !data?.chart?.length
                ? (
                  <div className="asi-empty">
                    <span style={{ fontSize: 18, animation: 'asi-pulse 1.2s infinite' }}>◌</span>
                    Loading chart…
                  </div>
                )
                : data?.chart?.length
                  ? <AsiChart data={data.chart} range={range} />
                  : <div className="asi-empty">No chart data</div>
              }
            </div>
          </div>

        </div>

        {/* ── Divider ── */}
        <div className="asi-divider" />

        {/* ── Performance ── */}
        <div className="asi-perf">
          <div className="asi-perf-header">
            <span className="asi-perf-title">Top 100 Coins — 90 Day Performance</span>
            {data && (
              <span className="asi-perf-meta">
                {data.top100.filter(c => c.outperformsBtc).length}/{data.top100.length} outperform BTC
                {data.btcChange90d !== 0 && (
                  <span style={{
                    marginLeft: 8,
                    fontWeight: 700,
                    color: data.btcChange90d >= 0 ? '#22c55e' : '#ef4444',
                  }}>
                    BTC: {data.btcChange90d >= 0 ? '+' : ''}{data.btcChange90d.toFixed(1)}%
                  </span>
                )}
              </span>
            )}
          </div>

          {loading && !data?.top100?.length
            ? Array.from({ length: 15 }, (_, i) => <Skel key={i} h={18} mb={6} />)
            : data?.top100?.length
              ? <PerfBars coins={data.top100} />
              : <div style={{ fontSize: 11, color: 'rgba(200,220,255,0.35)', padding: 20 }}>No data</div>
          }
        </div>

      </div>
    </>
  );
};

export default AltcoinSeasonTab;