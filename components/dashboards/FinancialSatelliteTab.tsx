'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type {
  FinancialSite, GibsLayer, SatellitePosition,
  OilTankData, FlaringData, ParkingData, NdviData, MaritimeData,
} from '@/app/api/financial-satellite/route';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const MODULE_CONFIG = {
  oil_tank: {
    label: 'Crude Oil Inventory',
    icon:  '🛢',
    color: '#ff8c42',
    glow:  'rgba(255,140,66,0.35)',
    desc:  'Tank shadow volume estimation',
  },
  flaring: {
    label: 'Flaring & Emissions',
    icon:  '🔥',
    color: '#ff4d4d',
    glow:  'rgba(255,77,77,0.35)',
    desc:  'Infrared / nighttime detection',
  },
  parking: {
    label: 'Retail Parking',
    icon:  '🅿',
    color: '#00c8ff',
    glow:  'rgba(0,200,255,0.35)',
    desc:  'Car-count earnings signal',
  },
  ndvi: {
    label: 'Crop Health (NDVI)',
    icon:  '🌾',
    color: '#00e676',
    glow:  'rgba(0,230,118,0.35)',
    desc:  'Multi-spectral yield forecasting',
  },
  maritime: {
    label: 'Maritime / SAR',
    icon:  '⚓',
    color: '#a78bfa',
    glow:  'rgba(167,139,250,0.35)',
    desc:  'Draft & congestion analytics',
  },
} as const;

type ModuleKey = keyof typeof MODULE_CONFIG;

const SIGNAL_CFG = {
  strong_buy:  { label: 'Strong Buy',  color: '#00e676' },
  buy:         { label: 'Buy',         color: '#69f0ae' },
  neutral:     { label: 'Neutral',     color: '#ffd740' },
  sell:        { label: 'Sell',        color: '#ff6e40' },
  strong_sell: { label: 'Strong Sell', color: '#ff1744' },
};

// ─────────────────────────────────────────────────────────────────────────────
// INLINE STYLES
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  root: {
    display: 'flex', flexDirection: 'column' as const,
    height: '100%', minHeight: 600,
    background: '#000c1a', fontFamily: 'monospace',
    color: '#00ff88', overflow: 'hidden',
  },
  // Header
  header: {
    padding: '8px 16px', flexShrink: 0,
    borderBottom: '1px solid rgba(0,255,136,0.15)',
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const,
  },
  headerTitle: { fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' },
  headerSub:   { fontSize: 11, color: 'rgba(0,255,136,0.45)', flex: 1 },
  hbtn: (active?: boolean): React.CSSProperties => ({
    background: active ? 'rgba(0,255,136,0.15)' : 'rgba(0,255,136,0.06)',
    border: `1px solid ${active ? 'rgba(0,255,136,0.5)' : 'rgba(0,255,136,0.2)'}`,
    color: active ? '#00ff88' : 'rgba(0,255,136,0.6)',
    padding: '3px 10px', fontSize: 10, cursor: 'pointer',
    borderRadius: 3, fontFamily: 'monospace', letterSpacing: '0.05em',
  }),
  // Body
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  // Left sidebar
  sidebar: {
    width: 200, borderRight: '1px solid rgba(0,255,136,0.1)',
    display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', flexShrink: 0,
  },
  sideSection: { padding: '8px 10px', borderBottom: '1px solid rgba(0,255,136,0.08)' },
  sideLabel: { fontSize: 9, color: 'rgba(0,255,136,0.35)', marginBottom: 6, letterSpacing: '0.1em' },
  moduleBtn: (active: boolean, color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 7, width: '100%',
    background: active ? `${color}12` : 'transparent',
    border: 'none', borderLeft: `2px solid ${active ? color : 'transparent'}`,
    color: active ? color : 'rgba(0,255,136,0.45)',
    padding: '5px 8px', fontSize: 10, cursor: 'pointer',
    fontFamily: 'monospace', marginBottom: 1, textAlign: 'left' as const,
  }),
  layerBtn: (active: boolean): React.CSSProperties => ({
    display: 'block', width: '100%', textAlign: 'left' as const,
    background: 'transparent',
    border: 'none', borderLeft: `2px solid ${active ? '#00ff88' : 'transparent'}`,
    color: active ? '#00ff88' : 'rgba(0,255,136,0.4)',
    padding: '3px 8px', fontSize: 9, cursor: 'pointer',
    fontFamily: 'monospace', marginBottom: 1, lineHeight: 1.5,
  }),
  siteList: { flex: 1, overflowY: 'auto' as const },
  siteItem: (active: boolean, color: string): React.CSSProperties => ({
    padding: '5px 10px', cursor: 'pointer', fontSize: 10,
    background: active ? `${color}10` : 'transparent',
    borderLeft: `2px solid ${active ? color : 'transparent'}`,
    display: 'flex', alignItems: 'center', gap: 6,
    color: 'rgba(0,255,136,0.75)',
  }),
  // Map
  mapWrap: { flex: 1, position: 'relative' as const, background: '#000810' },
  // Right detail panel
  detail: {
    width: 270, borderLeft: '1px solid rgba(0,255,136,0.1)',
    display: 'flex', flexDirection: 'column' as const, overflowY: 'auto' as const,
    flexShrink: 0,
  },
  detailPad: { padding: '12px' },
  detailName: { fontSize: 13, fontWeight: 700, marginBottom: 2 },
  detailSub:  { fontSize: 10, color: 'rgba(0,255,136,0.45)', marginBottom: 10 },
  row: { display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 10 },
  key: { color: 'rgba(0,255,136,0.4)', marginRight: 6, flexShrink: 0 },
  val: { color: '#00ff88', textAlign: 'right' as const, fontSize: 10 },
  divider: { borderTop: '1px solid rgba(0,255,136,0.08)', margin: '10px 0' },
  // Stat box
  statBox: (color: string): React.CSSProperties => ({
    background: `${color}10`, border: `1px solid ${color}25`,
    borderRadius: 3, padding: '6px 10px', marginBottom: 6,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }),
  statLabel: { fontSize: 9, color: 'rgba(0,255,136,0.4)', letterSpacing: '0.06em' },
  statVal:   (color: string): React.CSSProperties => ({
    fontSize: 16, fontWeight: 700, color,
  }),
  // Satellite overlay toggle
  satToggle: {
    position: 'absolute' as const, top: 10, right: 10, zIndex: 1000,
    background: 'rgba(0,8,20,0.85)', border: '1px solid rgba(0,255,136,0.2)',
    padding: '6px 10px', borderRadius: 4, display: 'flex', gap: 6, alignItems: 'center',
  },
  // Legend
  legend: {
    position: 'absolute' as const, bottom: 24, left: 10, zIndex: 999,
    background: 'rgba(0,8,20,0.8)', border: '1px solid rgba(0,255,136,0.1)',
    padding: '5px 10px', borderRadius: 4, display: 'flex', gap: 10,
  },
  legendItem: { fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 },
  dot: (color: string): React.CSSProperties => ({
    width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0,
  }),
  // Loading
  loadingOverlay: {
    position: 'absolute' as const, inset: 0, zIndex: 1000,
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center', gap: 10,
    background: 'rgba(0,8,20,0.88)',
  },
  // WMS preview image
  wmsImg: {
    width: '100%', height: 120, objectFit: 'cover' as const,
    borderRadius: 3, border: '1px solid rgba(0,255,136,0.12)',
    marginBottom: 10, background: '#001a2e', display: 'block',
  },
  emptyDetail: {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
    padding: 20, gap: 8, textAlign: 'center' as const,
  },
  actionBtn: (danger?: boolean): React.CSSProperties => ({
    display: 'block', width: '100%', textAlign: 'center' as const,
    background: 'rgba(0,255,136,0.06)',
    border: `1px solid ${danger ? 'rgba(255,100,100,0.2)' : 'rgba(0,255,136,0.2)'}`,
    color: danger ? 'rgba(0,255,136,0.4)' : '#00ff88',
    padding: '5px 0', fontSize: 10, cursor: 'pointer',
    borderRadius: 3, fontFamily: 'monospace', marginTop: 6,
    textDecoration: 'none',
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function wmsPreviewUrl(site: FinancialSite) {
  const [west, south, east, north] = site.bbox;
  const p = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap',
    LAYERS: site.gibsLayer, FORMAT: 'image/jpeg', TIME: site.gibsDate,
    SRS: 'EPSG:4326', BBOX: `${west},${south},${east},${north}`,
    WIDTH: '512', HEIGHT: '256', STYLES: '', TRANSPARENT: 'false',
  });
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${p}`;
}

function worldviewUrl(site: FinancialSite) {
  const [w, s, e, n] = site.bbox;
  return `https://worldview.earthdata.nasa.gov/?v=${w},${s},${e},${n}&l=${site.gibsLayer}&t=${site.gibsDate}`;
}

function delta(val: number, suffix = '%') {
  const sign = val >= 0 ? '+' : '';
  const color = val >= 0 ? '#00e676' : '#ff6e40';
  return <span style={{ color }}>{sign}{val.toFixed(1)}{suffix}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE DETAIL PANELS
// ─────────────────────────────────────────────────────────────────────────────
function OilTankDetail({ d }: { d: OilTankData }) {
  const col = MODULE_CONFIG.oil_tank.color;
  return (
    <>
      <div style={S.statBox(col)}>
        <div>
          <div style={S.statLabel}>EST. VOLUME</div>
          <div style={S.statVal(col)}>{d.estimatedVolumeMMbbl.toFixed(1)} <span style={{ fontSize: 10 }}>MMbbl</span></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={S.statLabel}>FILL LEVEL</div>
          <div style={{ ...S.statVal(col), fontSize: 18 }}>{d.fillLevelPct}%</div>
        </div>
      </div>
      {/* Fill bar */}
      <div style={{ background: 'rgba(0,255,136,0.08)', borderRadius: 2, height: 6, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ width: `${d.fillLevelPct}%`, height: '100%', background: col, borderRadius: 2, transition: 'width 0.5s' }} />
      </div>
      {[
        ['TANK COUNT',   d.tankCount],
        ['SHADOW ANGLE', `${d.shadowAngleDeg}°`],
        ['WoW CHANGE',   delta(d.weekOverWeekChangePct)],
        ['OPERATOR',     d.operator],
        ['CAPACITY',     d.capacity],
      ].map(([k, v]: any) => (
        <div key={String(k)} style={S.row}><span style={S.key}>{k}</span><span style={S.val}>{v}</span></div>
      ))}
      <div style={S.divider} />
      <div style={{ fontSize: 9, color: 'rgba(0,255,136,0.35)', lineHeight: 1.6 }}>
        Shadow geometry computed from sun elevation angle and tank roof edge displacement.
        EIA correlation: r² = 0.91 (Cushing reference).
      </div>
    </>
  );
}

function FlaringDetail({ d }: { d: FlaringData }) {
  const col = MODULE_CONFIG.flaring.color;
  const permitColor = d.permitStatus === 'permitted' ? '#00e676' : d.permitStatus === 'unpermitted' ? '#ff1744' : '#ffd740';
  const trendArrow = d.trend === 'increasing' ? '▲' : d.trend === 'decreasing' ? '▼' : '►';
  const trendColor = d.trend === 'increasing' ? '#ff6e40' : d.trend === 'decreasing' ? '#00e676' : '#ffd740';
  return (
    <>
      <div style={S.statBox(col)}>
        <div>
          <div style={S.statLabel}>INTENSITY</div>
          <div style={S.statVal(col)}>{d.flaringIntensityMW.toLocaleString()} <span style={{ fontSize: 10 }}>MW</span></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={S.statLabel}>CO₂ EST.</div>
          <div style={{ ...S.statVal(col), fontSize: 16 }}>{d.co2EstimateMtpa} <span style={{ fontSize: 9 }}>Mtpa</span></div>
        </div>
      </div>
      {[
        ['ACTIVE FLARES',   d.flareCountActive],
        ['TREND',           <span style={{ color: trendColor }}>{trendArrow} {d.trend.toUpperCase()}</span>],
        ['WELL TYPE',       d.wellType],
        ['PERMIT STATUS',   <span style={{ color: permitColor }}>{d.permitStatus.toUpperCase()}</span>],
      ].map(([k, v]: any) => (
        <div key={String(k)} style={S.row}><span style={S.key}>{k}</span><span style={S.val}>{v}</span></div>
      ))}
      <div style={S.divider} />
      <div style={{ fontSize: 9, color: 'rgba(0,255,136,0.35)', lineHeight: 1.6 }}>
        VIIRS DNB nighttime radiance + MODIS thermal anomaly fusion.
        Unpermitted flares flagged against EPA/GGFR permit registries.
      </div>
    </>
  );
}

function ParkingDetail({ d }: { d: ParkingData }) {
  const col = MODULE_CONFIG.parking.color;
  const sig = SIGNAL_CFG[d.signalStrength];
  return (
    <>
      <div style={{ ...S.statBox(sig.color), flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <div style={S.statLabel}>TRADING SIGNAL — {d.retailer}</div>
        <div style={{ ...S.statVal(sig.color), fontSize: 20 }}>{sig.label}</div>
      </div>
      <div style={S.statBox(col)}>
        <div>
          <div style={S.statLabel}>AVG OCCUPANCY</div>
          <div style={S.statVal(col)}>{d.avgOccupancyPct}%</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={S.statLabel}>vs SEASONAL AVG</div>
          <div style={{ ...S.statVal(col), fontSize: 16 }}>{delta(d.vsSeasonalAvgPct)}</div>
        </div>
      </div>
      {/* Occupancy bar */}
      <div style={{ background: 'rgba(0,255,136,0.08)', borderRadius: 2, height: 6, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ width: `${d.avgOccupancyPct}%`, height: '100%', background: col, borderRadius: 2 }} />
      </div>
      {[
        ['LOCATIONS',    d.locationCount.toLocaleString()],
        ['WoW CHANGE',   delta(d.weekOverWeekChangePct)],
        ['EARNINGS DATE', d.earningsDate],
      ].map(([k, v]: any) => (
        <div key={String(k)} style={S.row}><span style={S.key}>{k}</span><span style={S.val}>{v}</span></div>
      ))}
      <div style={S.divider} />
      <div style={{ fontSize: 9, color: 'rgba(0,255,136,0.35)', lineHeight: 1.6 }}>
        UC Berkeley Haas: parking lot volume imagery yields 4–5% edge in 3-day window around earnings.
        Signal based on Δ occupancy vs trailing 12-week average.
      </div>
    </>
  );
}

function NdviDetail({ d }: { d: NdviData }) {
  const col = MODULE_CONFIG.ndvi.color;
  const stressColor = d.moistureStress === 'low' ? '#00e676' : d.moistureStress === 'moderate' ? '#ffd740' : '#ff6e40';
  const ndviPct = Math.round(d.ndviIndex * 100);
  return (
    <>
      <div style={S.statBox(col)}>
        <div>
          <div style={S.statLabel}>NDVI INDEX</div>
          <div style={S.statVal(col)}>{d.ndviIndex.toFixed(2)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={S.statLabel}>vs 5-YR AVG</div>
          <div style={{ ...S.statVal(col), fontSize: 16 }}>{delta(d.ndviVs5YrAvg, '')}</div>
        </div>
      </div>
      {/* NDVI bar */}
      <div style={{ background: 'rgba(0,255,136,0.08)', borderRadius: 2, height: 6, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ width: `${ndviPct}%`, height: '100%', background: col, borderRadius: 2 }} />
      </div>
      {[
        ['CROP',            d.crop],
        ['EST. YIELD',      `${d.estimatedYieldMt.toLocaleString()} Mt`],
        ['ACREAGE',         `${d.acreageMHa.toFixed(1)} M ha`],
        ['HARVEST EST.',    d.harvestDateEst],
        ['MOISTURE STRESS', <span style={{ color: stressColor }}>{d.moistureStress.toUpperCase()}</span>],
      ].map(([k, v]: any) => (
        <div key={String(k)} style={S.row}><span style={S.key}>{k}</span><span style={S.val}>{v}</span></div>
      ))}
      <div style={S.divider} />
      <div style={{ fontSize: 9, color: 'rgba(0,255,136,0.35)', lineHeight: 1.6 }}>
        Sentinel-2 B08/B04 NDVI fusion with MODIS 8-day composite.
        Deep learning yield model trained on FAO GAEZ ground truth data.
      </div>
    </>
  );
}

function MaritimeDetail({ d }: { d: MaritimeData }) {
  const col = MODULE_CONFIG.maritime.color;
  const congColor = d.portCongestionScore >= 75 ? '#ff6e40' : d.portCongestionScore >= 50 ? '#ffd740' : '#00e676';
  return (
    <>
      <div style={S.statBox(col)}>
        <div>
          <div style={S.statLabel}>VESSEL COUNT</div>
          <div style={S.statVal(col)}>{d.vesselCount}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={S.statLabel}>CONGESTION</div>
          <div style={{ ...S.statVal(congColor), fontSize: 18 }}>{d.portCongestionScore}<span style={{ fontSize: 9 }}>/100</span></div>
        </div>
      </div>
      {/* Congestion bar */}
      <div style={{ background: 'rgba(0,255,136,0.08)', borderRadius: 2, height: 6, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ width: `${d.portCongestionScore}%`, height: '100%', background: congColor, borderRadius: 2 }} />
      </div>
      {[
        ['COMMODITY',       d.commodityType],
        ['AVG DRAFT',       `${d.avgDraftM} m`],
        ['DRAFT CHANGE',    delta(d.avgDraftChangeM, ' m')],
        ['WAITING VESSELS', d.waitingVessels],
        ['TRADE ROUTE',     d.tradeRoute],
      ].map(([k, v]: any) => (
        <div key={String(k)} style={S.row}><span style={S.key}>{k}</span><span style={S.val}>{v}</span></div>
      ))}
      <div style={S.divider} />
      <div style={{ fontSize: 9, color: 'rgba(0,255,136,0.35)', lineHeight: 1.6 }}>
        SAR (Sentinel-1 / COSMO-SkyMed) draft measurement ±0.2 m.
        Positive Δ draft = vessel more loaded = higher commodity volume in transit.
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const FinancialSatelliteTab: React.FC = () => {
  const mapRef      = useRef<HTMLDivElement>(null);
  const leafletRef  = useRef<any>(null);
  const mapObjRef   = useRef<any>(null);
  const tileRef     = useRef<any>(null);
  const markersRef  = useRef<any[]>([]);
  const satLayerRef = useRef<any>(null);

  const [sites,        setSites]        = useState<FinancialSite[]>([]);
  const [layers,       setLayers]       = useState<GibsLayer[]>([]);
  const [satellites,   setSatellites]   = useState<SatellitePosition[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [satLoading,   setSatLoading]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [selected,     setSelected]     = useState<FinancialSite | null>(null);
  const [activeLayer,  setActiveLayer]  = useState('true_color');
  const [moduleFilter, setModuleFilter] = useState<ModuleKey | 'all'>('all');
  const [showSats,     setShowSats]     = useState(false);
  const [imgError,     setImgError]     = useState(false);

  // ── Fetch sites ──────────────────────────────────────────────────────────
  const fetchSites = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res  = await fetch('/api/financial-satellite?type=sites');
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Failed to load');
      setSites(data.sites);
      setLayers(data.layers);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch satellites ─────────────────────────────────────────────────────
  const fetchSatellites = useCallback(async () => {
    try {
      setSatLoading(true);
      const res  = await fetch('/api/financial-satellite?type=satellites');
      const data = await res.json();
      if (data.success) setSatellites(data.satellites ?? []);
    } catch { /* silent */ } finally {
      setSatLoading(false);
    }
  }, []);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  useEffect(() => {
    if (showSats && satellites.length === 0) fetchSatellites();
  }, [showSats, satellites.length, fetchSatellites]);

  // ── Init Leaflet ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapObjRef.current) return;

    import('leaflet').then((L) => {
      leafletRef.current = L;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, { center: [20, 10], zoom: 2, zoomControl: true });
      mapObjRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd', maxZoom: 19, opacity: 0.85,
      }).addTo(map);
    });

    return () => {
      if (mapObjRef.current) { mapObjRef.current.remove(); mapObjRef.current = null; }
    };
  }, []);

  // ── Update GIBS tile layer ───────────────────────────────────────────────
  useEffect(() => {
    const L = leafletRef.current, map = mapObjRef.current;
    if (!L || !map || !layers.length) return;
    const meta = layers.find(l => l.id === activeLayer);
    if (!meta) return;
    if (tileRef.current) map.removeLayer(tileRef.current);
    tileRef.current = L.tileLayer(meta.tileUrl, {
      attribution: meta.attribution, maxZoom: meta.maxZoom, opacity: 0.7,
    }).addTo(map);
  }, [activeLayer, layers]);

  // ── Render site markers ──────────────────────────────────────────────────
  useEffect(() => {
    const L = leafletRef.current, map = mapObjRef.current;
    if (!L || !map) return;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    const filtered = moduleFilter === 'all' ? sites : sites.filter(s => s.module === moduleFilter);

    filtered.forEach(site => {
      const cfg = MODULE_CONFIG[site.module];
      const isSel = selected?.id === site.id;
      const sz  = isSel ? 17 : 12;
      const ring = sz + 10;

      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:${ring}px;height:${ring}px;display:flex;align-items:center;justify-content:center;">
          ${isSel ? `<div style="position:absolute;width:${ring}px;height:${ring}px;border-radius:50%;border:1.5px solid ${cfg.color};animation:ping 1.4s ease-in-out infinite;opacity:.6;"></div>` : ''}
          <div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${cfg.color};border:${isSel ? '2px solid #fff' : `1.5px solid ${cfg.color}88`};box-shadow:0 0 ${isSel ? 12 : 5}px ${cfg.glow};cursor:pointer;"></div>
        </div>`,
        iconSize: [ring, ring], iconAnchor: [ring / 2, ring / 2],
      });

      const m = L.marker([site.lat, site.lng], { icon })
        .addTo(map)
        .bindTooltip(
          `<div style="font-family:monospace;font-size:10px;background:#000c1a;color:${cfg.color};border:1px solid ${cfg.color}44;padding:4px 8px;border-radius:3px;">
            <b>${site.name}</b><br/>${cfg.icon} ${cfg.label} · ${site.country}
          </div>`,
          { direction: 'top', offset: [0, -8], opacity: 1, className: 'fs-tip' }
        )
        .on('click', () => setSelected(prev => prev?.id === site.id ? null : site));

      markersRef.current.push(m);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites, moduleFilter, selected]);

  // ── Render satellite markers ─────────────────────────────────────────────
  useEffect(() => {
    const L = leafletRef.current, map = mapObjRef.current;
    if (!L || !map) return;

    if (satLayerRef.current) { map.removeLayer(satLayerRef.current); satLayerRef.current = null; }
    if (!showSats || !satellites.length) return;

    const layer = L.layerGroup().addTo(map);
    satLayerRef.current = layer;

    satellites.forEach(sat => {
      const color = sat.type === 'Space Station' ? '#ffd700' : sat.type === 'Weather' ? '#00c8ff' : '#ffffff';
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:5px;height:5px;border-radius:50%;background:${color};opacity:0.7;box-shadow:0 0 4px ${color};"></div>`,
        iconSize: [5, 5], iconAnchor: [2, 2],
      });
      L.marker([sat.lat, sat.lng], { icon })
        .bindTooltip(`<div style="font-family:monospace;font-size:9px;background:#000c1a;color:${color};border:1px solid ${color}44;padding:3px 6px;border-radius:2px;">${sat.name}<br/>${sat.alt} km · ${sat.type}</div>`, { className: 'fs-tip', opacity: 1 })
        .addTo(layer);
    });
  }, [showSats, satellites]);

  // ── Fly to selected ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !selected) return;
    map.flyTo([selected.lat, selected.lng], 6, { duration: 1.2 });
    setImgError(false);
  }, [selected]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const filtered = moduleFilter === 'all' ? sites : sites.filter(s => s.module === moduleFilter);
  const relevantLayers = selected
    ? layers.filter(l => l.useCase.includes(selected.module))
    : layers;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />
      <style>{`
        @keyframes ping { 75%,100%{transform:scale(2.2);opacity:0} }
        .leaflet-tooltip.fs-tip { background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important; }
        .leaflet-container { background:#000810; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:rgba(0,255,136,0.2);border-radius:2px; }
      `}</style>

      <div style={S.root}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={S.header}>
          <span style={S.headerTitle}>◈ FINANCIAL SATELLITE INTELLIGENCE</span>
          <span style={S.headerSub}>
            {loading ? 'LOADING...' : error ? `ERROR: ${error}` : `${sites.length} SITES · NASA GIBS · CELESTRAK`}
          </span>
          <button style={S.hbtn()} onClick={fetchSites}>↺ REFRESH</button>
          <button
            style={S.hbtn(showSats)}
            onClick={() => setShowSats(v => !v)}
          >
            {satLoading ? '◌ SATS...' : showSats ? '◈ SATS ON' : '◌ SATS OFF'}
          </button>
          <a href="https://worldview.earthdata.nasa.gov" target="_blank" rel="noopener noreferrer"
            style={{ ...S.hbtn(), textDecoration: 'none' }}>⬡ NASA WORLDVIEW ↗</a>
        </div>

        <div style={S.body}>
          {/* ── Sidebar ─────────────────────────────────────────────── */}
          <div style={S.sidebar}>
            {/* Module filter */}
            <div style={S.sideSection}>
              <div style={S.sideLabel}>USE CASE MODULE</div>
              <button style={S.moduleBtn(moduleFilter === 'all', '#00ff88')} onClick={() => setModuleFilter('all')}>
                <span style={S.dot('#00ff88')} /><span style={{ flex: 1 }}>All Modules</span>
                <span style={{ opacity: 0.4, fontSize: 9 }}>{sites.length}</span>
              </button>
              {(Object.keys(MODULE_CONFIG) as ModuleKey[]).map(m => {
                const cfg = MODULE_CONFIG[m];
                return (
                  <button key={m} style={S.moduleBtn(moduleFilter === m, cfg.color)} onClick={() => setModuleFilter(m)}>
                    <span style={{ fontSize: 11 }}>{cfg.icon}</span>
                    <span style={{ flex: 1, fontSize: 9 }}>{cfg.label}</span>
                    <span style={{ opacity: 0.4, fontSize: 9 }}>{sites.filter(s => s.module === m).length}</span>
                  </button>
                );
              })}
            </div>

            {/* Layer picker — show relevant layers when site selected */}
            <div style={S.sideSection}>
              <div style={S.sideLabel}>GIBS LAYER</div>
              {relevantLayers.map(l => (
                <button key={l.id} style={S.layerBtn(activeLayer === l.id)} onClick={() => setActiveLayer(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>

            {/* Site list */}
            <div style={S.siteList}>
              <div style={{ ...S.sideLabel, padding: '6px 10px 2px' }}>SITES ({filtered.length})</div>
              {filtered.map(site => {
                const cfg = MODULE_CONFIG[site.module];
                return (
                  <div key={site.id} style={S.siteItem(selected?.id === site.id, cfg.color)}
                    onClick={() => setSelected(p => p?.id === site.id ? null : site)}>
                    <span style={{ fontSize: 10 }}>{cfg.icon}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9 }}>
                      {site.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Map ─────────────────────────────────────────────────── */}
          <div style={S.mapWrap}>
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

            {/* Satellite count badge */}
            {showSats && satellites.length > 0 && (
              <div style={{ ...S.satToggle, fontSize: 9, color: '#ffd700' }}>
                <span style={{ ...S.dot('#ffd700'), width: 5, height: 5 }} />
                {satellites.length} SATS TRACKED
              </div>
            )}

            {/* Legend */}
            <div style={S.legend}>
              {(Object.keys(MODULE_CONFIG) as ModuleKey[]).map(m => (
                <span key={m} style={S.legendItem}>
                  <span style={S.dot(MODULE_CONFIG[m].color)} />
                  <span style={{ color: MODULE_CONFIG[m].color, opacity: 0.8, fontSize: 9 }}>{MODULE_CONFIG[m].icon}</span>
                </span>
              ))}
              {showSats && <span style={S.legendItem}><span style={S.dot('#ffd700')} /><span style={{ color: '#ffd700', opacity: 0.6, fontSize: 9 }}>SAT</span></span>}
            </div>

            {loading && (
              <div style={S.loadingOverlay}>
                <div style={{ fontSize: 26 }}>◈</div>
                <div style={{ fontSize: 12 }}>LOADING INTELLIGENCE DATA...</div>
              </div>
            )}
          </div>

          {/* ── Detail Panel ────────────────────────────────────────── */}
          <div style={S.detail}>
            {selected ? (() => {
              const cfg = MODULE_CONFIG[selected.module];
              return (
                <div style={S.detailPad}>
                  {/* WMS preview */}
                  {!imgError ? (
                    <img src={wmsPreviewUrl(selected)} alt={`Satellite view of ${selected.name}`}
                      style={S.wmsImg} onError={() => setImgError(true)} />
                  ) : (
                    <div style={{ ...S.wmsImg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <span style={{ fontSize: 20, opacity: 0.3 }}>◌</span>
                      <span style={{ fontSize: 9, color: 'rgba(0,255,136,0.3)' }}>IMAGERY UNAVAILABLE</span>
                    </div>
                  )}

                  {/* Site header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                    <div>
                      <div style={S.detailName}>{selected.name}</div>
                      <div style={S.detailSub}>{selected.country} · {selected.region}</div>
                    </div>
                  </div>

                  {/* Module badge */}
                  <div style={{ display: 'inline-block', padding: '2px 8px', fontSize: 9, borderRadius: 2,
                    background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}33`, marginBottom: 10 }}>
                    {cfg.label.toUpperCase()} · {cfg.desc.toUpperCase()}
                  </div>

                  <div style={S.divider} />

                  {/* Module-specific data */}
                  {selected.module === 'oil_tank'  && <OilTankDetail  d={selected.data as OilTankData}  />}
                  {selected.module === 'flaring'   && <FlaringDetail  d={selected.data as FlaringData}  />}
                  {selected.module === 'parking'   && <ParkingDetail  d={selected.data as ParkingData}  />}
                  {selected.module === 'ndvi'      && <NdviDetail     d={selected.data as NdviData}     />}
                  {selected.module === 'maritime'  && <MaritimeDetail d={selected.data as MaritimeData} />}

                  {/* Coords */}
                  <div style={S.divider} />
                  {[
                    ['LAT / LNG', `${selected.lat.toFixed(3)}° / ${selected.lng.toFixed(3)}°`],
                    ['IMG DATE',  selected.gibsDate],
                  ].map(([k, v]) => (
                    <div key={k} style={S.row}><span style={S.key}>{k}</span><span style={S.val}>{v}</span></div>
                  ))}

                  {/* Actions */}
                  <a href={worldviewUrl(selected)} target="_blank" rel="noopener noreferrer" style={S.actionBtn()}>
                    ◈ OPEN IN NASA WORLDVIEW ↗
                  </a>
                  <button style={S.actionBtn()} onClick={() => {
                    const m = mapObjRef.current;
                    if (m) m.flyToBounds([[selected.bbox[1], selected.bbox[0]], [selected.bbox[3], selected.bbox[2]]], { duration: 1 });
                  }}>
                    ⬡ FIT BBOX ON MAP
                  </button>
                  <button style={S.actionBtn(true)} onClick={() => setSelected(null)}>✕ CLEAR</button>
                </div>
              );
            })() : (
              <div style={S.emptyDetail}>
                <div style={{ fontSize: 30, opacity: 0.15 }}>◈</div>
                <div style={{ fontSize: 11, color: 'rgba(0,255,136,0.3)', lineHeight: 1.7 }}>
                  Select a site to view<br />financial intelligence
                </div>
                <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(0,255,136,0.03)',
                  border: '1px solid rgba(0,255,136,0.08)', borderRadius: 3, fontSize: 9,
                  color: 'rgba(0,255,136,0.3)', lineHeight: 1.8, textAlign: 'left' as const }}>
                  {(Object.keys(MODULE_CONFIG) as ModuleKey[]).map(m => (
                    <div key={m}>{MODULE_CONFIG[m].icon} {MODULE_CONFIG[m].label}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default FinancialSatelliteTab;