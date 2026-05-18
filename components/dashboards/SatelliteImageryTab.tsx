'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface ResourceSite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'oil' | 'gas' | 'gold' | 'mineral';
  subtype: string;
  description: string;
  reserves?: string;
  country: string;
  production?: string;
  bbox: [number, number, number, number];
  gibsLayer: string;
  gibsDate: string;
}

interface GibsLayer {
  id: string;
  label: string;
  description: string;
  tileUrl: string;
  attribution: string;
  maxZoom: number;
  format: 'jpg' | 'png';
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  oil:     { color: '#ff8c42', glow: 'rgba(255,140,66,0.4)',  icon: '🛢',  label: 'Oil'      },
  gas:     { color: '#ffd700', glow: 'rgba(255,215,0,0.4)',   icon: '🔥',  label: 'Natural Gas' },
  gold:    { color: '#ffc107', glow: 'rgba(255,193,7,0.4)',   icon: '⬡',   label: 'Gold'     },
  mineral: { color: '#a78bfa', glow: 'rgba(167,139,250,0.4)', icon: '⛏',  label: 'Minerals' },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — all inline so no Tailwind dependency
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  root: {
    display: 'flex', flexDirection: 'column' as const,
    height: '100%', minHeight: 600,
    background: '#000c1a', fontFamily: 'monospace',
    color: '#00ff88', overflow: 'hidden',
  },
  header: {
    padding: '8px 16px',
    borderBottom: '1px solid rgba(0,255,136,0.15)',
    display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
  },
  headerTitle: { fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: '#00ff88' },
  headerSub:   { fontSize: 11, color: 'rgba(0,255,136,0.5)' },
  hbtn: {
    background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.25)',
    color: '#00ff88', padding: '3px 10px', fontSize: 11, cursor: 'pointer',
    borderRadius: 3, fontFamily: 'monospace',
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  // Left panel
  leftPanel: {
    width: 220, borderRight: '1px solid rgba(0,255,136,0.12)',
    display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', flexShrink: 0,
  },
  panelSection: { padding: '10px 12px', borderBottom: '1px solid rgba(0,255,136,0.1)' },
  panelLabel: { fontSize: 10, color: 'rgba(0,255,136,0.4)', marginBottom: 8, letterSpacing: '0.08em' },
  filterBtn: (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    background: active ? 'rgba(0,255,136,0.1)' : 'transparent',
    border: 'none', borderLeft: active ? '2px solid #00ff88' : '2px solid transparent',
    color: active ? '#00ff88' : 'rgba(0,255,136,0.5)',
    padding: '5px 8px', fontSize: 11, cursor: 'pointer',
    fontFamily: 'monospace', marginBottom: 2, textAlign: 'left',
  }),
  layerBtn: (active: boolean): React.CSSProperties => ({
    display: 'block', width: '100%', textAlign: 'left',
    background: active ? 'rgba(0,255,136,0.1)' : 'transparent',
    border: 'none', borderLeft: active ? '2px solid #00ff88' : '2px solid transparent',
    color: active ? '#00ff88' : 'rgba(0,255,136,0.45)',
    padding: '4px 8px', fontSize: 10, cursor: 'pointer',
    fontFamily: 'monospace', marginBottom: 1, lineHeight: 1.4,
  }),
  // Map area
  mapWrap: { flex: 1, position: 'relative' as const, background: '#000810' },
  // Right detail panel
  rightPanel: {
    width: 280, borderLeft: '1px solid rgba(0,255,136,0.12)',
    display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', flexShrink: 0,
  },
  detailScroll: { flex: 1, overflowY: 'auto' as const, padding: '12px' },
  detailName: { fontSize: 14, fontWeight: 700, color: '#00ff88', marginBottom: 4 },
  detailSub:  { fontSize: 11, color: 'rgba(0,255,136,0.5)', marginBottom: 12 },
  detailRow:  { display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11 },
  detailKey:  { color: 'rgba(0,255,136,0.4)', flexShrink: 0, marginRight: 8 },
  detailVal:  { color: '#00ff88', textAlign: 'right' as const },
  badge: (type: keyof typeof TYPE_CONFIG): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 8px', fontSize: 10, borderRadius: 2,
    background: TYPE_CONFIG[type].color + '22',
    color: TYPE_CONFIG[type].color,
    border: `1px solid ${TYPE_CONFIG[type].color}44`,
    marginBottom: 8,
  }),
  siteListItem: (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', cursor: 'pointer', fontSize: 11,
    background: active ? 'rgba(0,255,136,0.07)' : 'transparent',
    borderLeft: active ? '2px solid #00ff88' : '2px solid transparent',
    display: 'flex', alignItems: 'center', gap: 8,
  }),
  wmsPreview: {
    width: '100%', height: 140, objectFit: 'cover' as const,
    borderRadius: 4, border: '1px solid rgba(0,255,136,0.15)',
    marginBottom: 10, background: '#001a2e',
  },
  openWorldview: {
    display: 'block', width: '100%', background: 'rgba(0,255,136,0.08)',
    border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88',
    padding: '6px 0', fontSize: 11, cursor: 'pointer', textAlign: 'center' as const,
    borderRadius: 3, fontFamily: 'monospace', marginTop: 10,
    textDecoration: 'none',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const SatelliteImageryTab: React.FC = () => {
  const mapRef       = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef   = useRef<any>(null);   // L (Leaflet instance)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapObjRef    = useRef<any>(null);   // Leaflet map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tileLayerRef = useRef<any>(null);   // active GIBS tile layer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef   = useRef<any[]>([]);

  const [sites,       setSites]       = useState<ResourceSite[]>([]);
  const [layers,      setLayers]      = useState<GibsLayer[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [selected,    setSelected]    = useState<ResourceSite | null>(null);
  const [activeLayer, setActiveLayer] = useState<string>('true_color');
  const [typeFilter,  setTypeFilter]  = useState<string>('all');
  const [imgError,    setImgError]    = useState(false);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res  = await fetch('/api/resource-sites');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load data');
      setSites(data.sites);
      setLayers(data.layers);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Init Leaflet ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapObjRef.current) return;

    // Dynamic import so Next.js SSR doesn't explode
    import('leaflet').then((L) => {
      leafletRef.current = L;

      // Fix default icon path issue in Next.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center:    [20, 10],
        zoom:      2,
        zoomControl: true,
        attributionControl: true,
      });

      mapObjRef.current = map;

      // Dark basemap (CartoDB Dark Matter)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
        opacity: 0.8,
      }).addTo(map);
    });

    return () => {
      if (mapObjRef.current) {
        mapObjRef.current.remove();
        mapObjRef.current = null;
      }
    };
  }, []);

  // ── Update GIBS tile layer when activeLayer changes ────────────────────────
  useEffect(() => {
    const L   = leafletRef.current;
    const map = mapObjRef.current;
    if (!L || !map || !layers.length) return;

    const layerMeta = layers.find(l => l.id === activeLayer);
    if (!layerMeta) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    tileLayerRef.current = L.tileLayer(layerMeta.tileUrl, {
      attribution: layerMeta.attribution,
      maxZoom:     layerMeta.maxZoom,
      opacity:     0.75,
    }).addTo(map);
  }, [activeLayer, layers]);

  // ── Render markers when sites / filter / selection changes ─────────────────
  useEffect(() => {
    const L   = leafletRef.current;
    const map = mapObjRef.current;
    if (!L || !map) return;

    // Remove old markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    const filtered = typeFilter === 'all' ? sites : sites.filter(s => s.type === typeFilter);

    filtered.forEach(site => {
      const cfg  = TYPE_CONFIG[site.type];
      const isSelected = selected?.id === site.id;

      const svgSize  = isSelected ? 18 : 13;
      const ringSize = svgSize + 10;

      const svgIcon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:${ringSize}px;height:${ringSize}px;display:flex;align-items:center;justify-content:center;">
            ${isSelected ? `<div style="position:absolute;width:${ringSize}px;height:${ringSize}px;border-radius:50%;border:1.5px solid ${cfg.color};animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite;opacity:.6;"></div>` : ''}
            <div style="width:${svgSize}px;height:${svgSize}px;border-radius:50%;background:${cfg.color};border:${isSelected ? '2px' : '1.5px'} solid ${isSelected ? '#fff' : cfg.color + 'aa'};box-shadow:0 0 ${isSelected ? 12 : 6}px ${cfg.glow};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:${isSelected ? 9 : 7}px;"></div>
          </div>
        `,
        iconSize:   [ringSize, ringSize],
        iconAnchor: [ringSize / 2, ringSize / 2],
      });

      const marker = L.marker([site.lat, site.lng], { icon: svgIcon })
        .addTo(map)
        .bindTooltip(
          `<div style="font-family:monospace;font-size:11px;background:#000c1a;color:#00ff88;border:1px solid rgba(0,255,136,0.3);padding:4px 8px;border-radius:3px;">
            <b>${site.name}</b><br/>
            <span style="color:${cfg.color}">${cfg.icon} ${cfg.label}</span> · ${site.country}
          </div>`,
          { direction: 'top', offset: [0, -10], opacity: 1, className: 'sat-tooltip' }
        )
        .on('click', () => {
          setSelected(prev => prev?.id === site.id ? null : site);
        });

      markersRef.current.push(marker);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites, typeFilter, selected]);

  // ── Fly to selected site ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !selected) return;
    map.flyTo([selected.lat, selected.lng], 6, { duration: 1.2 });
    setImgError(false);
  }, [selected]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const filteredSites = typeFilter === 'all' ? sites : sites.filter(s => s.type === typeFilter);

  const wmsPreviewUrl = (site: ResourceSite) => {
    const [west, south, east, north] = site.bbox;
    const base = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
    const params = new URLSearchParams({
      SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap',
      LAYERS:  site.gibsLayer,
      FORMAT:  'image/jpeg',
      TIME:    site.gibsDate,
      SRS:     'EPSG:4326',
      BBOX:    `${west},${south},${east},${north}`,
      WIDTH:   '512',
      HEIGHT:  '256',
      STYLES:  '',
      TRANSPARENT: 'false',
    });
    return `${base}?${params.toString()}`;
  };

  const worldviewUrl = (site: ResourceSite) => {
    const [w, s, e, n] = site.bbox;
    return `https://worldview.earthdata.nasa.gov/?v=${w},${s},${e},${n}&l=${site.gibsLayer}&t=${site.gibsDate}`;
  };

  const typeCounts = (type: string) =>
    type === 'all' ? sites.length : sites.filter(s => s.type === type).length;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      {/* Ping animation for selected marker */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        .sat-tooltip .leaflet-tooltip-content { padding: 0; }
        .leaflet-tooltip.sat-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-container { background: #000810; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,136,0.2); border-radius: 2px; }
      `}</style>

      <div style={S.root}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={S.header}>
          <span style={S.headerTitle}>◈ SATELLITE RESOURCE IMAGERY</span>
          <span style={S.headerSub}>
            {loading
              ? 'LOADING DATA...'
              : error
              ? `ERROR: ${error}`
              : `${sites.length} SITES · NASA GIBS · USGS`
            }
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button style={S.hbtn} onClick={fetchData}>↺ REFRESH</button>
            <a
              href="https://worldview.earthdata.nasa.gov"
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...S.hbtn, textDecoration: 'none' }}
            >
              ⬡ NASA WORLDVIEW ↗
            </a>
          </div>
        </div>

        <div style={S.body}>
          {/* ── Left Panel ───────────────────────────────────────────────── */}
          <div style={S.leftPanel}>
            {/* Resource type filter */}
            <div style={S.panelSection}>
              <div style={S.panelLabel}>RESOURCE TYPE</div>
              {(['all', 'oil', 'gas', 'gold', 'mineral'] as const).map(t => (
                <button
                  key={t}
                  style={S.filterBtn(typeFilter === t)}
                  onClick={() => setTypeFilter(t)}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: t === 'all' ? '#00ff88' : TYPE_CONFIG[t].color,
                    display: 'inline-block',
                  }} />
                  <span style={{ flex: 1 }}>
                    {t === 'all' ? 'All Resources' : TYPE_CONFIG[t].label}
                  </span>
                  <span style={{ opacity: 0.5, fontSize: 10 }}>{typeCounts(t)}</span>
                </button>
              ))}
            </div>

            {/* Satellite layer picker */}
            <div style={S.panelSection}>
              <div style={S.panelLabel}>SATELLITE LAYER</div>
              {layers.map(l => (
                <button
                  key={l.id}
                  style={S.layerBtn(activeLayer === l.id)}
                  onClick={() => setActiveLayer(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Site list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              <div style={{ ...S.panelLabel, padding: '6px 12px 2px' }}>SITES ({filteredSites.length})</div>
              {filteredSites.map(site => {
                const cfg = TYPE_CONFIG[site.type];
                return (
                  <div
                    key={site.id}
                    style={S.siteListItem(selected?.id === site.id)}
                    onClick={() => setSelected(prev => prev?.id === site.id ? null : site)}
                  >
                    <span style={{ fontSize: 12 }}>{cfg.icon}</span>
                    <span style={{
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: 'rgba(0,255,136,0.8)', fontSize: 11,
                    }}>
                      {site.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Map ──────────────────────────────────────────────────────── */}
          <div style={S.mapWrap}>
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

            {/* Layer legend overlay */}
            <div style={{
              position: 'absolute', bottom: 24, left: 12, zIndex: 999,
              display: 'flex', gap: 12, fontSize: 10,
              background: 'rgba(0,8,20,0.75)', padding: '6px 10px', borderRadius: 4,
              border: '1px solid rgba(0,255,136,0.12)',
            }}>
              {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                <span key={type} style={{ color: cfg.color, opacity: 0.85 }}>
                  {cfg.icon} {cfg.label}
                </span>
              ))}
            </div>

            {loading && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,8,20,0.85)', zIndex: 1000,
                flexDirection: 'column', gap: 10,
              }}>
                <div style={{ fontSize: 28, animation: 'spin 2s linear infinite' }}>◈</div>
                <div style={{ fontSize: 13, color: '#00ff88' }}>LOADING RESOURCE DATA...</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
          </div>

          {/* ── Right Detail Panel ───────────────────────────────────────── */}
          <div style={S.rightPanel}>
            {selected ? (
              <div style={S.detailScroll}>
                {/* NASA WMS satellite image preview */}
                {!imgError ? (
                  <img
                    src={wmsPreviewUrl(selected)}
                    alt={`Satellite image of ${selected.name}`}
                    style={S.wmsPreview}
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div style={{
                    ...S.wmsPreview,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: 'rgba(0,255,136,0.3)', flexDirection: 'column', gap: 6,
                  }}>
                    <span style={{ fontSize: 24 }}>◌</span>
                    <span>Imagery unavailable</span>
                    <span style={{ fontSize: 10 }}>Open NASA Worldview below</span>
                  </div>
                )}

                <div style={S.detailName}>{selected.name}</div>
                <div style={{ marginBottom: 8 }}>
                  <span style={S.badge(selected.type)}>
                    {TYPE_CONFIG[selected.type].icon} {TYPE_CONFIG[selected.type].label}
                  </span>
                </div>
                <div style={{ ...S.detailSub, marginBottom: 10 }}>{selected.subtype}</div>

                <p style={{
                  fontSize: 11, color: 'rgba(0,255,136,0.7)', lineHeight: 1.6,
                  marginBottom: 12, borderBottom: '1px solid rgba(0,255,136,0.1)', paddingBottom: 12,
                }}>
                  {selected.description}
                </p>

                {[
                  ['COUNTRY',    selected.country],
                  ['LATITUDE',   `${selected.lat.toFixed(2)}°`],
                  ['LONGITUDE',  `${selected.lng.toFixed(2)}°`],
                  selected.reserves   ? ['RESERVES',   selected.reserves]   : null,
                  selected.production ? ['PRODUCTION', selected.production] : null,
                  ['IMG DATE',  selected.gibsDate],
                  ['IMG LAYER', selected.gibsLayer.replace(/_/g, ' ')],
                ].filter(Boolean).map(([k, v]:any) => (
                  <div key={k} style={S.detailRow}>
                    <span style={S.detailKey}>{k}</span>
                    <span style={{ ...S.detailVal, fontSize: 10 }}>{v}</span>
                  </div>
                ))}

                <a
                  href={worldviewUrl(selected)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={S.openWorldview}
                >
                  ◈ OPEN IN NASA WORLDVIEW ↗
                </a>

                <button
                  style={{ ...S.openWorldview, marginTop: 6, border: '1px solid rgba(0,255,136,0.12)' }}
                  onClick={() => {
                    const map = mapObjRef.current;
                    if (map) map.flyToBounds([
                      [selected.bbox[1], selected.bbox[0]],
                      [selected.bbox[3], selected.bbox[2]],
                    ], { duration: 1 });
                  }}
                >
                  ⬡ FIT BBOX ON MAP
                </button>

                <button
                  style={{
                    ...S.openWorldview, marginTop: 6,
                    border: '1px solid rgba(255,100,100,0.2)', color: 'rgba(0,255,136,0.4)',
                  }}
                  onClick={() => setSelected(null)}
                >
                  ✕ CLEAR SELECTION
                </button>
              </div>
            ) : (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: 24, gap: 10,
              }}>
                <div style={{ fontSize: 32, opacity: 0.2 }}>◈</div>
                <div style={{ fontSize: 12, color: 'rgba(0,255,136,0.3)', textAlign: 'center', lineHeight: 1.6 }}>
                  Click any marker<br />or site in the list<br />to view satellite imagery
                </div>
                <div style={{
                  marginTop: 16, padding: '8px 12px',
                  background: 'rgba(0,255,136,0.04)',
                  border: '1px solid rgba(0,255,136,0.1)',
                  borderRadius: 4, fontSize: 10,
                  color: 'rgba(0,255,136,0.35)', lineHeight: 1.7,
                  textAlign: 'center',
                }}>
                  Imagery provided by<br />NASA Global Imagery<br />Browse Services (GIBS)<br />
                  <span style={{ color: 'rgba(0,255,136,0.5)' }}>No API key required</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SatelliteImageryTab;