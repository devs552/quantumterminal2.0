'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface HighLowEntry  { coin: string; name: string; exchange: string; rate: number }
interface HeatmapEntry  { symbol: string; name: string; image: string; marketCap: number; price: number; openInterest: number; rate: number; avgRate: number }
interface TableRow      { rank: number; symbol: string; name: string; image: string; price: number; marketCap: number; binanceRate: number | null; bybitRate: number | null; okxRate: number | null; gateRate: number | null; avgRate: number; nextFundingTime: number }
interface ApiData {
  success: boolean;
  avgFundingRate: number;
  longsPayShorts: boolean;
  highest: HighLowEntry[];
  lowest:  HighLowEntry[];
  heatmap: HeatmapEntry[];
  tableRows: TableRow[];
  totalCoins: number;
  source: string;
  updatedAt: number;
  error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const rateColor  = (r: number) => r > 0 ? '#22c55e' : r < 0 ? '#ef4444' : '#6b7280';
const rateColor2 = (r: number | null) => r === null ? '#6b7280' : r > 0 ? '#22c55e' : r < 0 ? '#ef4444' : '#6b7280';
const fmtRate    = (r: number | null, decimals = 3) =>
  r === null ? '—' : (r >= 0 ? '+' : '') + r.toFixed(decimals) + '%';
function fmtMcap(n: number) {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(1)  + 'M';
  return '$' + n.toFixed(0);
}
function fmtCountdown(ts: number) {
  const diff = ts - Date.now();
  if (diff <= 0) return '00:00:00';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
  .fr-root {
    display:flex; flex-direction:column; height:100%;
    background:#090f1e; font-family:"IBM Plex Mono","Courier New",monospace;
    color:#c8d8f4; overflow:hidden; box-sizing:border-box;
  }
  .fr-hdr { padding:10px 16px 8px; flex-shrink:0; border-bottom:1px solid rgba(255,255,255,0.06); }
  .fr-hrow { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .fr-body { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; display:flex; flex-direction:column; }
  /* top row */
  .fr-top { display:flex; gap:10px; padding:10px 16px; flex-shrink:0; height:340px; }
  .fr-sidebar { width:240px; flex-shrink:0; display:flex; flex-direction:column; gap:8px; }
  .fr-card { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:11px 13px; }
  .fr-card-title { font-size:10px; font-weight:700; color:rgba(200,220,255,0.45); text-transform:uppercase; letter-spacing:.07em; margin-bottom:8px; display:flex; align-items:center; gap:5px; }
  .fr-avg-big { font-size:28px; font-weight:900; line-height:1; }
  .fr-avg-pp  { font-size:11px; font-weight:700; margin-left:6px; }
  .fr-status-pill {
    display:inline-flex; align-items:center; padding:2px 10px; border-radius:12px;
    font-size:10px; font-weight:700; margin-top:5px;
  }
  .fr-hl-row { display:flex; align-items:center; gap:6px; padding:4px 0;
    border-bottom:1px solid rgba(255,255,255,0.05); }
  .fr-hl-row:last-child { border-bottom:none; }
  .fr-hl-coin { font-size:11px; font-weight:700; color:#e2f0ff; min-width:36px; }
  .fr-hl-ex   { font-size:9px; color:rgba(200,220,255,0.35); flex:1; }
  .fr-hl-rate { font-size:11px; font-weight:700; }
  /* heatmap panel */
  .fr-heatmap-panel {
    flex:1; min-width:0; height:100%; display:flex; flex-direction:column;
    background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; overflow:hidden; box-sizing:border-box;
  }
  .fr-ch-hdr { padding:8px 13px; display:flex; justify-content:space-between; align-items:center;
    border-bottom:1px solid rgba(255,255,255,0.05); flex-shrink:0; flex-wrap:wrap; gap:4px; }
  .fr-ch-title { font-size:12px; font-weight:700; color:#e2f0ff; display:flex; align-items:center; gap:5px; }
  .fr-chart-area { flex:1; min-height:0; position:relative; overflow:hidden; }
  .fr-chart-area > div { position:absolute; inset:0; }
  /* table */
  .fr-table-sec { padding:0 16px 14px; flex-shrink:0; }
  .fr-tbl { width:100%; border-collapse:collapse; font-size:11px; }
  .fr-tbl th { padding:7px 10px; text-align:left; font-size:9px; font-weight:600;
    color:rgba(180,210,255,0.4); border-bottom:1px solid rgba(255,255,255,0.07);
    letter-spacing:.05em; cursor:pointer; white-space:nowrap; user-select:none; }
  .fr-tbl td { padding:7px 10px; border-bottom:1px solid rgba(255,255,255,0.04); white-space:nowrap; }
  .fr-tbl tr:hover td { background:rgba(100,180,255,0.04); }
  /* skeleton */
  @keyframes fr-pulse { 0%,100%{opacity:.35} 50%{opacity:.12} }
  .fr-skel { background:rgba(255,255,255,0.08); border-radius:4px; animation:fr-pulse 1.4s ease-in-out infinite; }
  /* responsive */
  @media(max-width:800px){
    .fr-top { flex-direction:column; height:auto; }
    .fr-sidebar { width:100%; flex-direction:row; flex-wrap:wrap; }
    .fr-card { flex:1 1 180px; }
    .fr-heatmap-panel { flex:none; height:280px; }
  }
  @media(max-width:520px){
    .fr-sidebar { flex-direction:column; }
    .fr-card { flex:unset; }
    .fr-top,.fr-table-sec { padding-left:8px; padding-right:8px; }
  }
  .fr-body::-webkit-scrollbar { width:4px; }
  .fr-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
  .fr-info-icon { font-size:10px; color:rgba(180,200,255,0.3); cursor:default; }
`;

// ── Skeleton ───────────────────────────────────────────────────────────────────
const Skel: React.FC<{ h?: number; mb?: number }> = ({ h = 14, mb = 6 }) => (
  <div className="fr-skel" style={{ height: h, marginBottom: mb }} />
);

// ── Heatmap Scatter Plot ───────────────────────────────────────────────────────
const HeatmapChart: React.FC<{ data: HeatmapEntry[] }> = ({ data }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; entry: HeatmapEntry } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; const cont = containerRef.current;
    if (!canvas || !cont || data.length < 2) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;
    const W = cont.clientWidth; const H = cont.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR); ctx.clearRect(0, 0, W, H);

    const PAD = { top: 16, right: 60, bottom: 28, left: 10 };
    const cw = W - PAD.left - PAD.right;
    const ch = H - PAD.top  - PAD.bottom;

    // X: log10(marketCap)
    const mcaps  = data.map(d => d.marketCap).filter(m => m > 0);
    const maxMC  = Math.max(...mcaps);
    const minMC  = Math.min(...mcaps);
    const logMax = Math.log10(maxMC);
    const logMin = Math.log10(minMC);

    // Y: funding rate
    const rates  = data.map(d => d.rate);
    const absMax = Math.max(Math.max(...rates.map(Math.abs)), 0.01);
    const yRange = absMax * 1.4;

    const toX = (mc: number) => {
      if (mc <= 0) return PAD.left;
      return PAD.left + ((Math.log10(mc) - logMin) / (logMax - logMin)) * cw;
    };
    const toY = (r: number) => PAD.top + ch / 2 - (r / yRange) * (ch / 2);

    const fsz = Math.max(8, Math.min(10, W / 70));

    // Y-axis grid + labels (right side, % rate)
    const ySteps = [absMax * 0.5, 0, -absMax * 0.5];
    ySteps.push(yRange / 1.4); ySteps.push(-yRange / 1.4);
    [absMax * 0.2, 0.1, -0.1, -absMax * 0.2].forEach(v => {
      const y = toY(v);
      if (y < PAD.top || y > PAD.top + ch) return;
      ctx.setLineDash([3, 6]); ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(200,220,255,0.35)'; ctx.font = `${fsz}px monospace`; ctx.textAlign = 'left';
      ctx.fillText((v >= 0 ? '' : '') + v.toFixed(1) + '%', W - PAD.right + 3, y + 3);
    });

    // Zero line (prominent)
    const zeroY = toY(0);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(PAD.left, zeroY); ctx.lineTo(W - PAD.right, zeroY); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = `${fsz}px monospace`;
    ctx.textAlign = 'left'; ctx.fillText('0', W - PAD.right + 3, zeroY + 3);

    // X-axis labels (market cap)
    const xLabels = [1e12, 1e11, 1e10, 1e9, 1e8, 1e7, 1e6];
    ctx.fillStyle = 'rgba(180,200,240,0.3)'; ctx.font = `${fsz}px monospace`;
    xLabels.forEach(mc => {
      if (mc < minMC * 0.5 || mc > maxMC * 2) return;
      const x = toX(mc);
      if (x < PAD.left || x > W - PAD.right) return;
      ctx.textAlign = 'center';
      ctx.fillText(fmtMcap(mc), x, H - 5);
      ctx.setLineDash([3, 6]); ctx.lineWidth = 0.3; ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + ch); ctx.stroke();
      ctx.setLineDash([]);
    });

    // Axis labels
    ctx.fillStyle = 'rgba(200,210,240,0.22)'; ctx.font = `${fsz}px monospace`;
    ctx.textAlign = 'left'; ctx.fillText('Market Cap (USD)', PAD.left, H - 4);
    ctx.textAlign = 'right'; ctx.fillText('Avg Funding Rate', W - 2, H - 4);

    // Dots
    for (const entry of data) {
      if (entry.marketCap <= 0) continue;
      const x = toX(entry.marketCap);
      const y = toY(entry.rate);
      if (x < PAD.left || x > W - PAD.right || y < PAD.top || y > PAD.top + ch) continue;

      const isPos = entry.rate >= 0;
      const r = Math.max(3, Math.min(10, Math.log10(entry.marketCap + 1) - 5));
      const color = isPos ? '#22c55e' : '#ef4444';

      // Glow
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      glow.addColorStop(0, color + '55'); glow.addColorStop(1, color + '00');
      ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fillStyle = glow; ctx.fill();

      // Dot
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color + 'dd'; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 0.7; ctx.stroke();

      // Label for large-cap coins
      if (entry.marketCap > 1e10) {
        ctx.fillStyle = 'rgba(220,230,255,0.75)';
        ctx.font = `${Math.max(8, fsz - 1)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(entry.symbol, x, y - r - 3);
      }
    }
  }, [data]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; const cont = containerRef.current;
    if (!canvas || !cont || data.length < 2) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;

    const PAD = { left: 10, right: 60, top: 16, bottom: 28 };
    const cw = cont.clientWidth - PAD.left - PAD.right;
    const ch = cont.clientHeight - PAD.top - PAD.bottom;
    const mcaps = data.filter(d => d.marketCap > 0).map(d => d.marketCap);
    const maxMC = Math.max(...mcaps); const minMC = Math.min(...mcaps);
    const logMax = Math.log10(maxMC); const logMin = Math.log10(minMC);
    const rates  = data.map(d => d.rate);
    const absMax = Math.max(Math.max(...rates.map(Math.abs)), 0.01);
    const yRange = absMax * 1.4;

    const toX = (mc: number) => mc <= 0 ? PAD.left : PAD.left + ((Math.log10(mc) - logMin) / (logMax - logMin)) * cw;
    const toY = (r: number)  => PAD.top + ch / 2 - (r / yRange) * (ch / 2);

    // Find nearest dot
    let best: HeatmapEntry | null = null;
    let bestDist = 30;
    for (const entry of data) {
      if (entry.marketCap <= 0) continue;
      const dx = mx - toX(entry.marketCap);
      const dy = my - toY(entry.rate);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) { bestDist = dist; best = entry; }
    }
    setTip(best ? { x: mx, y: my, entry: best } : null);
  };

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => setTip(null)} />
      {tip && (
        <div style={{
          position: 'absolute',
          left: tip.x > (containerRef.current?.clientWidth ?? 600) * 0.65 ? undefined : tip.x + 14,
          right: tip.x > (containerRef.current?.clientWidth ?? 600) * 0.65 ? 65 : undefined,
          top: Math.max(8, tip.y - 90),
          background: 'rgba(5,10,28,0.97)', border: '1px solid rgba(100,180,255,0.25)',
          borderRadius: 6, padding: '9px 13px', fontSize: 10, color: '#a8c0f0',
          pointerEvents: 'none', zIndex: 20, fontFamily: 'monospace', minWidth: 200,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
            borderBottom: '1px solid rgba(100,180,255,0.1)', paddingBottom: 5 }}>
            {tip.entry.image && (
              <img src={tip.entry.image} width={14} height={14} style={{ borderRadius: '50%' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <span style={{ color: '#e2f0ff', fontWeight: 700 }}>{tip.entry.symbol}</span>
            <span style={{ color: 'rgba(180,210,255,0.5)' }}>{tip.entry.name}</span>
          </div>
          {[
            { label: 'Price',           val: `$${tip.entry.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}` },
            { label: 'Market Cap',      val: fmtMcap(tip.entry.marketCap) },
            { label: 'Open Interest',   val: tip.entry.openInterest > 0 ? fmtMcap(tip.entry.openInterest) : '—' },
            { label: 'Avg Funding Rate', val: fmtRate(tip.entry.rate) },
          ].map(({ label, val }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, gap: 12 }}>
              <span style={{ color: 'rgba(180,200,240,0.55)' }}>{label}:</span>
              <span style={{ color: label.includes('Rate') ? rateColor(tip.entry.rate) : '#e2f0ff', fontWeight: 700 }}>{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Countdown timer ────────────────────────────────────────────────────────────
const Countdown: React.FC<{ ts: number }> = ({ ts }) => {
  const [val, setVal] = useState(fmtCountdown(ts));
  useEffect(() => {
    const id = setInterval(() => setVal(fmtCountdown(ts)), 1000);
    return () => clearInterval(id);
  }, [ts]);
  return <span style={{ fontSize: 9, color: 'rgba(200,220,255,0.35)' }}>{val}</span>;
};

// ── Funding Table ──────────────────────────────────────────────────────────────
const EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Gate'];
type SortKey = 'rank' | 'name' | 'avgRate' | 'binanceRate' | 'bybitRate' | 'okxRate' | 'gateRate';

const FundingTable: React.FC<{ rows: TableRow[] }> = ({ rows }) => {
  const [sk, setSk] = useState<SortKey>('rank');
  const [asc, setAsc] = useState(true);
  const [filter, setFilter] = useState('');

  const filtered = rows.filter(r =>
    !filter || r.symbol.toLowerCase().includes(filter.toLowerCase()) ||
    r.name.toLowerCase().includes(filter.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const getVal = (r: TableRow): number | string => {
      if (sk === 'rank')        return r.rank;
      if (sk === 'name')        return r.name;
      if (sk === 'avgRate')     return r.avgRate;
      if (sk === 'binanceRate') return r.binanceRate ?? -999;
      if (sk === 'bybitRate')   return r.bybitRate   ?? -999;
      if (sk === 'okxRate')     return r.okxRate     ?? -999;
      if (sk === 'gateRate')    return r.gateRate    ?? -999;
      return r.rank;
    };
    const av = getVal(a); const bv = getVal(b);
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv : String(av).localeCompare(String(bv));
    return asc ? cmp : -cmp;
  });

  const TH = ({ label, k }: { label: string; k: SortKey }) => (
    <th style={{ color: sk === k ? '#f7931a' : undefined }}
      onClick={() => { if (sk === k) setAsc(a => !a); else { setSk(k); setAsc(false); } }}>
      {label} {sk === k ? (asc ? '▲' : '▼') : '⇅'}
    </th>
  );

  const ExchangeHeader = ({ name }: { name: string }) => (
    <th style={{ textAlign: 'center' }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer' }}>
        {name}
      </span>
    </th>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2f0ff', display: 'flex', alignItems: 'center', gap: 6 }}>
          Cryptocurrency Funding Rates <span className="fr-info-icon">ⓘ</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text" placeholder="Search coin…" value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#c8d8f4', padding: '4px 10px', fontSize: 10, fontFamily: 'monospace',
              borderRadius: 3, outline: 'none', width: 140 }} />
          <button style={{ background: 'rgba(100,180,255,0.08)', border: '1px solid rgba(100,180,255,0.2)',
            color: '#93c5fd', padding: '3px 10px', fontSize: 10, borderRadius: 3,
            fontFamily: 'monospace', cursor: 'pointer' }}>Exchanges</button>
          <button style={{ background: 'rgba(100,180,255,0.08)', border: '1px solid rgba(100,180,255,0.2)',
            color: '#93c5fd', padding: '3px 10px', fontSize: 10, borderRadius: 3,
            fontFamily: 'monospace', cursor: 'pointer' }}>Coins</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="fr-tbl">
          <thead>
            <tr>
              <TH label="#"    k="rank" />
              <TH label="Name" k="name" />
              <ExchangeHeader name="Binance"  />
              <ExchangeHeader name="OKX"      />
              <ExchangeHeader name="Gate"     />
              <ExchangeHeader name="Bybit"    />
              <th style={{ textAlign: 'center' }}>Avg Rate</th>
              <th>Next Funding</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 30).map((row, i) => (
              <tr key={row.symbol} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                <td style={{ color: 'rgba(180,210,255,0.4)', fontSize: 10 }}>{row.rank}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {row.image && (
                      <img src={row.image} width={18} height={18}
                        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 700, color: '#e2f0ff', fontSize: 12 }}>{row.name}</div>
                      <div style={{ fontSize: 9, color: 'rgba(200,220,255,0.35)' }}>{row.symbol}</div>
                    </div>
                  </div>
                </td>
                {[
                  { rate: row.binanceRate },
                  { rate: row.okxRate    },
                  { rate: row.gateRate   },
                  { rate: row.bybitRate  },
                ].map(({ rate }, ei) => (
                  <td key={ei} style={{ textAlign: 'center', fontWeight: 700,
                    color: rateColor2(rate), fontSize: 11 }}>
                    {fmtRate(rate)}
                  </td>
                ))}
                <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 11,
                  color: rateColor(row.avgRate) }}>
                  {fmtRate(row.avgRate)}
                </td>
                <td style={{ fontSize: 9 }}>
                  <Countdown ts={row.nextFundingTime} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const FundingRatesTab: React.FC = () => {
  const [data,    setData]    = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [updated, setUpdated] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res  = await fetch('/api/funding-rates');
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
    const id = setInterval(fetchData, 60_000); // refresh every minute
    return () => clearInterval(id);
  }, [fetchData]);

  const avg = data?.avgFundingRate ?? 0;
  const pos = (data?.longsPayShorts) ?? (avg >= 0);

  return (
    <>
      <style>{CSS}</style>
      <div className="fr-root">

        {/* Header */}
        <div className="fr-hdr">
          <div className="fr-hrow">
            <span style={{ fontSize: 15, fontWeight: 800, color: '#e2f0ff' }}>Crypto Funding Rates Dashboard</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {data && <span style={{ fontSize: 9, color: 'rgba(200,220,255,0.3)', lineHeight: 1.6 }}>
                {data.source}<br />Updated: {updated}
              </span>}
              <button onClick={fetchData} disabled={loading} style={{
                background: 'rgba(100,180,255,0.08)', border: '1px solid rgba(100,180,255,0.2)',
                color: '#93c5fd', padding: '3px 10px', fontSize: 10,
                cursor: loading ? 'default' : 'pointer', borderRadius: 3,
                fontFamily: 'monospace', opacity: loading ? 0.5 : 1,
              }}>{loading ? '↻ Loading…' : '↺ Refresh'}</button>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(200,220,255,0.3)', marginTop: 3, lineHeight: 1.5 }}>
            This dashboard details the funding rates of cryptocurrencies including open interest.
            Information provided for individual cryptocurrencies and the crypto market as a whole.
            Real-time data from Binance, Bybit, OKX and Gate.io public APIs.
          </div>
        </div>

        {error && (
          <div style={{ margin: '6px 16px 0', background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5',
            padding: '6px 12px', borderRadius: 5, fontSize: 11, flexShrink: 0 }}>⚠ {error}</div>
        )}

        <div className="fr-body">
          {/* Top row */}
          <div className="fr-top">

            {/* Sidebar */}
            <div className="fr-sidebar overflow-y-scroll">

              {/* Average Rate */}
              <div className="fr-card">
                <div className="fr-card-title">Average Funding Rates <span className="fr-info-icon">ⓘ</span></div>
                {loading && !data ? <Skel h={32} /> : data ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span className="fr-avg-big" style={{ color: rateColor(avg) }}>
                        {avg >= 0 ? '+' : ''}{avg.toFixed(3)}%
                      </span>
                      <span className="fr-avg-pp" style={{ color: 'rgba(200,220,255,0.4)' }}>
                        ▾ {Math.abs(avg * 0.1).toFixed(3)} pp
                      </span>
                    </div>
                    <div className="fr-status-pill" style={{
                      background: pos ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      border: `1px solid ${pos ? '#22c55e' : '#ef4444'}40`,
                      color: pos ? '#22c55e' : '#ef4444',
                    }}>
                      {pos ? '🟢 Longs pay Shorts' : '🔴 Shorts pay Longs'}
                    </div>
                  </>
                ) : null}
              </div>

              {/* Highest */}
              <div className="fr-card" style={{ flex: 1 }}>
                <div className="fr-card-title">Highest Funding Rates</div>
                {loading && !data
                  ? <><Skel h={16} /><Skel h={16} /><Skel h={16} /><Skel h={16} /><Skel h={16} /></>
                  : data?.highest.map((entry, i) => (
                    <div key={i} className="fr-hl-row">
                      <span className="fr-hl-coin">{entry.coin}</span>
                      <span className="fr-hl-ex">@ {entry.exchange}</span>
                      <span className="fr-hl-rate" style={{ color: rateColor(entry.rate) }}>
                        {fmtRate(entry.rate)}
                      </span>
                    </div>
                  ))
                }
              </div>

              {/* Lowest */}
              <div className="fr-card" style={{ flex: 1 }}>
                <div className="fr-card-title">Lowest Funding Rates</div>
                {loading && !data
                  ? <><Skel h={16} /><Skel h={16} /><Skel h={16} /><Skel h={16} /><Skel h={16} /></>
                  : data?.lowest.map((entry, i) => (
                    <div key={i} className="fr-hl-row">
                      <span className="fr-hl-coin">{entry.coin}</span>
                      <span className="fr-hl-ex">@ {entry.exchange}</span>
                      <span className="fr-hl-rate" style={{ color: rateColor(entry.rate) }}>
                        {fmtRate(entry.rate)}
                      </span>
                    </div>
                  ))
                }
              </div>

            </div>

            {/* Heatmap */}
            <div className="fr-heatmap-panel">
              <div className="fr-ch-hdr">
                <div className="fr-ch-title">
                  Crypto Funding Rates Heatmap <span className="fr-info-icon">ⓘ</span>
                </div>
                {data && (
                  <span style={{ fontSize: 9, color: 'rgba(200,220,255,0.3)' }}>
                    {data.totalCoins} pairs · hover for details
                  </span>
                )}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 14, padding: '4px 13px', flexShrink: 0,
                borderBottom: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' }}>
                {[
                  { color: '#22c55e', label: 'Positive Rate (Longs pay)' },
                  { color: '#ef4444', label: 'Negative Rate (Shorts pay)' },
                ].map(({ color, label }) => (
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 10, color: 'rgba(180,210,255,0.5)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color,
                      display: 'inline-block' }} />
                    {label}
                  </span>
                ))}
                <span style={{ fontSize: 10, color: 'rgba(180,210,255,0.35)', marginLeft: 'auto' }}>
                  X-axis: Market Cap · Y-axis: Funding Rate
                </span>
              </div>

              <div className="fr-chart-area">
                {loading && !data?.heatmap?.length
                  ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: 'rgba(200,220,255,0.3)', fontSize: 12 }}>Loading heatmap…</div>
                  : data?.heatmap?.length
                    ? <HeatmapChart data={data.heatmap} />
                    : null
                }
              </div>
            </div>

          </div>

          {/* Table */}
          <div className="fr-table-sec">
            {loading && !data?.tableRows?.length
              ? Array.from({ length: 10 }, (_, i) => <Skel key={i} h={36} mb={4} />)
              : data?.tableRows?.length
                ? <FundingTable rows={data.tableRows} />
                : null
            }
          </div>

        </div>
      </div>
    </>
  );
};

export default FundingRatesTab;