'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FngPoint  { value: number; label: string }
interface ChartPoint {
  date: string; fng: number; label: string;
  price: number | null; volume: number | null;
}
interface ApiData {
  success: boolean;
  current:    { value: number; label: string; date: string };
  historical: { yesterday: FngPoint; lastWeek: FngPoint; lastMonth: FngPoint };
  yearly:     { high: { value: number; label: string; date: string };
                low:  { value: number; label: string; date: string } };
  chart:    ChartPoint[];
  source:   string;
  updatedAt: number;
  error?: string;
}
type ChartRange = '30d' | '1y' | 'all';

// ── Colour helpers ─────────────────────────────────────────────────────────────
function fngColor(v: number) {
  if (v <= 20) return '#ef4444';
  if (v <= 40) return '#f97316';
  if (v <= 60) return '#eab308';
  if (v <= 80) return '#84cc16';
  return '#22c55e';
}
function fngLabel(v: number) {
  if (v <= 20) return 'Extreme Fear';
  if (v <= 40) return 'Fear';
  if (v <= 60) return 'Neutral';
  if (v <= 80) return 'Greed';
  return 'Extreme Greed';
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtUSD(n: number) {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(2)  + 'M';
  return '$' + n.toFixed(0);
}

// ── Injected responsive CSS ────────────────────────────────────────────────────
const CSS = `
  .fgt-root {
    display: flex; flex-direction: column; height: 100%;
    background: #090f1f;
    font-family: "IBM Plex Mono", "Courier New", monospace;
    color: #c0d8f0; overflow: hidden; box-sizing: border-box;
  }
  .fgt-header {
    padding: 12px 16px 8px; flex-shrink: 0;
    border-bottom: 1px solid rgba(100,200,100,0.08);
  }
  .fgt-header-row {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  }
  .fgt-body {
    flex: 1; min-height: 0; overflow: hidden;
    display: flex; flex-direction: column;
  }
  .fgt-main {
    flex: 1; min-height: 0; display: flex; gap: 10px;
    padding: 10px 16px; overflow: hidden;
  }
  /* ── sidebar ── */
  .fgt-sidebar {
    width: 256px; flex-shrink: 0;
    display: flex; flex-direction: column; gap: 10px;
    overflow-y: auto; overflow-x: hidden;
  }
  .fgt-card {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(100,200,100,0.13);
    border-radius: 8px; padding: 14px; flex-shrink: 0;
  }
  .fgt-card-title {
    font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
    color: rgba(180,220,180,0.55); text-transform: uppercase; margin-bottom: 12px;
  }
  /* ── chart panel ── */
  .fgt-chart-panel {
    flex: 1; min-width: 0; min-height: 0;
    display: flex; flex-direction: column;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(100,200,100,0.13);
    border-radius: 8px; overflow: hidden;
  }
  .fgt-chart-header {
    padding: 10px 14px; flex-shrink: 0;
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid rgba(100,200,100,0.08);
    flex-wrap: wrap; gap: 6px;
  }
  .fgt-legend {
    display: flex; gap: 14px; padding: 6px 14px; flex-shrink: 0;
    flex-wrap: wrap; border-bottom: 1px solid rgba(100,200,100,0.06);
  }
  .fgt-chart-area { flex: 1; min-height: 0; position: relative; }
  /* ── about ── */
  .fgt-about {
    flex-shrink: 0; padding: 12px 16px;
    border-top: 1px solid rgba(100,200,100,0.08);
  }
  /* ── badge ── */
  .fgt-badge {
    display: inline-flex; align-items: center;
    padding: 3px 10px; border-radius: 5px;
    font-size: 11px; font-weight: 700; white-space: nowrap;
  }
  /* ── hist row ── */
  .fgt-hist-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 0; border-bottom: 1px solid rgba(100,200,100,0.06);
    gap: 8px;
  }
  .fgt-hist-row:last-child { border-bottom: none; }
  .fgt-hist-label { font-size: 12px; color: rgba(180,210,255,0.7); white-space: nowrap; }

  /* ── RESPONSIVE: narrow ── */
  @media (max-width: 700px) {
    .fgt-main { flex-direction: column; padding: 8px; overflow-y: auto; overflow-x: hidden; }
    .fgt-sidebar { width: 100%; flex-direction: row; flex-wrap: wrap; overflow: visible; }
    .fgt-card { flex: 1 1 200px; min-width: 0; }
    .fgt-chart-panel { min-height: 300px; }
  }
  @media (max-width: 480px) {
    .fgt-sidebar { flex-direction: column; }
    .fgt-card { flex: unset; }
    .fgt-legend { gap: 8px; }
    .fgt-legend span { font-size: 10px; }
  }

  /* ── toggle btn ── */
  .fgt-toggle-btn {
    border-radius: 3px; font-family: monospace;
    text-transform: uppercase; font-size: 11px;
    cursor: pointer; padding: 2px 9px; transition: all 0.15s;
    line-height: 1.6;
  }
  .fgt-toggle-btn.active {
    background: rgba(100,200,100,0.2);
    border: 1px solid rgba(100,200,100,0.5);
    color: #86efac;
  }
  .fgt-toggle-btn.inactive {
    background: transparent;
    border: 1px solid rgba(100,200,100,0.15);
    color: rgba(100,200,100,0.35);
  }
  .fgt-toggle-btn.inactive:hover {
    border-color: rgba(100,200,100,0.3);
    color: rgba(100,200,100,0.6);
  }

  /* Gauge number */
  .fgt-gauge-num {
    font-size: 42px; font-weight: 900; line-height: 1; text-align: center;
  }
  .fgt-gauge-lbl {
    font-size: 12px; font-weight: 600; text-align: center; margin-top: 2px;
  }
  /* skeleton pulse */
  @keyframes fgt-pulse { 0%,100%{opacity:.4} 50%{opacity:.15} }
  .fgt-skeleton {
    background: rgba(100,200,100,0.12); border-radius: 4px;
    animation: fgt-pulse 1.5s ease-in-out infinite;
  }
`;

// ── TimeToggle ────────────────────────────────────────────────────────────────
const TimeToggle: React.FC<{ value: ChartRange; onChange: (v: ChartRange) => void }> = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 3 }}>
    {(['30d', '1y', 'all'] as ChartRange[]).map(opt => (
      <button key={opt} onClick={() => onChange(opt)}
        className={`fgt-toggle-btn ${value === opt ? 'active' : 'inactive'}`}>
        {opt}
      </button>
    ))}
  </div>
);

// ── Badge ─────────────────────────────────────────────────────────────────────
const Badge: React.FC<{ value: number }> = ({ value }) => {
  const c = fngColor(value);
  return (
    <span className="fgt-badge" style={{
      background: c + '1a', border: `1px solid ${c}44`, color: c,
    }}>
      {fngLabel(value)} · {value}
    </span>
  );
};

// ── Gauge ─────────────────────────────────────────────────────────────────────
const Gauge: React.FC<{ value: number }> = ({ value }) => {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const size = Math.min(wrap.clientWidth, 220);
    const W = size; const H = Math.round(size * 0.6);
    canvas.width  = W * window.devicePixelRatio;
    canvas.height = H * window.devicePixelRatio;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H - 8;
    const R  = Math.min(W * 0.44, H * 0.85);

    const ZONES = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e'];
    let a = Math.PI;
    const sweep = Math.PI / 5;
    ZONES.forEach(col => {
      // outer fill
      ctx.beginPath();
      ctx.arc(cx, cy, R,          a, a + sweep);
      ctx.arc(cx, cy, R * 0.72,   a + sweep, a, true);
      ctx.closePath();
      ctx.fillStyle = col + '40'; ctx.fill();
      // bright thin ring
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.72,   a, a + sweep);
      ctx.arc(cx, cy, R * 0.68,   a + sweep, a, true);
      ctx.closePath();
      ctx.fillStyle = col + 'bb'; ctx.fill();
      a += sweep;
    });

    // needle
    const na = Math.PI + (value / 100) * Math.PI;
    const nx = cx + Math.cos(na) * R * 0.62;
    const ny = cy + Math.sin(na) * R * 0.62;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
  }, [value]);

  useEffect(() => {
    paint();
    const ro = new ResizeObserver(paint);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [paint]);

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <canvas ref={canvasRef} />
      <div className="fgt-gauge-num" style={{ color: fngColor(value) }}>{value}</div>
      <div className="fgt-gauge-lbl" style={{ color: fngColor(value) }}>{fngLabel(value)}</div>
    </div>
  );
};

// ── Chart ─────────────────────────────────────────────────────────────────────
const CHART_ZONES = [
  { yMin: 75, yMax: 100, label: 'Extreme Greed', color: 'rgba(34,197,94,0.07)'   },
  { yMin: 55, yMax: 75,  label: 'Greed',          color: 'rgba(132,204,22,0.055)' },
  { yMin: 45, yMax: 55,  label: 'Neutral',         color: 'rgba(234,179,8,0.04)'  },
  { yMin: 25, yMax: 45,  label: 'Fear',             color: 'rgba(249,115,22,0.055)'},
  { yMin: 0,  yMax: 25,  label: 'Extreme Fear',    color: 'rgba(239,68,68,0.09)'  },
];

const FearGreedChart: React.FC<{ data: ChartPoint[]; range: ChartRange }> = ({ data, range }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tipIdx, setTipIdx] = useState<number | null>(null);

  const sliced = range === '30d' ? data.slice(-30) : range === '1y' ? data.slice(-365) : data;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const cont   = containerRef.current;
    if (!canvas || !cont || sliced.length < 2) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const DPR = window.devicePixelRatio || 1;
    const W   = cont.clientWidth;
    const H   = cont.clientHeight;
    canvas.width  = W * DPR; canvas.height = H * DPR;
    canvas.style.width  = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR);
    ctx.clearRect(0, 0, W, H);

    // Dynamic left padding based on price magnitude
    const prices  = sliced.map(d => d.price).filter(Boolean) as number[];
    const maxP    = prices.length ? Math.max(...prices) * 1.06 : 120000;
    const minP    = prices.length ? Math.min(...prices) * 0.94 : 0;
    const priceRange = maxP - minP;
    // Estimate label width: "$120K" = 5 chars × ~6px
    const leftPad = priceRange > 0 ? 44 : 10;

    const pad = { top: 16, right: 54, bottom: 32, left: leftPad };
    const cw  = W - pad.left - pad.right;
    const ch  = H - pad.top  - pad.bottom;

    const toX  = (i: number) => pad.left + (i / (sliced.length - 1)) * cw;
    const toYP = (v: number) => pad.top  + ch - ((v - minP)  / (maxP  - minP))  * ch;
    const toYF = (v: number) => pad.top  + ch - (v / 100) * ch;

    // ── zone backgrounds ──
    for (const z of CHART_ZONES) {
      ctx.fillStyle = z.color;
      ctx.fillRect(pad.left, toYF(z.yMax), cw, toYF(z.yMin) - toYF(z.yMax));
    }

    // ── grid + right-axis (F&G) ──
    ctx.font = `${Math.max(8, Math.min(10, W / 60))}px monospace`;
    [0, 20, 40, 60, 80, 100].forEach(fv => {
      const y = toYF(fv);
      ctx.setLineDash([3, 6]); ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(180,220,180,0.09)';
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(180,220,180,0.4)'; ctx.textAlign = 'left';
      ctx.fillText(String(fv), W - pad.right + 4, y + 3);
    });

    // right zone labels (only if wide enough)
    if (W > 480) {
      ctx.font = `9px monospace`;
      CHART_ZONES.forEach(z => {
        const y = toYF((z.yMin + z.yMax) / 2);
        ctx.fillStyle = 'rgba(180,220,180,0.22)';
        ctx.textAlign = 'left';
        ctx.fillText(z.label, W - pad.right + 4, y + 14);
      });
    }

    // ── left-axis (USD price) ──
    if (prices.length > 0) {
      const pSteps = 4;
      ctx.font = `${Math.max(8, Math.min(10, W / 60))}px monospace`;
      ctx.fillStyle = 'rgba(200,210,240,0.32)';
      for (let i = 0; i <= pSteps; i++) {
        const v = minP + (i / pSteps) * priceRange;
        const y = toYP(v);
        const lbl = v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v.toFixed(0);
        ctx.textAlign = 'right';
        ctx.fillText(lbl, pad.left - 3, y + 3);
      }
    }

    // ── X axis labels ──
    const xCount = Math.max(2, Math.min(8, Math.floor(W / 80)));
    ctx.fillStyle = 'rgba(180,220,180,0.3)';
    ctx.font = '9px monospace';
    for (let i = 0; i < xCount; i++) {
      const idx = Math.floor((i / (xCount - 1)) * (sliced.length - 1));
      const d   = new Date(sliced[idx].date);
      const lbl = range === '30d'
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      ctx.textAlign = 'center';
      ctx.fillText(lbl, toX(idx), H - 6);
    }

    // axis labels
    ctx.fillStyle = 'rgba(200,210,240,0.25)'; ctx.font = '9px monospace';
    ctx.textAlign = 'left';  ctx.fillText('USD', pad.left, H - 6);
    ctx.textAlign = 'right'; ctx.fillText('F&G', W - 2, H - 6);

    // ── Volume bars ──
    const vols  = sliced.map(d => d.volume).filter(Boolean) as number[];
    const maxVol = vols.length ? Math.max(...vols) : 1;
    const barW   = Math.max(1, (cw / sliced.length) * 0.65);
    sliced.forEach((d, i) => {
      if (!d.volume) return;
      const bh = (d.volume / maxVol) * (ch * 0.22);
      ctx.fillStyle = 'rgba(120,130,160,0.18)';
      ctx.fillRect(toX(i) - barW / 2, pad.top + ch - bh, barW, bh);
    });

    // ── BTC price line ──
    if (prices.length > 0) {
      ctx.beginPath();
      let first = true;
      sliced.forEach((d, i) => {
        if (!d.price) { first = true; return; }
        const x = toX(i); const y = toYP(d.price);
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(220,225,240,0.55)';
      ctx.lineWidth = 1.3; ctx.stroke();
    }

    // ── F&G coloured line ──
    for (let i = 1; i < sliced.length; i++) {
      ctx.beginPath();
      ctx.moveTo(toX(i - 1), toYF(sliced[i - 1].fng));
      ctx.lineTo(toX(i),     toYF(sliced[i].fng));
      ctx.strokeStyle = fngColor(sliced[i].fng);
      ctx.lineWidth = 1.8; ctx.stroke();
    }

    // ── Latest value badge ──
    const last = sliced[sliced.length - 1];
    const bText = String(last.fng);
    ctx.font = 'bold 11px monospace';
    const bw  = ctx.measureText(bText).width + 10;
    const bx  = W - pad.right - bw - 2;
    const by  = toYF(last.fng);
    ctx.fillStyle = fngColor(last.fng);
    ctx.beginPath(); ctx.roundRect(bx, by - 9, bw, 18, 3); ctx.fill();
    ctx.fillStyle = '#000'; ctx.textAlign = 'center';
    ctx.fillText(bText, bx + bw / 2, by + 4);

    // ── Tooltip crosshair ──
    if (tipIdx !== null && sliced[tipIdx]) {
      const tx = toX(tipIdx);
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, pad.top); ctx.lineTo(tx, pad.top + ch); ctx.stroke();
      ctx.setLineDash([]);
      // dots
      const td = sliced[tipIdx];
      ctx.beginPath(); ctx.arc(tx, toYF(td.fng), 4, 0, Math.PI * 2);
      ctx.fillStyle = fngColor(td.fng); ctx.fill();
      if (td.price) {
        ctx.beginPath(); ctx.arc(tx, toYP(td.price), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#e2e8f0'; ctx.fill();
      }
    }
  }, [sliced, range, tipIdx]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas || sliced.length < 2) return;
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    // approximate left pad
    const prices = sliced.map(d => d.price).filter(Boolean);
    const lp = prices.length > 0 ? 44 : 10;
    const cw = canvas.clientWidth - lp - 54;
    const idx = Math.max(0, Math.min(sliced.length - 1, Math.round((mx - lp) / cw * (sliced.length - 1))));
    setTipIdx(idx);
  };

  // tooltip position
  const tipData = tipIdx !== null ? sliced[tipIdx] : null;
  const tipXPct = tipIdx !== null ? tipIdx / (sliced.length - 1) : 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMouseMove} onMouseLeave={() => setTipIdx(null)} />

      {tipData && (
        <div style={{
          position: 'absolute',
          left: tipXPct > 0.65
            ? `calc(${tipXPct * 100}% - 220px)`
            : `calc(${tipXPct * 100}% + 14px)`,
          top: 20,
          background: 'rgba(8,16,36,0.97)',
          border: '1px solid rgba(100,200,100,0.3)',
          borderRadius: 6, padding: '9px 13px', fontSize: 11,
          color: '#a0c8f0', pointerEvents: 'none', zIndex: 20,
          fontFamily: 'monospace', minWidth: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7,
            color: 'rgba(100,200,100,0.6)', fontSize: 10, borderBottom: '1px solid rgba(100,200,100,0.1)', paddingBottom: 5 }}>
            <span>{fmtDate(tipData.date)}</span>
            <span>05:00:00 AM</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: fngColor(tipData.fng), flexShrink: 0, display: 'inline-block' }} />
            <span style={{ color: 'rgba(180,220,180,0.65)', flexShrink: 0 }}>F&G Index:</span>
            <span style={{ color: fngColor(tipData.fng), fontWeight: 800, marginLeft: 'auto' }}>{tipData.fng}</span>
          </div>
          {tipData.price != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e2e8f0', flexShrink: 0, display: 'inline-block' }} />
              <span style={{ color: 'rgba(180,200,240,0.65)', flexShrink: 0 }}>BTC Price:</span>
              <span style={{ color: '#fff', fontWeight: 700, marginLeft: 'auto' }}>
                ${tipData.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
          {tipData.volume != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', flexShrink: 0, display: 'inline-block' }} />
              <span style={{ color: 'rgba(150,170,200,0.65)', flexShrink: 0 }}>Volume:</span>
              <span style={{ color: '#cbd5e1', fontWeight: 700, marginLeft: 'auto' }}>{fmtUSD(tipData.volume)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── About accordion ───────────────────────────────────────────────────────────
const About: React.FC = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="fgt-about">
      <div style={{ fontSize: 14, fontWeight: 700, color: '#e8f4ff', marginBottom: 8 }}>
        About CMC Crypto Fear and Greed Index
      </div>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(100,200,100,0.1)', borderRadius: 7, overflow: 'hidden' }}>
        <div onClick={() => setOpen(o => !o)} style={{
          padding: '10px 14px', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: open ? '1px solid rgba(100,200,100,0.08)' : 'none',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#ddf0ff' }}>What is the CMC Fear and Greed Index?</span>
          <span style={{ color: 'rgba(100,200,100,0.45)', fontSize: 14, lineHeight: 1 }}>{open ? '∧' : '∨'}</span>
        </div>
        {open && (
          <div style={{ padding: '10px 14px', fontSize: 11, color: 'rgba(180,210,255,0.55)', lineHeight: 1.75 }}>
            The CMC Fear and Greed Index measures the prevailing sentiment in the cryptocurrency market on a scale of
            0–100. A lower value indicates <strong style={{ color: '#ef4444' }}>Extreme Fear</strong> (potential buying opportunity),
            while a higher value indicates <strong style={{ color: '#22c55e' }}>Extreme Greed</strong> (market may be overheated).
            Calculated using price momentum, volatility, social media trends, Bitcoin dominance, and market composition.
            Live data sourced from <span style={{ color: 'rgba(100,200,100,0.6)' }}>Alternative.me</span> &amp; <span style={{ color: 'rgba(100,200,100,0.6)' }}>CoinGecko</span>.
          </div>
        )}
      </div>
    </div>
  );
};

// ── Skeleton card ─────────────────────────────────────────────────────────────
const Skeleton: React.FC<{ h?: number }> = ({ h = 16 }) => (
  <div className="fgt-skeleton" style={{ height: h, borderRadius: 4, marginBottom: 8 }} />
);

// ── Main Component ─────────────────────────────────────────────────────────────
const FearGreedTab: React.FC = () => {
  const [data,        setData]        = useState<ApiData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [range,       setRange]       = useState<ChartRange>('1y');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res  = await fetch('/api/fear-greed');
      const json: ApiData = await res.json();
      if (!json.success) throw new Error(json.error ?? 'API error');
      setData(json);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(fetchData, 3600_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const curr = data?.current;
  const hist = data?.historical;
  const yr   = data?.yearly;

  return (
    <>
      {/* Inject CSS once */}
      <style>{CSS}</style>

      <div className="fgt-root">
        {/* ── Header ── */}
        <div className="fgt-header">
          <div className="fgt-header-row">
            <span style={{ fontSize: 15, fontWeight: 800, color: '#e8f4ff', letterSpacing: '0.01em' }}>
              CMC Crypto
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(100,200,100,0.55)' }}>
              Fear and Greed Index
            </span>
            <button style={{
              background: 'rgba(100,200,100,0.08)', border: '1px solid rgba(100,200,100,0.28)',
              color: '#86efac', padding: '2px 10px', fontSize: 10, cursor: 'pointer',
              borderRadius: 4, fontFamily: 'monospace', letterSpacing: '0.04em',
            }}>See API Details</button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              {data && (
                <span style={{ fontSize: 9, color: 'rgba(100,200,100,0.35)', textAlign: 'right', lineHeight: 1.5 }}>
                  {data.source}<br />Updated: {lastUpdated}
                </span>
              )}
              <button onClick={fetchData} disabled={loading} style={{
                background: 'rgba(100,200,100,0.08)', border: '1px solid rgba(100,200,100,0.25)',
                color: '#86efac', padding: '3px 10px', fontSize: 10,
                cursor: loading ? 'default' : 'pointer',
                borderRadius: 3, fontFamily: 'monospace', opacity: loading ? 0.5 : 1,
              }}>
                {loading ? '↻ Loading…' : '↺ Refresh'}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(100,200,100,0.38)', marginTop: 5, lineHeight: 1.5 }}>
            Discover our Fear and Greed Index — a powerful tool that analyzes market sentiment to help you make
            informed crypto investment decisions. Real-time and historical data powered by Alternative.me &amp; CoinGecko.
          </div>
        </div>

        {error && (
          <div style={{
            margin: '6px 16px 0', background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5',
            padding: '6px 12px', borderRadius: 5, fontSize: 11, flexShrink: 0,
          }}>⚠ {error}</div>
        )}

        {/* ── Body ── */}
        <div className="fgt-body">
          <div className="fgt-main">

            {/* ── Left Sidebar ── */}
            <div className="fgt-sidebar">

              {/* Current Score */}
              <div className="fgt-card">
                <div className="fgt-card-title">Current Score</div>
                {loading && !curr
                  ? <><Skeleton h={100} /><Skeleton h={20} /></>
                  : curr
                    ? <Gauge value={curr.value} />
                    : null
                }
              </div>

              {/* Historical Values */}
              <div className="fgt-card">
                <div className="fgt-card-title">Historical Values</div>
                {loading && !hist
                  ? <><Skeleton h={24} /><Skeleton h={24} /><Skeleton h={24} /></>
                  : hist
                    ? <>
                        {([
                          { label: 'Yesterday',  d: hist.yesterday },
                          { label: 'Last Week',  d: hist.lastWeek  },
                          { label: 'Last Month', d: hist.lastMonth },
                        ] as const).map(({ label, d }) => (
                          <div key={label} className="fgt-hist-row">
                            <span className="fgt-hist-label">{label}</span>
                            <Badge value={d.value} />
                          </div>
                        ))}
                      </>
                    : null
                }
              </div>

              {/* Yearly High & Low */}
              <div className="fgt-card">
                <div className="fgt-card-title">Yearly High &amp; Low</div>
                {loading && !yr
                  ? <><Skeleton h={24} /><Skeleton h={24} /></>
                  : yr
                    ? <>
                        <div className="fgt-hist-row">
                          <div style={{ fontSize: 11, color: 'rgba(180,210,255,0.65)', lineHeight: 1.4 }}>
                            <div style={{ color: 'rgba(180,210,255,0.4)', fontSize: 10, marginBottom: 2 }}>Yearly High</div>
                            {fmtDate(yr.high.date)}
                          </div>
                          <Badge value={yr.high.value} />
                        </div>
                        <div className="fgt-hist-row">
                          <div style={{ fontSize: 11, color: 'rgba(180,210,255,0.65)', lineHeight: 1.4 }}>
                            <div style={{ color: 'rgba(180,210,255,0.4)', fontSize: 10, marginBottom: 2 }}>Yearly Low</div>
                            {fmtDate(yr.low.date)}
                          </div>
                          <Badge value={yr.low.value} />
                        </div>
                      </>
                    : null
                }
              </div>

            </div>

            {/* ── Chart Panel ── */}
            <div className="fgt-chart-panel">
              <div className="fgt-chart-header">
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e0f0ff' }}>
                  Fear and Greed Index Chart
                </span>
                <TimeToggle value={range} onChange={setRange} />
              </div>

              <div className="fgt-legend">
                {[
                  { color: '#22c55e', label: 'CMC Crypto Fear and Greed Index' },
                  { color: '#dce8ff', label: 'Bitcoin Price'  },
                  { color: '#94a3b8', label: 'Bitcoin Volume' },
                ].map(({ color, label }) => (
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(180,210,255,0.55)' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                    {label}
                  </span>
                ))}
              </div>

              <div className="fgt-chart-area">
                {loading && !data?.chart?.length
                  ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                      height: '100%', gap: 10, color: 'rgba(100,200,100,0.4)', fontSize: 12 }}>
                      <span style={{ animation: 'fgt-pulse 1s ease-in-out infinite', fontSize: 18 }}>◌</span>
                      Loading chart data…
                    </div>
                  )
                  : data?.chart?.length
                    ? <FearGreedChart data={data.chart} range={range} />
                    : null
                }
              </div>
            </div>

          </div>

          {/* ── About ── */}
          <About />
        </div>
      </div>
    </>
  );
};

export default FearGreedTab;