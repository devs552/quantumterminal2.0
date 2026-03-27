'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Satellite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  alt: number;
  velocity: number;
  type: string;
  inclination: number;
  period: number;
  epoch: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  'Space Station': '#ff6b35',
  'Starlink':      '#00d4ff',
  'GPS':           '#ffd700',
  'GEO':           '#ff00ff',
  'Visual':        '#00ff88',
  'Weather':       '#87ceeb',
  'Galileo':       '#ff9500',
};

const TYPE_SIZES: Record<string, number> = {
  'Space Station': 7,
  'Starlink':      2.5,
  'GPS':           4,
  'GEO':           4,
  'Visual':        3,
  'Weather':       3.5,
  'Galileo':       3.5,
};

// ── Globe Projection ──────────────────────────────────────────────────────────
function project(lat: number, lng: number, rotY: number, rotX: number, width: number, height: number) {
  const φ = lat * Math.PI / 180;
  const λ = lng * Math.PI / 180;
  const rotYr = rotY * Math.PI / 180;
  const rotXr = rotX * Math.PI / 180;

  // 3D point on unit sphere
  let x = Math.cos(φ) * Math.cos(λ);
  let y = Math.cos(φ) * Math.sin(λ);
  let z = Math.sin(φ);

  // Rotate around Y axis
  const x1 = x * Math.cos(rotYr) - y * Math.sin(rotYr);
  const y1 = x * Math.sin(rotYr) + y * Math.cos(rotYr);
  const z1 = z;

  // Rotate around X axis
  const x2 = x1;
  const y2 = y1 * Math.cos(rotXr) - z1 * Math.sin(rotXr);
  const z2 = y1 * Math.sin(rotXr) + z1 * Math.cos(rotXr);

  // Only show front hemisphere
  const visible = x2 > -0.1;

  const R = Math.min(width, height) * 0.42;
  const cx = width / 2;
  const cy = height / 2;

  return {
    sx: cx + y2 * R,
    sy: cy - z2 * R,
    depth: x2,
    visible,
  };
}

// ── Graticule lines ──────────────────────────────────────────────────────────
function drawGraticule(ctx: CanvasRenderingContext2D, rotY: number, rotX: number, w: number, h: number) {
  ctx.strokeStyle = 'rgba(0,255,136,0.08)';
  ctx.lineWidth = 0.5;

  // Lat lines every 30°
  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.beginPath();
    let first = true;
    for (let lng = -180; lng <= 180; lng += 2) {
      const p = project(lat, lng, rotY, rotX, w, h);
      if (!p.visible) { first = true; continue; }
      if (first) { ctx.moveTo(p.sx, p.sy); first = false; }
      else ctx.lineTo(p.sx, p.sy);
    }
    ctx.stroke();
  }

  // Lng lines every 30°
  for (let lng = -180; lng < 180; lng += 30) {
    ctx.beginPath();
    let first = true;
    for (let lat = -90; lat <= 90; lat += 2) {
      const p = project(lat, lng, rotY, rotX, w, h);
      if (!p.visible) { first = true; continue; }
      if (first) { ctx.moveTo(p.sx, p.sy); first = false; }
      else ctx.lineTo(p.sx, p.sy);
    }
    ctx.stroke();
  }
}

// ── Continent outlines (simplified GeoJSON-style paths) ──────────────────────
// We'll draw continents using a simplified dataset
const CONTINENT_PATHS = [
  // North America (simplified)
  [[-60,48],[-65,44],[-70,43],[-74,41],[-76,35],[-80,25],[-85,22],[-90,20],[-95,19],[-100,23],[-108,28],[-114,32],[-117,33],[-120,34],[-124,38],[-130,55],[-135,60],[-140,61],[-145,62],[-150,61],[-155,60],[-160,55],[-165,61],[-170,64],[-165,68],[-155,72],[-140,70],[-130,68],[-120,60],[-110,55],[-100,50],[-90,48],[-85,46],[-80,45],[-75,44],[-70,46],[-65,44],[-60,46],[-55,47],[-53,47]],
  // South America
  [[-34,-53],[-38,-55],[-42,-64],[-65,-55],[-70,-52],[-72,-45],[-72,-40],[-70,-35],[-68,-28],[-70,-20],[-75,-10],[-78,-5],[-77,0],[-78,5],[-75,10],[-72,12],[-68,12],[-63,10],[-60,6],[-52,4],[-50,-1],[-48,-5],[-38,-12],[-38,-18],[-40,-22],[-44,-23],[-48,-28],[-50,-32],[-53,-34],[-53,-36],[-52,-38]],
  // Europe
  [[28,72],[25,70],[20,69],[15,70],[12,65],[10,58],[5,57],[0,51],[-4,48],[-8,43],[-9,38],[-7,37],[-5,36],[0,38],[3,42],[5,43],[7,44],[12,44],[15,38],[16,40],[18,40],[20,38],[23,38],[26,40],[28,42],[30,45],[33,48],[31,52],[27,55],[22,58],[18,60],[15,65],[14,68],[18,70],[24,71]]
];

// ── Main Component ────────────────────────────────────────────────────────────
const SatelliteTab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Satellite | null>(null);
  const [filter, setFilter] = useState<string>('All');
  const [rotY, setRotY] = useState(-30);
  const [rotX, setRotX] = useState(20);
  const [stats, setStats] = useState({ total: 0, source: '' });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
//   const animFrame = useRef<number>();
  const rotRef = useRef({ y: rotY, x: rotX });
  const autoRotate = useRef(true);

  // ── Fetch satellites ───────────────────────────────────────────────────────
  const fetchSatellites = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/satellites');
      const data = await res.json();
      if (data.success && data.satellites.length > 0) {
        setSatellites(data.satellites);
        setStats({ total: data.count, source: data.source });
      } else {
        setError(data.error || 'No satellite data received');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSatellites(); }, []);

  // ── Filtered satellites ────────────────────────────────────────────────────
  const filtered = filter === 'All' ? satellites : satellites.filter(s => s.type === filter);
  const types = ['All', ...Array.from(new Set(satellites.map(s => s.type))).sort()];

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

      // Auto-rotate slowly
      if (autoRotate.current && !isDragging.current) {
        rotRef.current.y += 0.04;
      }

      // Clear
      ctx!.clearRect(0, 0, w, h);

      // Background gradient
      const bg = ctx!.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.5);
      bg.addColorStop(0, 'rgba(0,8,20,1)');
      bg.addColorStop(1, 'rgba(0,0,8,1)');
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, w, h);

      const R = Math.min(w, h) * 0.42;
      const cx = w / 2;
      const cy = h / 2;

      // Globe sphere
      const globeGrad = ctx!.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
      globeGrad.addColorStop(0, 'rgba(0,40,80,0.9)');
      globeGrad.addColorStop(0.5, 'rgba(0,20,50,0.85)');
      globeGrad.addColorStop(1, 'rgba(0,5,20,0.95)');
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.fillStyle = globeGrad;
      ctx!.fill();

      // Atmosphere glow
      const atmGrad = ctx!.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.08);
      atmGrad.addColorStop(0, 'rgba(0,100,255,0.15)');
      atmGrad.addColorStop(1, 'rgba(0,50,255,0)');
      ctx!.beginPath();
      ctx!.arc(cx, cy, R * 1.08, 0, Math.PI * 2);
      ctx!.fillStyle = atmGrad;
      ctx!.fill();

      // Globe clip
      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.clip();

      // Graticule
      drawGraticule(ctx!, ry, rx, w, h);

      // Stars in globe background
      ctx!.restore();

      // Draw orbit rings by type (altitude bands)
      const orbits = [
        { label: 'LEO', minAlt: 200, maxAlt: 2000, color: 'rgba(0,255,136,0.05)' },
        { label: 'MEO', minAlt: 2000, maxAlt: 20000, color: 'rgba(255,215,0,0.04)' },
        { label: 'GEO', minAlt: 35000, maxAlt: 37000, color: 'rgba(255,0,255,0.06)' },
      ];

      // Draw satellites
      const visibleSats = filtered.filter(s => {
        const p = project(s.lat, s.lng, ry, rx, w, h);
        return p.visible;
      });

      visibleSats.forEach(sat => {
        const p = project(sat.lat, sat.lng, ry, rx, w, h);
        const color = TYPE_COLORS[sat.type] || '#ffffff';
        const size = (TYPE_SIZES[sat.type] || 3) * (0.5 + p.depth * 0.5);

        // Altitude scale on globe surface (visual only)
        const altScale = 1 + Math.min(sat.alt / 40000, 0.5);

        // Glow
        const glow = ctx!.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, size * 3);
        glow.addColorStop(0, color + 'cc');
        glow.addColorStop(1, color + '00');
        ctx!.beginPath();
        ctx!.arc(p.sx, p.sy, size * 3, 0, Math.PI * 2);
        ctx!.fillStyle = glow;
        ctx!.fill();

        // Core dot
        ctx!.beginPath();
        ctx!.arc(p.sx, p.sy, size, 0, Math.PI * 2);
        ctx!.fillStyle = color;
        ctx!.fill();

        // Pulse for space stations
        if (sat.type === 'Space Station') {
          const pulse = (Math.sin(tick * 0.05) + 1) * 0.5;
          ctx!.beginPath();
          ctx!.arc(p.sx, p.sy, size + pulse * 8, 0, Math.PI * 2);
          ctx!.strokeStyle = color + '44';
          ctx!.lineWidth = 1;
          ctx!.stroke();
        }

        // Selected highlight
        if (selected?.id === sat.id) {
          ctx!.beginPath();
          ctx!.arc(p.sx, p.sy, size + 6, 0, Math.PI * 2);
          ctx!.strokeStyle = '#ffffff';
          ctx!.lineWidth = 1.5;
          ctx!.stroke();
          // Name label
          ctx!.fillStyle = '#ffffff';
          ctx!.font = 'bold 11px monospace';
          ctx!.fillText(sat.name, p.sx + 10, p.sy - 6);
        }
      });

      // Globe edge shadow
      ctx!.save();
      const edgeShadow = ctx!.createRadialGradient(cx, cy, R * 0.85, cx, cy, R);
      edgeShadow.addColorStop(0, 'rgba(0,0,0,0)');
      edgeShadow.addColorStop(1, 'rgba(0,0,20,0.6)');
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.fillStyle = edgeShadow;
      ctx!.fill();
      ctx!.restore();

      // Globe outline
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.strokeStyle = 'rgba(0,180,255,0.3)';
      ctx!.lineWidth = 1;
      ctx!.stroke();
    }

    draw();
    return () => cancelAnimationFrame(frameId);
  }, [filtered, selected]);

  // ── Mouse drag ─────────────────────────────────────────────────────────────
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
    rotRef.current.x += dy * 0.3;
    rotRef.current.x = Math.max(-60, Math.min(60, rotRef.current.x));
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => { isDragging.current = false; };

  // ── Click to select ────────────────────────────────────────────────────────
  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const w = canvas.width;
    const h = canvas.height;
    const ry = rotRef.current.y;
    const rx = rotRef.current.x;

    let closest: Satellite | null = null;
    let minDist = 20;

    filtered.forEach(sat => {
      const p = project(sat.lat, sat.lng, ry, rx, w, h);
      if (!p.visible) return;
      const dist = Math.hypot(p.sx - mx, p.sy - my);
      if (dist < minDist) { minDist = dist; closest = sat; }
    });

    setSelected(closest);
  };

  // ── Canvas resize ──────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
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

  // ── Refresh every 2 min ────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(fetchSatellites, 120_000);
    return () => clearInterval(iv);
  }, [fetchSatellites]);

  const countByType = types.slice(1).map(t => ({
    type: t,
    count: satellites.filter(s => s.type === t).length,
    color: TYPE_COLORS[t] || '#fff',
  }));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#000810',
      fontFamily: 'monospace',
      color: '#00ff88',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid rgba(0,255,136,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: '#00ff88' }}>
          ◈ SATELLITE TRACKING
        </span>
        <span style={{ fontSize: 11, color: 'rgba(0,255,136,0.5)' }}>
          {loading ? 'FETCHING TLE DATA...' : `${filtered.length} OBJECTS TRACKED · ${stats.source}`}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => { autoRotate.current = !autoRotate.current; }}
            style={{
              background: 'rgba(0,255,136,0.1)',
              border: '1px solid rgba(0,255,136,0.3)',
              color: '#00ff88',
              padding: '3px 10px',
              fontSize: 11,
              cursor: 'pointer',
              borderRadius: 3,
            }}
          >
            ⟳ AUTO-ROTATE
          </button>
          <button
            onClick={fetchSatellites}
            style={{
              background: 'rgba(0,255,136,0.1)',
              border: '1px solid rgba(0,255,136,0.3)',
              color: '#00ff88',
              padding: '3px 10px',
              fontSize: 11,
              cursor: 'pointer',
              borderRadius: 3,
            }}
          >
            ↺ REFRESH TLE
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
              background: 'rgba(0,8,20,0.85)',
              fontSize: 13, color: '#00ff88',
            }}>
              <div>
                <div style={{ textAlign: 'center', marginBottom: 12, fontSize: 24 }}>◈</div>
                COMPUTING ORBITAL POSITIONS...
                <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(0,255,136,0.5)' }}>
                  Fetching TLE data from CelesTrak
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

          {/* Orbit legend */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16,
            display: 'flex', gap: 12, fontSize: 10,
          }}>
            {[
              { label: 'LEO <2000km', color: '#00ff88' },
              { label: 'MEO 2-35k km', color: '#ffd700' },
              { label: 'GEO ~35786km', color: '#ff00ff' },
            ].map(o => (
              <span key={o.label} style={{ color: o.color, opacity: 0.6 }}>
                ● {o.label}
              </span>
            ))}
          </div>

          {/* Drag hint */}
          <div style={{
            position: 'absolute', bottom: 16, right: 16,
            fontSize: 10, color: 'rgba(0,255,136,0.3)',
          }}>
            DRAG TO ROTATE · CLICK SATELLITE TO SELECT
          </div>
        </div>

        {/* Sidebar */}
        <div style={{
          width: 260,
          borderLeft: '1px solid rgba(0,255,136,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {/* Filter tabs */}
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid rgba(0,255,136,0.1)',
            fontSize: 11,
          }}>
            <div style={{ color: 'rgba(0,255,136,0.5)', marginBottom: 8 }}>FILTER BY TYPE</div>
            {types.map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', textAlign: 'left',
                  background: filter === t ? 'rgba(0,255,136,0.1)' : 'transparent',
                  border: 'none',
                  borderLeft: filter === t ? '2px solid #00ff88' : '2px solid transparent',
                  color: filter === t ? '#00ff88' : 'rgba(0,255,136,0.5)',
                  padding: '4px 8px',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  marginBottom: 2,
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: t === 'All' ? '#00ff88' : (TYPE_COLORS[t] || '#fff'),
                  display: 'inline-block', flexShrink: 0,
                }} />
                <span style={{ flex: 1 }}>{t}</span>
                <span style={{ opacity: 0.6 }}>
                  {t === 'All' ? satellites.length : satellites.filter(s => s.type === t).length}
                </span>
              </button>
            ))}
          </div>

          {/* Selected satellite info */}
          {selected && (
            <div style={{
              padding: '12px',
              borderBottom: '1px solid rgba(0,255,136,0.1)',
              fontSize: 11,
            }}>
              <div style={{ color: '#00ff88', fontWeight: 700, marginBottom: 8, fontSize: 12 }}>
                {selected.name}
              </div>
              {[
                ['TYPE', selected.type],
                ['NORAD ID', selected.id],
                ['LATITUDE', `${selected.lat.toFixed(2)}°`],
                ['LONGITUDE', `${selected.lng.toFixed(2)}°`],
                ['ALTITUDE', `${Math.round(selected.alt).toLocaleString()} km`],
                ['VELOCITY', `${selected.velocity.toFixed(2)} km/s`],
                ['PERIOD', `${selected.period} min`],
                ['INCLINATION', `${selected.inclination.toFixed(1)}°`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'rgba(0,255,136,0.4)' }}>{k}</span>
                  <span style={{ color: '#00ff88' }}>{v}</span>
                </div>
              ))}
              <button
                onClick={() => setSelected(null)}
                style={{
                  marginTop: 8, width: '100%',
                  background: 'transparent', border: '1px solid rgba(0,255,136,0.2)',
                  color: 'rgba(0,255,136,0.4)', padding: '3px 0',
                  fontSize: 10, cursor: 'pointer', borderRadius: 2, fontFamily: 'monospace',
                }}
              >
                CLEAR SELECTION
              </button>
            </div>
          )}

          {/* Satellite list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {filtered.slice(0, 150).map(sat => (
              <div
                key={sat.id}
                onClick={() => { setSelected(sat === selected ? null : sat); }}
                style={{
                  padding: '5px 12px',
                  cursor: 'pointer',
                  background: selected?.id === sat.id ? 'rgba(0,255,136,0.08)' : 'transparent',
                  borderLeft: selected?.id === sat.id ? '2px solid #00ff88' : '2px solid transparent',
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 11,
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: TYPE_COLORS[sat.type] || '#fff',
                  flexShrink: 0,
                }} />
                <span style={{
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: 'rgba(0,255,136,0.8)',
                }}>
                  {sat.name}
                </span>
                <span style={{ color: 'rgba(0,255,136,0.35)', fontSize: 10, flexShrink: 0 }}>
                  {Math.round(sat.alt)}km
                </span>
              </div>
            ))}
            {filtered.length > 150 && (
              <div style={{ padding: '8px 12px', fontSize: 10, color: 'rgba(0,255,136,0.3)' }}>
                +{filtered.length - 150} more objects not shown
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SatelliteTab;