'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Cable {
  id: string;
  name: string;
  color: string;
  owners: string[];
  rfs: string | null;
  length: string | null;
  notes: string;
  url: string;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][];
  };
}

interface LandingPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  cables: string[];
}

// ── Globe projection ──────────────────────────────────────────────────────────
function project(lat: number, lng: number, rotY: number, rotX: number, w: number, h: number) {
  const φ = lat * Math.PI / 180;
  const λ = lng * Math.PI / 180;
  const ry = rotY * Math.PI / 180;
  const rx = rotX * Math.PI / 180;

  let x = Math.cos(φ) * Math.cos(λ);
  let y = Math.cos(φ) * Math.sin(λ);
  let z = Math.sin(φ);

  const x1 = x * Math.cos(ry) - y * Math.sin(ry);
  const y1 = x * Math.sin(ry) + y * Math.cos(ry);
  const z1 = z;

  const x2 = x1;
  const y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx);

  const R = Math.min(w, h) * 0.42;
  const cx = w / 2;
  const cy = h / 2;

  return {
    sx: cx + y2 * R,
    sy: cy - z2 * R,
    depth: x2,
    visible: x2 > 0,
  };
}

function drawGraticule(ctx: CanvasRenderingContext2D, rotY: number, rotX: number, w: number, h: number) {
  ctx.strokeStyle = 'rgba(0,150,255,0.06)';
  ctx.lineWidth = 0.5;

  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.beginPath();
    let first = true;
    for (let lng = -180; lng <= 180; lng += 3) {
      const p = project(lat, lng, rotY, rotX, w, h);
      if (!p.visible) { first = true; continue; }
      if (first) { ctx.moveTo(p.sx, p.sy); first = false; }
      else ctx.lineTo(p.sx, p.sy);
    }
    ctx.stroke();
  }

  for (let lng = -180; lng < 180; lng += 30) {
    ctx.beginPath();
    let first = true;
    for (let lat = -90; lat <= 90; lat += 3) {
      const p = project(lat, lng, rotY, rotX, w, h);
      if (!p.visible) { first = true; continue; }
      if (first) { ctx.moveTo(p.sx, p.sy); first = false; }
      else ctx.lineTo(p.sx, p.sy);
    }
    ctx.stroke();
  }
}

/** Draw a cable polyline on the globe, handling visibility correctly */
function drawCableLine(
  ctx: CanvasRenderingContext2D,
  coords: number[][],
  color: string,
  rotY: number,
  rotX: number,
  w: number,
  h: number,
  alpha: number = 1
) {
  ctx.strokeStyle = color + (alpha < 1 ? Math.round(alpha * 255).toString(16).padStart(2, '0') : '');
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  let penDown = false;

  for (let i = 0; i < coords.length; i++) {
    const [lng, lat] = coords[i];
    if (isNaN(lat) || isNaN(lng)) { penDown = false; continue; }
    const p = project(lat, lng, rotY, rotX, w, h);
    if (!p.visible) { penDown = false; continue; }
    if (!penDown) { ctx.moveTo(p.sx, p.sy); penDown = true; }
    else ctx.lineTo(p.sx, p.sy);
  }
  ctx.stroke();
}

// ── Main Component ────────────────────────────────────────────────────────────
const CablesTab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cables, setCables] = useState<Cable[]>([]);
  const [landingPoints, setLandingPoints] = useState<LandingPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Cable | null>(null);
  const [hoveredLP, setHoveredLP] = useState<LandingPoint | null>(null);
  const [search, setSearch] = useState('');
  const [showLPs, setShowLPs] = useState(true);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const rotRef = useRef({ y: -30, x: 15 });
  const autoRotate = useRef(true);
  const [stats, setStats] = useState({ cables: 0, lps: 0, source: '' });

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cables');
      const data = await res.json();
      if (data.success) {
        setCables(data.cables);
        setLandingPoints(data.landingPoints || []);
        setStats({ cables: data.count, lps: data.landing_points_count, source: data.source });
      } else {
        setError(data.error || 'Failed to load cable data');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  // ── Filtered cables ────────────────────────────────────────────────────────
  const filteredCables = search
    ? cables.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.owners.some(o => o.toLowerCase().includes(search.toLowerCase())))
    : cables;

  const displayCables = selected ? [selected] : filteredCables;

  // ── Canvas rendering ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let tick = 0;

    function draw() {
      frameId = requestAnimationFrame(draw);
      tick++;

      const w = canvas!.width;
      const h = canvas!.height;
      const ry = rotRef.current.y;
      const rx = rotRef.current.x;

      if (autoRotate.current && !isDragging.current) {
        rotRef.current.y += 0.03;
      }

      ctx!.clearRect(0, 0, w, h);

      // Background
      const bg = ctx!.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.55);
      bg.addColorStop(0, '#010c1e');
      bg.addColorStop(1, '#000308');
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, w, h);

      const R = Math.min(w, h) * 0.42;
      const cx = w / 2;
      const cy = h / 2;

      // Globe sphere
      const globeGrad = ctx!.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.05, cx, cy, R);
      globeGrad.addColorStop(0, 'rgba(0,30,80,0.95)');
      globeGrad.addColorStop(0.6, 'rgba(0,15,45,0.92)');
      globeGrad.addColorStop(1, 'rgba(0,5,20,0.97)');
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.fillStyle = globeGrad;
      ctx!.fill();

      // Atmosphere
      const atm = ctx!.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.1);
      atm.addColorStop(0, 'rgba(0,80,255,0.12)');
      atm.addColorStop(1, 'rgba(0,40,200,0)');
      ctx!.beginPath();
      ctx!.arc(cx, cy, R * 1.1, 0, Math.PI * 2);
      ctx!.fillStyle = atm;
      ctx!.fill();

      // Clip to globe
      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.clip();

      // Graticule
      drawGraticule(ctx!, ry, rx, w, h);

      // Draw cables
      displayCables.forEach(cable => {
        if (!cable.geometry) return;
        const geom = cable.geometry;
        const color = cable.color || '#00aaff';
        const isSelected = selected?.id === cable.id;
        ctx!.lineWidth = isSelected ? 2.5 : 1.2;
        ctx!.globalAlpha = isSelected ? 1 : (selected ? 0.25 : 0.75);

        if (geom.type === 'LineString') {
          drawCableLine(ctx!, geom.coordinates as number[][], color, ry, rx, w, h);
        } else if (geom.type === 'MultiLineString') {
          (geom.coordinates as number[][][]).forEach(line => {
            drawCableLine(ctx!, line, color, ry, rx, w, h);
          });
        }
      });

      ctx!.globalAlpha = 1;

      // Landing points
      if (showLPs) {
        landingPoints.forEach(lp => {
          const p = project(lp.latitude, lp.longitude, ry, rx, w, h);
          if (!p.visible) return;

          const isHovered = hoveredLP?.id === lp.id;
          const r = isHovered ? 5 : 3;

          // Glow
          const glow = ctx!.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 4);
          glow.addColorStop(0, 'rgba(255,200,0,0.4)');
          glow.addColorStop(1, 'rgba(255,180,0,0)');
          ctx!.beginPath();
          ctx!.arc(p.sx, p.sy, r * 4, 0, Math.PI * 2);
          ctx!.fillStyle = glow;
          ctx!.fill();

          ctx!.beginPath();
          ctx!.arc(p.sx, p.sy, r, 0, Math.PI * 2);
          ctx!.fillStyle = isHovered ? '#ffffff' : '#ffcc00';
          ctx!.fill();

          if (isHovered) {
            ctx!.fillStyle = '#fff';
            ctx!.font = '10px monospace';
            ctx!.fillText(lp.name, p.sx + 8, p.sy - 4);
          }
        });
      }

      ctx!.restore();

      // Globe edge
      const edge = ctx!.createRadialGradient(cx, cy, R * 0.88, cx, cy, R);
      edge.addColorStop(0, 'rgba(0,0,0,0)');
      edge.addColorStop(1, 'rgba(0,0,30,0.65)');
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.fillStyle = edge;
      ctx!.fill();

      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.strokeStyle = 'rgba(0,120,255,0.35)';
      ctx!.lineWidth = 1.5;
      ctx!.stroke();

      // Data pulse animation on cables
      if (selected) {
        const pulseX = cx + Math.sin(tick * 0.02) * R * 0.3;
        const pulseY = cy + Math.cos(tick * 0.02) * R * 0.15;
        ctx!.beginPath();
        ctx!.arc(pulseX, pulseY, (tick % 40) * 0.5, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(0,255,200,${1 - (tick % 40) / 40})`;
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }
    }

    draw();
    return () => cancelAnimationFrame(frameId);
  }, [displayCables, landingPoints, selected, hoveredLP, showLPs]);

  // ── Mouse events ────────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    autoRotate.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    rotRef.current.y += dx * 0.3;
    rotRef.current.x = Math.max(-60, Math.min(60, rotRef.current.x + dy * 0.3));
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => { isDragging.current = false; };

  // Canvas click — select cable (future: nearest cable detection)
  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging.current) return;
    // Simple: deselect on click
    // Advanced cable selection would require geometry proximity check
    setSelected(null);
  };

  // Canvas resize
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: '#000810',
      fontFamily: 'monospace', color: '#00ccff', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid rgba(0,150,255,0.15)',
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: '#00ccff' }}>
          ⬡ SUBMARINE CABLE NETWORK
        </span>
        <span style={{ fontSize: 11, color: 'rgba(0,150,255,0.5)' }}>
          {loading ? 'LOADING CABLE DATA...'
            : `${stats.cables} CABLES · ${stats.lps} LANDING POINTS · ${stats.source}`}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: 'rgba(0,150,255,0.6)', cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={showLPs}
              onChange={e => setShowLPs(e.target.checked)}
              style={{ accentColor: '#00ccff' }}
            />
            LANDING POINTS
          </label>
          <button
            onClick={() => { autoRotate.current = !autoRotate.current; }}
            style={{
              background: 'rgba(0,150,255,0.1)', border: '1px solid rgba(0,150,255,0.3)',
              color: '#00ccff', padding: '3px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 3,
            }}
          >
            ⟳ AUTO-ROTATE
          </button>
          <button
            onClick={fetchData}
            style={{
              background: 'rgba(0,150,255,0.1)', border: '1px solid rgba(0,150,255,0.3)',
              color: '#00ccff', padding: '3px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 3,
            }}
          >
            ↺ REFRESH
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Globe */}
        <div
          ref={containerRef}
          style={{ flex: 1, position: 'relative', cursor: 'grab' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
            onClick={onCanvasClick}
          />

          {loading && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,8,20,0.85)', fontSize: 13, color: '#00ccff',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>⬡</div>
                LOADING TELEGEOGRAPHY DATASET...
                <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(0,150,255,0.5)' }}>
                  Fetching {stats.cables || '400+'} submarine cables
                </div>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(255,50,50,0.15)', border: '1px solid rgba(255,50,50,0.4)',
              color: '#ff6060', padding: '8px 16px', fontSize: 12, borderRadius: 4,
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16,
            display: 'flex', gap: 16, fontSize: 10, color: 'rgba(0,150,255,0.5)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 20, height: 2, background: '#00ccff', display: 'inline-block' }} />
              SUBMARINE CABLE
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffcc00', display: 'inline-block' }} />
              LANDING POINT
            </span>
          </div>

          <div style={{
            position: 'absolute', bottom: 16, right: 16,
            fontSize: 10, color: 'rgba(0,150,255,0.3)',
          }}>
            DRAG TO ROTATE · CLICK CABLE TO SELECT
          </div>
        </div>

        {/* Sidebar */}
        <div style={{
          width: 280,
          borderLeft: '1px solid rgba(0,150,255,0.15)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
        }}>
          {/* Search */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0,150,255,0.1)' }}>
            <input
              type="text"
              placeholder="Search cables or owners..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(0,150,255,0.05)',
                border: '1px solid rgba(0,150,255,0.2)',
                color: '#00ccff', padding: '6px 10px',
                fontSize: 11, fontFamily: 'monospace',
                borderRadius: 3, outline: 'none',
              }}
            />
          </div>

          {/* Selected cable detail */}
          {selected && (
            <div style={{
              padding: 12, borderBottom: '1px solid rgba(0,150,255,0.1)', fontSize: 11,
            }}>
              <div style={{
                color: selected.color || '#00ccff',
                fontWeight: 700, marginBottom: 8, fontSize: 12,
              }}>
                {selected.name}
              </div>
              {selected.rfs && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'rgba(0,150,255,0.4)' }}>IN SERVICE</span>
                  <span style={{ color: '#00ccff' }}>{selected.rfs}</span>
                </div>
              )}
              {selected.length && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'rgba(0,150,255,0.4)' }}>LENGTH</span>
                  <span style={{ color: '#00ccff' }}>{selected.length}</span>
                </div>
              )}
              {selected.owners.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: 'rgba(0,150,255,0.4)', marginBottom: 4 }}>OWNERS</div>
                  <div style={{ color: '#00ccff', fontSize: 10, lineHeight: 1.5 }}>
                    {selected.owners.slice(0, 5).join(', ')}
                    {selected.owners.length > 5 && ` +${selected.owners.length - 5} more`}
                  </div>
                </div>
              )}
              {selected.notes && (
                <div style={{ marginTop: 8, color: 'rgba(0,150,255,0.6)', fontSize: 10, lineHeight: 1.4 }}>
                  {selected.notes.substring(0, 200)}{selected.notes.length > 200 ? '...' : ''}
                </div>
              )}
              <button
                onClick={() => setSelected(null)}
                style={{
                  marginTop: 10, width: '100%',
                  background: 'transparent', border: '1px solid rgba(0,150,255,0.2)',
                  color: 'rgba(0,150,255,0.4)', padding: '3px 0', fontSize: 10,
                  cursor: 'pointer', borderRadius: 2, fontFamily: 'monospace',
                }}
              >
                SHOW ALL CABLES
              </button>
            </div>
          )}

          {/* Stats bar */}
          {!selected && !loading && (
            <div style={{
              padding: '8px 12px', borderBottom: '1px solid rgba(0,150,255,0.1)',
              display: 'flex', gap: 16, fontSize: 11,
            }}>
              <div>
                <div style={{ color: 'rgba(0,150,255,0.4)', fontSize: 10 }}>TOTAL CABLES</div>
                <div style={{ color: '#00ccff', fontWeight: 700 }}>{cables.length}</div>
              </div>
              <div>
                <div style={{ color: 'rgba(0,150,255,0.4)', fontSize: 10 }}>LANDING PTS</div>
                <div style={{ color: '#ffcc00', fontWeight: 700 }}>{landingPoints.length}</div>
              </div>
              <div>
                <div style={{ color: 'rgba(0,150,255,0.4)', fontSize: 10 }}>SHOWING</div>
                <div style={{ color: '#00ff88', fontWeight: 700 }}>{filteredCables.length}</div>
              </div>
            </div>
          )}

          {/* Cable list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {filteredCables.map((cable, index) => (
              <div
                key={index}
                onClick={() => setSelected(cable === selected ? null : cable)}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  background: selected?.id === cable.id ? 'rgba(0,150,255,0.1)' : 'transparent',
                  borderLeft: `3px solid ${cable.color || '#00aaff'}`,
                  marginBottom: 1,
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 11, color: selected?.id === cable.id ? '#00ccff' : 'rgba(0,180,255,0.8)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {cable.name}
                  </div>
                  {cable.rfs && (
                    <div style={{ fontSize: 10, color: 'rgba(0,150,255,0.35)', marginTop: 1 }}>
                      {cable.rfs} · {cable.owners.slice(0, 2).join(', ')}
                      {cable.owners.length > 2 ? '...' : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CablesTab;