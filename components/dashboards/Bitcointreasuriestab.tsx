'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CountryEntry { country: string; btc: number; pct: number }
interface DonutEntry   { name: string; symbol: string; btc: number; pct: number }
interface TableRow {
  rank: number; name: string; ticker: string; country: string;
  btcHoldings: number; percentSupply: number;
  currentValue: number; entryValue: number;
}

interface ApiData {
  success: boolean;
  btcPrice: number;
  totalHeld: number;
  totalSupply: number;
  supplyPct: number;
  totalValueUsd: number;
  marketCapDominance: number;
  countries: CountryEntry[];
  donut: DonutEntry[];
  table: TableRow[];
  updatedAt: number;
  source: string;
  error?: string;
}

// ── Palette ───────────────────────────────────────────────────────────────────
const DONUT_COLORS = [
  '#f7931a', // Strategy – Bitcoin orange
  '#3b82f6', // MARA
  '#10b981', // Twenty One / XXI
  '#8b5cf6', // Metaplanet
  '#f59e0b', // Bitcoin Standard
  '#ef4444', // Riot
  '#06b6d4', // Coinbase
  '#84cc16', // Hut 8
  '#f97316', // Other named
  '#6b7280', // Others grey
];

const COUNTRY_COLORS: Record<string, string> = {
  US: '#f7931a', JP: '#3b82f6', CN: '#10b981',
  CA: '#8b5cf6', KR: '#ef4444', Others: '#6b7280',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtBTC  = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + 'M' : n.toLocaleString();
const fmtUSD  = (n: number) => {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3)  return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
};
const fmtPct  = (n: number) => n.toFixed(2) + '%';

// ── DonutChart ────────────────────────────────────────────────────────────────
const DonutChart: React.FC<{ data: DonutEntry[]; total: number }> = ({ data, total }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; const container = containerRef.current;
    if (!canvas || !container || data.length === 0) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W = container.clientWidth; const H = container.clientHeight;
    canvas.width = W; canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    const cx = W * 0.45; const cy = H / 2;
    const outerR = Math.min(cx, cy) * 0.82;
    const innerR = outerR * 0.6;
    const gap = 0.012; // radians between slices

    let angle = -Math.PI / 2;
    data.forEach((entry, i) => {
      const sweep = (entry.pct / 100) * (Math.PI * 2) - gap;
      const color = DONUT_COLORS[i] ?? '#444';
      const isHov = hovered === i;
      const rOuter = isHov ? outerR * 1.05 : outerR;
      const rInner = innerR;

      ctx.beginPath();
      ctx.arc(cx, cy, rOuter, angle, angle + sweep);
      ctx.arc(cx, cy, rInner, angle + sweep, angle, true);
      ctx.closePath();
      ctx.fillStyle = isHov ? color : color + 'dd';
      ctx.fill();

      if (isHov) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Label line + text for large slices
      if (entry.pct > 1.5) {
        const midAngle = angle + sweep / 2;
        const labelR = outerR * 1.18;
        const lx = cx + Math.cos(midAngle) * labelR;
        const ly = cy + Math.sin(midAngle) * labelR;

        ctx.fillStyle = isHov ? '#fff' : 'rgba(200,220,255,0.75)';
        ctx.font = `${isHov ? 'bold ' : ''}10px "IBM Plex Mono",monospace`;
        ctx.textAlign = lx > cx ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${entry.name.length > 18 ? entry.name.slice(0, 16) + '…' : entry.name} ${fmtPct(entry.pct)}`, lx, ly);
      }

      angle += sweep + gap;
    });

    // Centre text
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (hovered !== null && data[hovered]) {
      const h = data[hovered];
      ctx.fillStyle = DONUT_COLORS[hovered] ?? '#fff';
      ctx.font = 'bold 11px "IBM Plex Mono",monospace';
      ctx.fillText(h.name.length > 16 ? h.name.slice(0, 14) + '…' : h.name, cx, cy - 18);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px "IBM Plex Mono",monospace';
      ctx.fillText(fmtBTC(h.btc), cx, cy);
      ctx.fillStyle = 'rgba(180,210,255,0.6)';
      ctx.font = '10px "IBM Plex Mono",monospace';
      ctx.fillText(fmtPct(h.pct), cx, cy + 18);
    } else {
      ctx.fillStyle = 'rgba(180,210,255,0.5)';
      ctx.font = '11px "IBM Plex Mono",monospace';
      ctx.fillText('Total BTC Held', cx, cy - 18);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px "IBM Plex Mono",monospace';
      ctx.fillText(fmtBTC(total), cx, cy + 2);
    }
  }, [data, total, hovered]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas || data.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    const W = canvas.clientWidth; const H = canvas.clientHeight;
    const cx = W * 0.45; const cy = H / 2;
    const outerR = Math.min(cx, cy) * 0.82;
    const innerR = outerR * 0.6;
    const dx = mx - cx; const dy = my - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < innerR || dist > outerR * 1.1) { setHovered(null); return; }
    let angle = Math.atan2(dy, dx);
    if (angle < -Math.PI / 2) angle += Math.PI * 2;
    let start = -Math.PI / 2;
    const gap = 0.012;
    for (let i = 0; i < data.length; i++) {
      const sweep = (data[i].pct / 100) * Math.PI * 2 - gap;
      if (angle >= start && angle <= start + sweep) { setHovered(i); return; }
      start += sweep + gap;
    }
    setHovered(null);
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setHovered(null)} />
    </div>
  );
};

// ── CountriesBar ──────────────────────────────────────────────────────────────
const CountriesBar: React.FC<{ countries: CountryEntry[] }> = ({ countries }) => {
  const maxPct = Math.max(...countries.map(c => c.pct), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {countries.map((c) => {
        const color = COUNTRY_COLORS[c.country] ?? '#6b7280';
        return (
          <div key={c.country} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, fontSize: 11, color: 'rgba(180,210,255,0.7)', textAlign: 'right', flexShrink: 0 }}>
              {c.country}
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 10, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${(c.pct / maxPct) * 100}%`,
                background: color,
                transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
              }} />
            </div>
            <div style={{ width: 42, fontSize: 11, color, fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>
              {fmtPct(c.pct)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── SortIcon ──────────────────────────────────────────────────────────────────
const SortIcon: React.FC<{ dir: 'asc' | 'desc' | null }> = ({ dir }) => (
  <span style={{ fontSize: 9, color: dir ? '#f7931a' : 'rgba(0,150,255,0.3)', marginLeft: 3 }}>
    {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '⇅'}
  </span>
);

type SortKey = 'rank' | 'name' | 'ticker' | 'country' | 'btcHoldings' | 'percentSupply' | 'currentValue' | 'entryValue';

// ── Main Component ────────────────────────────────────────────────────────────
const BitcoinTreasuriesTab: React.FC = () => {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res = await fetch('/api/bitcoin-treasury');
      const json: ApiData = await res.json();
      if (!json.success) throw new Error(json.error ?? 'API error');
      setData(json);
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

  // Sort & filter table
  const sortedRows = React.useMemo(() => {
    if (!data?.table) return [];
    let rows = [...data.table];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q) || r.ticker.toLowerCase().includes(q) || r.country.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return rows;
  }, [data, sortKey, sortDir, search]);

  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE);
  const pageRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  };

  const TH: React.FC<{ label: string; sk: SortKey; style?: React.CSSProperties }> = ({ label, sk, style }) => (
    <th onClick={() => handleSort(sk)} style={{
      padding: '8px 10px', textAlign: 'left', fontSize: 11,
      color: sortKey === sk ? '#f7931a' : 'rgba(180,210,255,0.5)',
      fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
      borderBottom: '1px solid rgba(0,150,255,0.1)',
      userSelect: 'none', letterSpacing: '0.04em', ...style,
    }}>
      {label}<SortIcon dir={sortKey === sk ? sortDir : null} />
    </th>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#080e1e', fontFamily: '"IBM Plex Mono","Courier New",monospace',
      color: '#c0d8f0', overflow: 'hidden', boxSizing: 'border-box',
    }}>
      {/* ── Top nav tabs ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(0,150,255,0.15)', flexShrink: 0, padding: '0 16px' }}>
        {['Bitcoin', 'BNB'].map((tab, i) => (
          <div key={tab} style={{
            padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            color: i === 0 ? '#f7931a' : 'rgba(180,210,255,0.4)',
            borderBottom: i === 0 ? '2px solid #f7931a' : '2px solid transparent',
            marginBottom: -1,
          }}>{tab}</div>
        ))}
      </div>

      {/* ── Header ── */}
      <div style={{ padding: '12px 16px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e8f4ff', display: 'flex', alignItems: 'center', gap: 8 }}>
              Public Companies Bitcoin Treasuries
              <span style={{ fontSize: 12, color: 'rgba(0,150,255,0.4)', border: '1px solid rgba(0,150,255,0.2)', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ⓘ</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(0,150,255,0.45)', marginTop: 3, lineHeight: 1.4, maxWidth: 720 }}>
              Explore comprehensive data on corporate Bitcoin treasury holdings. Track which public companies hold Bitcoin,
              their BTC reserves, current market value, and acquisition history. Monitor institutional adoption and corporate Bitcoin strategies.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
            {data && (
              <div style={{ fontSize: 10, color: 'rgba(0,150,255,0.4)', textAlign: 'right', lineHeight: 1.6 }}>
                <div>CoinGecko API · BTC ${data.btcPrice.toLocaleString()}</div>
                <div>Updated: {lastUpdated}</div>
              </div>
            )}
            <button onClick={fetchData} disabled={loading} style={{
              background: 'rgba(247,147,26,0.1)', border: '1px solid rgba(247,147,26,0.3)',
              color: '#f7931a', padding: '4px 12px', fontSize: 11, cursor: loading ? 'default' : 'pointer',
              borderRadius: 3, fontFamily: 'monospace', opacity: loading ? 0.5 : 1,
            }}>
              {loading ? '↻ Loading...' : '↺ Refresh'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ margin: '0 16px 8px', background: 'rgba(255,50,50,0.1)', border: '1px solid rgba(255,50,50,0.3)', color: '#ff7070', padding: '8px 12px', borderRadius: 4, fontSize: 12, flexShrink: 0 }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Top panels row ── */}
      <div style={{ display: 'flex', gap: 10, padding: '0 16px', flexShrink: 0, height: 220 }}>
        {/* Left: Supply + Countries */}
        <div style={{
          width: 300, flexShrink: 0,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,150,255,0.1)',
          borderRadius: 6, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {/* Supply */}
          <div>
            <div style={{ fontSize: 11, color: 'rgba(180,210,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Total Bitcoin Supply Held
            </div>
            {loading && !data ? (
              <div style={{ fontSize: 12, color: 'rgba(0,150,255,0.4)' }}>Loading...</div>
            ) : data ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                  {fmtBTC(data.totalHeld)} / {fmtBTC(data.totalSupply)}
                </div>
                {/* Supply bar */}
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 6 }}>
                  <div style={{
                    height: '100%', borderRadius: 2, background: '#f7931a',
                    width: `${Math.min(100, data.supplyPct)}%`,
                    transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: '#f7931a', marginTop: 3 }}>
                  {fmtPct(data.supplyPct)} of supply
                </div>
              </>
            ) : null}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(0,150,255,0.08)' }} />

          {/* Countries */}
          <div>
            <div style={{ fontSize: 11, color: 'rgba(180,210,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Countries Breakdown
            </div>
            {loading && !data ? (
              <div style={{ fontSize: 12, color: 'rgba(0,150,255,0.4)' }}>Loading...</div>
            ) : data ? (
              <CountriesBar countries={data.countries} />
            ) : null}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 10, color: 'rgba(0,150,255,0.2)' }}>⊕ CoinMarketCap</span>
          </div>
        </div>

        {/* Right: BTC Holdings donut */}
        <div style={{
          flex: 1,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,150,255,0.1)',
          borderRadius: 6, padding: '10px 14px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e0f0ff' }}>Bitcoin Holdings by Company</span>
            <span style={{ fontSize: 10, color: 'rgba(0,150,255,0.3)' }}>⊕ CoinMarketCap</span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {loading && !data ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 12, color: 'rgba(0,150,255,0.4)' }}>Loading...</div>
            ) : data ? (
              <DonutChart data={data.donut} total={data.totalHeld} />
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Table section ── */}
      <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e8f4ff' }}>
            Bitcoin Treasuries Data by Public Companies
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {data && (
              <span style={{ fontSize: 11, color: 'rgba(0,150,255,0.4)' }}>
                {sortedRows.length} companies
              </span>
            )}
            <input
              type="text"
              placeholder="Search company..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{
                background: 'rgba(0,150,255,0.05)', border: '1px solid rgba(0,150,255,0.2)',
                color: '#00ccff', padding: '4px 10px', fontSize: 11, fontFamily: 'monospace',
                borderRadius: 3, outline: 'none', width: 180,
              }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px 12px', minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#080e1e', zIndex: 2 }}>
            <tr>
              <TH label="#" sk="rank" style={{ width: 36 }} />
              <TH label="Company name" sk="name" />
              <TH label="Ticker" sk="ticker" />
              <TH label="Country" sk="country" />
              <TH label="BTC Holdings" sk="btcHoldings" />
              <TH label="% of Supply" sk="percentSupply" />
              <TH label="Current value" sk="currentValue" />
              <TH label="Cost basis" sk="entryValue" />
            </tr>
          </thead>
          <tbody>
            {loading && !data?.table?.length ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'rgba(0,150,255,0.4)', fontSize: 13 }}>
                  Loading treasury data...
                </td>
              </tr>
            ) : pageRows.map((row, i) => {
              const isEven = i % 2 === 0;
              return (
                <tr key={row.rank} style={{
                  background: isEven ? 'rgba(255,255,255,0.015)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(247,147,26,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = isEven ? 'rgba(255,255,255,0.015)' : 'transparent')}
                >
                  <td style={{ padding: '9px 10px', color: 'rgba(180,210,255,0.4)', fontSize: 11 }}>{row.rank}</td>
                  <td style={{ padding: '9px 10px', fontWeight: 700, color: '#e8f4ff' }}>{row.name}</td>
                  <td style={{ padding: '9px 10px' }}>
                    <span style={{
                      background: 'rgba(247,147,26,0.12)', color: '#f7931a',
                      padding: '1px 6px', borderRadius: 3, fontSize: 11, fontWeight: 700,
                    }}>{row.ticker || '—'}</span>
                  </td>
                  <td style={{ padding: '9px 10px', color: 'rgba(180,210,255,0.7)' }}>{row.country || '—'}</td>
                  <td style={{ padding: '9px 10px', fontWeight: 700, color: '#e8f4ff' }}>
                    {row.btcHoldings.toLocaleString()}
                  </td>
                  <td style={{ padding: '9px 10px', color: 'rgba(180,210,255,0.7)' }}>
                    {fmtPct(row.percentSupply)}
                  </td>
                  <td style={{ padding: '9px 10px', color: '#10b981', fontWeight: 600 }}>
                    {fmtUSD(row.currentValue)}
                  </td>
                  <td style={{ padding: '9px 10px', color: row.entryValue > 0 ? 'rgba(180,210,255,0.7)' : 'rgba(0,150,255,0.3)' }}>
                    {row.entryValue > 0 ? fmtUSD(row.entryValue) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{
              background: 'rgba(0,150,255,0.08)', border: '1px solid rgba(0,150,255,0.2)',
              color: page === 1 ? 'rgba(0,150,255,0.3)' : '#60b0ff',
              padding: '3px 10px', fontSize: 11, cursor: page === 1 ? 'default' : 'pointer',
              borderRadius: 3, fontFamily: 'monospace',
            }}>‹ Prev</button>
            <span style={{ fontSize: 11, color: 'rgba(0,150,255,0.5)' }}>
              Page {page} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{
              background: 'rgba(0,150,255,0.08)', border: '1px solid rgba(0,150,255,0.2)',
              color: page === totalPages ? 'rgba(0,150,255,0.3)' : '#60b0ff',
              padding: '3px 10px', fontSize: 11, cursor: page === totalPages ? 'default' : 'pointer',
              borderRadius: 3, fontFamily: 'monospace',
            }}>Next ›</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BitcoinTreasuriesTab;