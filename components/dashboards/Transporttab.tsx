'use client';

/**
 * TransportTab — all CSS is scoped under [data-tt="root"]
 * so it never bleeds into the surrounding app layout.
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface LiveFlight {
  icao24: string; callsign: string; origin_country: string;
  lat: number; lng: number; altitude: number; velocity: number;
  heading: number; vertical_rate: number; on_ground: boolean; squawk: string;
}
export interface LiveShip {
  mmsi: string; name: string; lat: number; lng: number;
  speed: number; heading: number; course: number; status: number;
  type: number; flag: string; destination: string;
  length: number; width: number; draught: number; imo: string;
}
interface FlightApiResponse {
  success: boolean; count: number; total_airborne: number;
  flights: LiveFlight[]; fetchedAt: number; source?: string; error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const NAV_STATUS: Record<number, string> = {
  0:'Underway', 1:'Anchored', 2:'Not Under Command', 3:'Restricted',
  5:'Moored', 6:'Aground', 7:'Fishing', 8:'Sailing',
};
function shipCategory(t: number) {
  if (t >= 60 && t < 70) return 'passenger';
  if (t >= 70 && t < 80) return 'cargo';
  if (t >= 80 && t < 90) return 'tanker';
  if (t === 30) return 'fishing';
  if (t === 35) return 'naval';
  if (t === 52) return 'tug';
  if (t === 36) return 'sailing';
  return 'other';
}
const SHIP_COLORS: Record<string, string> = {
  passenger:'#f59e0b', cargo:'#34d399', tanker:'#f97316',
  fishing:'#c084fc', naval:'#f43f5e', sailing:'#38bdf8',
  tug:'#fb923c', other:'#64748b',
};
function flightColor(vr: number) {
  return vr > 2 ? '#38bdf8' : vr < -2 ? '#fb923c' : '#00ff88';
}
function flightStatus(vr: number) {
  return vr > 2 ? 'Climbing' : vr < -2 ? 'Descending' : 'En-Route';
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
let _seq = 0;

function flightSvg(heading: number, vr: number) {
  const c = flightColor(vr);
  const n = ++_seq;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="-19 -19 38 38">
  <defs>
    <radialGradient id="frg${n}" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
    </radialGradient>
    <filter id="fgl${n}" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle r="16" fill="url(#frg${n})"/>
  <g transform="rotate(${heading})" filter="url(#fgl${n})">
    <ellipse cx="0" cy="0" rx="1.7" ry="12" fill="${c}" opacity="0.98"/>
    <path d="M-1.2,-1 L-15,6.5 L-13.5,8.5 L-1.2,4 Z" fill="${c}" opacity="0.88"/>
    <path d="M1.2,-1 L15,6.5 L13.5,8.5 L1.2,4 Z" fill="${c}" opacity="0.88"/>
    <path d="M-1,6.5 L-6,12.5 L-4.5,13.5 L-1,9 Z" fill="${c}" opacity="0.82"/>
    <path d="M1,6.5 L6,12.5 L4.5,13.5 L1,9 Z" fill="${c}" opacity="0.82"/>
    <path d="M-1.2,-1 L-8,3 L-7.5,4.5 L-1.2,3 Z" fill="white" opacity="0.2"/>
    <path d="M1.2,-1 L8,3 L7.5,4.5 L1.2,3 Z" fill="white" opacity="0.2"/>
    <ellipse cx="0" cy="-12.5" rx="1.5" ry="1.8" fill="white" opacity="0.95"/>
    <rect x="-7.8" y="2" width="3.8" height="2" rx="1" fill="${c}" opacity="0.55"/>
    <rect x="4" y="2" width="3.8" height="2" rx="1" fill="${c}" opacity="0.55"/>
  </g>
  <circle r="2" fill="white" opacity="0.9"/>
</svg>`;
}

function shipSvg(heading: number, category: string) {
  const c = SHIP_COLORS[category] ?? SHIP_COLORS.other;
  const n = ++_seq;
  const hulls: Record<string,string> = {
    cargo:    'M0,-14 L5,-9 L6,7 L4,12 L0,14 L-4,12 L-6,7 L-5,-9 Z',
    tanker:   'M0,-15 L4,-11 L5,10 L2.5,13 L0,15 L-2.5,13 L-5,10 L-4,-11 Z',
    passenger:'M0,-12 L7,-7 L8,5 L5,10 L0,12 L-5,10 L-8,5 L-7,-7 Z',
    fishing:  'M0,-9 L4,-5 L4.5,5 L2.5,8 L0,9 L-2.5,8 L-4.5,5 L-4,-5 Z',
    naval:    'M0,-15 L3,-11 L3.5,9 L1.5,13 L0,15 L-1.5,13 L-3.5,9 L-3,-11 Z',
    tug:      'M0,-8 L5.5,-4 L6,4 L3.5,7 L0,8 L-3.5,7 L-6,4 L-5.5,-4 Z',
    sailing:  'M0,-14 L3,-9 L3,9 L0,13 L-3,9 L-3,-9 Z',
    other:    'M0,-10 L4,-6 L5,5 L3,9 L0,10 L-3,9 L-5,5 L-4,-6 Z',
  };
  const structs: Record<string,string> = {
    cargo:    'M-3,-4 L3,-4 L3,3 L-3,3 Z',
    tanker:   'M-2.5,-6 L2.5,-6 L2.5,2 L-2.5,2 Z',
    passenger:'M-5,-4 L5,-4 L5,4 L-5,4 Z',
    fishing:  'M-2,-3 L2,-3 L2,2 L-2,2 Z',
    naval:    'M-1.5,-6 L1.5,-6 L1.5,4 L-1.5,4 Z',
    tug:      'M-2.5,-2 L2.5,-2 L2.5,2.5 L-2.5,2.5 Z',
    sailing:  'M-0.5,-10 L0.5,-10 L0.5,8 L-0.5,8 Z',
    other:    'M-2,-3 L2,-3 L2,2.5 L-2,2.5 Z',
  };
  const hull   = hulls[category]   ?? hulls.other;
  const struct = structs[category] ?? structs.other;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="-20 -20 40 40">
  <defs>
    <radialGradient id="srg${n}" cx="50%" cy="35%" r="60%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="shg${n}" x1="0%" y1="0%" x2="30%" y2="100%">
      <stop offset="0%" stop-color="white" stop-opacity="0.3"/>
      <stop offset="55%" stop-color="${c}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${c}" stop-opacity="0.55"/>
    </linearGradient>
    <filter id="sgl${n}" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="2.8" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <ellipse rx="17" ry="17" fill="url(#srg${n})"/>
  <g transform="rotate(${(heading||0)+180})" opacity="0.28">
    <path d="M-3,13 Q-7,18 -5,20" stroke="${c}" stroke-width="1.2" fill="none"/>
    <path d="M3,13 Q7,18 5,20" stroke="${c}" stroke-width="1.2" fill="none"/>
    <path d="M0,14 L0,21" stroke="${c}" stroke-width="0.8" fill="none"/>
  </g>
  <g transform="rotate(${heading||0})" filter="url(#sgl${n})">
    <path d="${hull}" fill="url(#shg${n})" stroke="${c}" stroke-width="0.9" opacity="0.97"/>
    <path d="${struct}" fill="${c}" opacity="0.5"/>
    <circle cy="-14" r="1.8" fill="white" opacity="0.92"/>
    <circle cy="12" r="1" fill="${c}" opacity="0.55"/>
  </g>
  <circle r="2" fill="white" opacity="0.88"/>
</svg>`;
}

// ── Leaflet hook ──────────────────────────────────────────────────────────────
const INIT_ATTR = 'data-tt-leaflet';

function useLeaflet(
  containerRef: React.RefObject<HTMLDivElement>,
  activeTab: 'flights' | 'ships',
  flights: LiveFlight[],
  ships: LiveShip[],
  onFlightClick: (f: LiveFlight) => void,
  onShipClick:   (s: LiveShip)   => void,
) {
  const mapRef      = useRef<any>(null);
  const flightLayer = useRef<any>(null);
  const shipLayer   = useRef<any>(null);
  const LRef        = useRef<any>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || el.getAttribute(INIT_ATTR) === '1') return;
    let dead = false;
    if (!document.getElementById('tt-leaflet-css')) {
      const lnk = document.createElement('link');
      lnk.id = 'tt-leaflet-css'; lnk.rel = 'stylesheet';
      lnk.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(lnk);
    }
    import('leaflet').then(mod => {
      if (dead || !el.isConnected || el.getAttribute(INIT_ATTR) === '1') return;
      const L = mod.default ?? mod;
      LRef.current = L;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      const map = L.map(el, { center:[30,10], zoom:3, minZoom:2, maxZoom:16, zoomControl:false, preferCanvas:false });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:'&copy; OpenStreetMap &copy; CARTO', subdomains:'abcd', maxZoom:19,
      }).addTo(map);
      L.control.zoom({ position:'bottomright' }).addTo(map);
      mapRef.current      = map;
      flightLayer.current = L.layerGroup().addTo(map);
      shipLayer.current   = L.layerGroup().addTo(map);
      el.setAttribute(INIT_ATTR, '1');
    });
    return () => {
      dead = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = flightLayer.current = shipLayer.current = LRef.current = null; }
      el.removeAttribute(INIT_ATTR);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const LL = LRef.current;
    if (!LL || !flightLayer.current) return;
    flightLayer.current.clearLayers();
    if (activeTab !== 'flights') return;
    for (const f of flights) {
      const c = flightColor(f.vertical_rate);
      LL.marker([f.lat, f.lng], {
        icon: LL.divIcon({ html: flightSvg(f.heading, f.vertical_rate), className:'', iconSize:[38,38], iconAnchor:[19,19] }),
        zIndexOffset: 1000,
      })
        .bindTooltip(`<div class="tt-tip">
          <div class="tt-tip-name" style="color:${c}">✈ ${f.callsign||f.icao24}</div>
          <div class="tt-tip-sub">${f.origin_country}</div>
          <div class="tt-tip-row"><span>Altitude</span><span>${Math.round(f.altitude).toLocaleString()} m</span></div>
          <div class="tt-tip-row"><span>Speed</span><span>${Math.round(f.velocity*1.944)} kts</span></div>
          <div class="tt-tip-row"><span>Heading</span><span>${Math.round(f.heading)}°</span></div>
          <div class="tt-tip-status" style="color:${c}">${flightStatus(f.vertical_rate).toUpperCase()}</div>
        </div>`, { permanent:false, className:'tt-leaflet-tip', sticky:true })
        .on('click', () => onFlightClick(f))
        .addTo(flightLayer.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flights, activeTab]);

  useEffect(() => {
    const LL = LRef.current;
    if (!LL || !shipLayer.current) return;
    shipLayer.current.clearLayers();
    if (activeTab !== 'ships') return;
    for (const s of ships) {
      if (!s.lat || !s.lng) continue;
      const cat = shipCategory(s.type);
      const c   = SHIP_COLORS[cat] ?? SHIP_COLORS.other;
      LL.marker([s.lat, s.lng], {
        icon: LL.divIcon({ html: shipSvg(s.course||s.heading, cat), className:'', iconSize:[40,40], iconAnchor:[20,20] }),
        zIndexOffset: 500,
      })
        .bindTooltip(`<div class="tt-tip">
          <div class="tt-tip-name" style="color:${c}">⚓ ${s.name||s.mmsi}</div>
          <div class="tt-tip-sub">${s.flag} · ${cat}</div>
          <div class="tt-tip-row"><span>Speed</span><span>${s.speed?.toFixed(1)} kts</span></div>
          <div class="tt-tip-row"><span>Status</span><span>${NAV_STATUS[s.status]??'Unknown'}</span></div>
          ${s.destination?`<div class="tt-tip-row"><span>Dest</span><span style="color:#38bdf8">→ ${s.destination}</span></div>`:''}
        </div>`, { permanent:false, className:'tt-leaflet-tip', sticky:true })
        .on('click', () => onShipClick(s))
        .addTo(shipLayer.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ships, activeTab]);
}

// ── Sub-components ────────────────────────────────────────────────────────────
function DetailPanel({ item, onClose }: { item: LiveFlight|LiveShip; onClose:()=>void }) {
  const isFlight = 'icao24' in item;
  if (isFlight) {
    const f = item as LiveFlight;
    const c = flightColor(f.vertical_rate);
    return (
      <div data-tt="detail" style={{ borderTop:`2px solid ${c}` }}>
        <div data-tt="detail-hdr">
          <div>
            <div data-tt="detail-title" style={{ color:c }}>✈ {f.callsign||f.icao24}</div>
            <div data-tt="detail-sub">{f.origin_country} · ICAO {f.icao24.toUpperCase()}</div>
          </div>
          <button data-tt="close-btn" onClick={onClose}>✕</button>
        </div>
        <div data-tt="detail-pill" style={{ background:`${c}18`, border:`1px solid ${c}40`, color:c }}>
          {flightStatus(f.vertical_rate).toUpperCase()}
        </div>
        {([
          ['Altitude', `${Math.round(f.altitude).toLocaleString()} m / ${Math.round(f.altitude*3.281).toLocaleString()} ft`],
          ['Speed',    `${Math.round(f.velocity*1.944)} kts`],
          ['Heading',  `${Math.round(f.heading)}°`],
          ['Vrt Rate', `${f.vertical_rate>0?'+':''}${Math.round(f.vertical_rate)} m/s`],
          ['Squawk',   f.squawk||'—'],
          ['Position', `${f.lat.toFixed(4)}°, ${f.lng.toFixed(4)}°`],
        ] as [string,string][]).map(([k,v]) => (
          <div data-tt="detail-row" key={k}>
            <span data-tt="dk">{k}</span><span data-tt="dv">{v}</span>
          </div>
        ))}
      </div>
    );
  }
  const s = item as LiveShip;
  const cat = shipCategory(s.type);
  const c   = SHIP_COLORS[cat]??SHIP_COLORS.other;
  return (
    <div data-tt="detail" style={{ borderTop:`2px solid ${c}` }}>
      <div data-tt="detail-hdr">
        <div>
          <div data-tt="detail-title" style={{ color:c }}>⚓ {s.name||'Unknown Vessel'}</div>
          <div data-tt="detail-sub">MMSI {s.mmsi}{s.imo?` · IMO ${s.imo}`:''}</div>
        </div>
        <button data-tt="close-btn" onClick={onClose}>✕</button>
      </div>
      <div data-tt="detail-pill" style={{ background:`${c}18`, border:`1px solid ${c}40`, color:c }}>
        {cat.toUpperCase()} · {s.flag}
      </div>
      {([
        ['Speed',       `${s.speed?.toFixed(1)} kts`],
        ['Course',      `${Math.round(s.course||s.heading)}°`],
        ['Status',      NAV_STATUS[s.status]??'Unknown'],
        ['Destination', s.destination||'—'],
        ['Dimensions',  s.length?`${s.length}m × ${s.width}m`:'—'],
        ['Draught',     s.draught?`${s.draught}m`:'—'],
        ['Position',    `${s.lat.toFixed(4)}°, ${s.lng.toFixed(4)}°`],
      ] as [string,string][]).map(([k,v]) => (
        <div data-tt="detail-row" key={k}>
          <span data-tt="dk">{k}</span><span data-tt="dv">{v}</span>
        </div>
      ))}
    </div>
  );
}

function FlightRow({ f, selected, onClick }: { f:LiveFlight; selected:boolean; onClick:()=>void }) {
  const c = flightColor(f.vertical_rate);
  return (
    <div data-tt={selected?'row-sel':'row'} onClick={onClick}>
      <div data-tt="row-top">
        <span data-tt="row-name">{f.callsign||f.icao24}</span>
        <span data-tt="badge" style={{ background:`${c}15`, border:`1px solid ${c}40`, color:c }}>{flightStatus(f.vertical_rate)}</span>
      </div>
      <div data-tt="row-sub">{f.origin_country} · {Math.round(f.altitude).toLocaleString()} m · {Math.round(f.velocity*1.944)} kts</div>
    </div>
  );
}

function ShipRow({ s, selected, onClick }: { s:LiveShip; selected:boolean; onClick:()=>void }) {
  const cat = shipCategory(s.type);
  const c   = SHIP_COLORS[cat]??SHIP_COLORS.other;
  return (
    <div data-tt={selected?'row-sel':'row'} onClick={onClick}>
      <div data-tt="row-top">
        <span data-tt="row-name">{s.name||s.mmsi}</span>
        <span data-tt="badge" style={{ background:`${c}15`, border:`1px solid ${c}40`, color:c, flexShrink:0 }}>{cat}</span>
      </div>
      <div data-tt="row-sub">{s.flag} · {NAV_STATUS[s.status]??'—'} · {s.speed?.toFixed(1)} kts{s.destination?` · → ${s.destination}`:''}</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function TransportTab() {
  const mapRef = useRef<HTMLDivElement>(null as unknown as HTMLDivElement);
  const [flights,       setFlights]       = useState<LiveFlight[]>([]);
  const [ships,         setShips]         = useState<LiveShip[]>([]);
  const [flightMeta,    setFlightMeta]    = useState<{total_airborne:number;count:number;source?:string}|null>(null);
  const [shipMeta,      setShipMeta]      = useState<{total_vessels:number;count:number}|null>(null);
  const [flightLoading, setFlightLoading] = useState(true);
  const [shipLoading,   setShipLoading]   = useState(true);
  const [flightError,   setFlightError]   = useState<string|null>(null);
  const [shipError,     setShipError]     = useState<string|null>(null);
  const [lastFlight,    setLastFlight]    = useState<Date|null>(null);
  const [lastShip,      setLastShip]      = useState<Date|null>(null);
  const [activeTab,     setActiveTab]     = useState<'flights'|'ships'>('flights');
  const [selected,      setSelected]      = useState<LiveFlight|LiveShip|null>(null);
  const [filter,        setFilter]        = useState('');

  const fetchFlights = useCallback(async () => {
    try {
      const res  = await fetch('/api/transport/flights');
      const json = await res.json() as FlightApiResponse;
      if (json.success) { setFlights(json.flights??[]); setFlightMeta({total_airborne:json.total_airborne,count:json.count,source:json.source}); setFlightError(null); setLastFlight(new Date()); }
      else setFlightError(json.error??'Unavailable');
    } catch(e) { setFlightError((e as Error).message); }
    finally { setFlightLoading(false); }
  }, []);

  const fetchShips = useCallback(async () => {
    setShipLoading(true);
    try {
      const res = await fetch('/api/transport/ships');
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const json = await res.json();
      if (json.success) {
        const list = Array.isArray(json.ships)?json.ships:[];
        setShips(list); setShipMeta({total_vessels:json.total_vessels??list.length,count:json.count??list.length}); setShipError(null); setLastShip(new Date());
      } else setShipError(json.error??'Unavailable');
    } catch(e) { setShipError((e as Error).message); }
    finally { setShipLoading(false); }
  }, []);

  useEffect(() => {
    fetchFlights(); fetchShips();
    const ft = setInterval(fetchFlights, 15_000);
    const st = setInterval(fetchShips,   60_000);
    return () => { clearInterval(ft); clearInterval(st); };
  }, [fetchFlights, fetchShips]);

  const onFlightClick = useCallback((f:LiveFlight) => setSelected(f), []);
  const onShipClick   = useCallback((s:LiveShip)   => setSelected(s), []);
  useLeaflet(mapRef, activeTab, flights, ships, onFlightClick, onShipClick);

  const q = filter.toLowerCase();
  const filteredFlights = useMemo(() => q?flights.filter(f=>f.callsign.toLowerCase().includes(q)||f.origin_country.toLowerCase().includes(q)):flights,[flights,q]);
  const filteredShips   = useMemo(() => q?ships.filter(s=>(s.name??'').toLowerCase().includes(q)||s.mmsi.includes(q)||(s.flag??'').toLowerCase().includes(q)):ships,[ships,q]);
  const isF = activeTab==='flights';

  return (
    <>
      {/* ── All CSS scoped under [data-tt="root"] — nothing leaks out ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

        /* SCOPE: every rule is prefixed with [data-tt="root"] */

        [data-tt="root"] {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #05080f;
          color: #e2e8f0;
          font-family: 'Syne', sans-serif;
          overflow: hidden;
          box-sizing: border-box;
        }
        [data-tt="root"] *, [data-tt="root"] *::before, [data-tt="root"] *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* ─── Topbar ───────────────────────────────── */
        [data-tt="topbar"] {
          display: flex;
          align-items: center;
          height: 60px;
          flex-shrink: 0;
          background: rgba(5,8,15,0.98);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          position: relative;
          overflow: hidden;
        }
        [data-tt="topbar"]::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,212,255,0.35), transparent);
        }

        [data-tt="brand"] {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 22px;
          border-right: 1px solid rgba(255,255,255,0.06);
          height: 100%;
          flex-shrink: 0;
        }
        [data-tt="brand-icon"] {
          font-size: 21px;
          filter: drop-shadow(0 0 8px rgba(0,212,255,0.55));
        }
        [data-tt="brand-txt"] {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 3.5px;
          color: #00d4ff;
          line-height: 1.45;
        }

        /* ─── Tabs ─────────────────────────────────── */
        [data-tt="tabs"] {
          display: flex;
          align-items: stretch;
          height: 100%;
          padding: 0 6px;
        }
        [data-tt="tab-f"], [data-tt="tab-s"],
        [data-tt="tab-f-on"], [data-tt="tab-s-on"] {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 26px;
          border: none;
          background: transparent;
          cursor: pointer;
          position: relative;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.3px;
          transition: color 0.2s;
          color: #2a3d50;
        }
        [data-tt="tab-f"]::after, [data-tt="tab-s"]::after,
        [data-tt="tab-f-on"]::after, [data-tt="tab-s-on"]::after {
          content: '';
          position: absolute;
          bottom: 0;
          height: 2px;
          border-radius: 2px 2px 0 0;
          transition: all 0.28s cubic-bezier(.4,0,.2,1);
          left: 50%; right: 50%;
        }
        [data-tt="tab-f-on"] { color: #00d4ff; }
        [data-tt="tab-f-on"]::after { left:16px; right:16px; background: linear-gradient(90deg,transparent,#00d4ff,transparent); }
        [data-tt="tab-s-on"] { color: #34d399; }
        [data-tt="tab-s-on"]::after { left:16px; right:16px; background: linear-gradient(90deg,transparent,#34d399,transparent); }

        [data-tt="tab-ico"] {
          width: 30px; height: 30px;
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px;
          transition: all 0.22s;
          background: rgba(255,255,255,0.04);
        }
        [data-tt="tab-f-on"] [data-tt="tab-ico"] { background:rgba(0,212,255,0.14); box-shadow:0 0 14px rgba(0,212,255,0.18); }
        [data-tt="tab-s-on"] [data-tt="tab-ico"] { background:rgba(52,211,153,0.14); box-shadow:0 0 14px rgba(52,211,153,0.18); }

        [data-tt="tab-cnt"] {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px; font-weight: 700;
          padding: 2px 8px; border-radius: 20px;
          background: rgba(255,255,255,0.05);
          color: #2a3d50;
        }
        [data-tt="tab-f-on"] [data-tt="tab-cnt"] { background:rgba(0,212,255,0.14); color:#00d4ff; }
        [data-tt="tab-s-on"] [data-tt="tab-cnt"] { background:rgba(52,211,153,0.14); color:#34d399; }

        /* ─── Right cluster ────────────────────────── */
        [data-tt="tb-right"] {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-left: auto;
          padding-right: 22px;
        }
        [data-tt="statc"] {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          padding: 5px 12px;
          border: 1px solid;
          border-radius: 9px;
          background: rgba(255,255,255,0.02);
          position: relative;
          overflow: hidden;
        }
        [data-tt="statv"] {
          font-family: 'JetBrains Mono', monospace;
          font-size: 17px; font-weight: 700; line-height: 1.1;
        }
        [data-tt="statl"] {
          font-size: 9px; color: #2a3d50;
          letter-spacing: 1.5px; text-transform: uppercase; margin-top: 1px;
        }
        [data-tt="statd"] {
          position: absolute; top: 7px; left: 8px;
          width: 5px; height: 5px; border-radius: 50%;
          animation: tt-pulse 2s infinite;
        }
        @keyframes tt-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.35;transform:scale(0.8)} }

        [data-tt="srow"] {
          display: flex; align-items: center; gap: 5px;
          font-family: 'JetBrains Mono', monospace; font-size: 9px;
        }
        [data-tt="sdot"] {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
        }
        [data-tt="sdot-ok"]  { background:#00ff88; box-shadow:0 0 5px #00ff88; animation:tt-pulse 2s infinite; }
        [data-tt="sdot-err"] { background:#ef4444; box-shadow:0 0 5px #ef4444; }
        [data-tt="tok"]  { color: #00ff88; }
        [data-tt="terr"] { color: #ef4444; }
        [data-tt="tdim"] { color: #1e3048; }

        [data-tt="lupd"] {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px; color: #1e3048;
          text-align: right; line-height: 1.75;
        }

        /* ─── Body ─────────────────────────────────── */
        [data-tt="body"] { display:flex; flex:1; overflow:hidden; }
        [data-tt="map-wrap"] { flex:1; position:relative; }
        [data-tt="map"] { width:100%; height:100%; }

        /* ─── Spinner ──────────────────────────────── */
        [data-tt="spin-wrap"] {
          position:absolute; inset:0; z-index:1000;
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          background:rgba(5,8,15,0.96);
        }
        [data-tt="spinner"] {
          width:48px; height:48px; border-radius:50%;
          border:2px solid rgba(0,212,255,0.1); border-top-color:#00d4ff;
          animation:tt-spin 1s linear infinite; margin-bottom:18px;
        }
        @keyframes tt-spin { to{transform:rotate(360deg)} }
        [data-tt="spin-lbl"] {
          font-family:'JetBrains Mono',monospace; font-size:11px;
          letter-spacing:4px; color:#00d4ff;
        }
        [data-tt="spin-sub"] {
          font-size:10px; color:#1e3048; margin-top:6px;
          font-family:'JetBrains Mono',monospace;
        }

        /* ─── Legend ───────────────────────────────── */
        [data-tt="legend"] {
          position:absolute; bottom:44px; left:16px; z-index:500;
          background:rgba(5,8,15,0.94); border:1px solid rgba(255,255,255,0.08);
          border-radius:12px; padding:14px 18px; backdrop-filter:blur(16px);
          min-width:155px;
        }
        [data-tt="leg-title"] {
          font-family:'JetBrains Mono',monospace; font-size:8px;
          color:#2a3d50; letter-spacing:2px; text-transform:uppercase; margin-bottom:10px;
        }
        [data-tt="leg-item"] { display:flex; align-items:center; gap:9px; margin-bottom:6px; }
        [data-tt="leg-dot"]  { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
        [data-tt="leg-bar"]  { width:20px; height:4px; border-radius:3px; flex-shrink:0; }
        [data-tt="leg-lbl"]  { font-size:10px; color:#475569; text-transform:capitalize; }

        /* ─── Sidebar ──────────────────────────────── */
        [data-tt="sidebar"] {
          width:290px; flex-shrink:0;
          display:flex; flex-direction:column; overflow:hidden;
          background:#060b14;
          border-left:1px solid rgba(255,255,255,0.05);
        }

        /* ─── Detail panel ─────────────────────────── */
        [data-tt="detail"] {
          padding:15px 17px; flex-shrink:0;
          background:rgba(0,0,0,0.28);
          border-bottom:1px solid rgba(255,255,255,0.06);
          animation:tt-sd .2s ease;
        }
        @keyframes tt-sd { from{opacity:0;transform:translateY(-7px)} to{opacity:1;transform:translateY(0)} }
        [data-tt="detail-hdr"] { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; }
        [data-tt="detail-title"] { font-size:13px; font-weight:800; letter-spacing:0.2px; }
        [data-tt="detail-sub"]   { font-family:'JetBrains Mono',monospace; font-size:9px; color:#2a3d50; margin-top:3px; }
        [data-tt="detail-pill"]  {
          display:inline-block; font-family:'JetBrains Mono',monospace;
          font-size:9px; font-weight:700; letter-spacing:1.5px;
          padding:3px 10px; border-radius:20px; margin-bottom:10px;
        }
        [data-tt="detail-row"] {
          display:flex; justify-content:space-between;
          font-size:10px; line-height:2;
          border-bottom:1px solid rgba(255,255,255,0.03);
        }
        [data-tt="dk"] { font-family:'JetBrains Mono',monospace; font-size:9px; color:#2a3d50; letter-spacing:0.5px; text-transform:uppercase; }
        [data-tt="dv"] { color:#94a3b8; font-size:10px; }
        [data-tt="close-btn"] {
          background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);
          color:#2a3d50; border-radius:6px; padding:4px 10px;
          cursor:pointer; font-size:10px; font-family:'Syne',sans-serif;
          transition:all .15s; flex-shrink:0;
        }
        [data-tt="close-btn"]:hover { background:rgba(239,68,68,0.12); color:#ef4444; border-color:rgba(239,68,68,0.3); }

        /* ─── Search ───────────────────────────────── */
        [data-tt="search-wrap"] { padding:11px 14px; border-bottom:1px solid rgba(255,255,255,0.05); flex-shrink:0; }
        [data-tt="search-inp"] {
          width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);
          border-radius:8px; color:#94a3b8; font-size:11px; padding:8px 12px;
          font-family:'Syne',sans-serif; outline:none; transition:border-color .2s;
        }
        [data-tt="search-inp"]:focus { border-color:rgba(0,212,255,0.3); }
        [data-tt="search-inp"]::placeholder { color:#1e3048; }

        /* ─── List header ──────────────────────────── */
        [data-tt="list-hdr"] {
          padding:7px 16px 5px;
          font-family:'JetBrains Mono',monospace; font-size:8px; letter-spacing:2.5px; text-transform:uppercase;
          border-bottom:1px solid rgba(255,255,255,0.04);
          position:sticky; top:0; z-index:2; background:rgba(6,11,20,0.98);
          display:flex; justify-content:space-between; align-items:center;
        }
        [data-tt="list-cnt"] { color:#1e3048; font-size:9px; }
        [data-tt="list-scroll"] { flex:1; overflow-y:auto; }
        [data-tt="list-scroll"]::-webkit-scrollbar { width:2px; }
        [data-tt="list-scroll"]::-webkit-scrollbar-thumb { background:rgba(0,212,255,0.1); border-radius:2px; }

        /* ─── Rows ─────────────────────────────────── */
        [data-tt="row"], [data-tt="row-sel"] {
          padding:7px 16px;
          border-bottom:1px solid rgba(255,255,255,0.03);
          cursor:pointer; transition:background .12s;
        }
        [data-tt="row"]:hover    { background:rgba(255,255,255,0.03); }
        [data-tt="row-sel"] { background:rgba(0,212,255,0.05); border-left:2px solid rgba(0,212,255,0.35); padding-left:14px; }
        [data-tt="row-top"] { display:flex; justify-content:space-between; align-items:center; gap:8px; }
        [data-tt="row-name"] { font-size:11px; font-weight:700; color:#cbd5e1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        [data-tt="row-sub"]  { font-size:9px; color:#1e3048; margin-top:2px; font-family:'JetBrains Mono',monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        [data-tt="badge"] {
          font-size:8px; padding:2px 7px; border-radius:12px;
          font-family:'JetBrains Mono',monospace; font-weight:700;
          letter-spacing:0.4px; white-space:nowrap;
        }

        [data-tt="error"] { padding:14px 16px; color:#7f1d1d; font-size:10px; font-family:'JetBrains Mono',monospace; }
        [data-tt="empty"] { padding:24px 16px; color:#1e3048; font-size:10px; text-align:center; font-family:'JetBrains Mono',monospace; line-height:1.85; }

        /* ─── Leaflet overrides (scoped via IDs/classes Leaflet adds) ── */
        /* These must target leaflet's own classes — they can't be under our scope attr,
           but they're specific enough not to conflict: */
        .tt-leaflet-tip                { background:transparent!important; border:none!important; box-shadow:none!important; }
        .tt-leaflet-tip::before        { display:none!important; }
        .tt-map-el .leaflet-container  { background:#05080f!important; }
        .tt-map-el .leaflet-control-attribution { background:rgba(5,8,15,0.85)!important; color:#1e3048!important; font-size:8px!important; border-radius:4px!important; }
        .tt-map-el .leaflet-control-zoom a      { background:rgba(7,12,21,0.95)!important; color:#475569!important; border-color:rgba(255,255,255,0.08)!important; }
        .tt-map-el .leaflet-control-zoom a:hover{ background:rgba(0,212,255,0.12)!important; color:#00d4ff!important; }

        /* ─── Tooltip popup (rendered outside root by Leaflet) ────────── */
        .tt-tip {
          background:rgba(7,12,21,0.97); border:1px solid rgba(255,255,255,0.09);
          border-radius:10px; padding:10px 14px; min-width:158px;
          backdrop-filter:blur(14px); font-family:'Syne',sans-serif;
          box-shadow:0 8px 32px rgba(0,0,0,0.65);
        }
        .tt-tip-name   { font-size:12px; font-weight:800; margin-bottom:4px; }
        .tt-tip-sub    { font-size:9px; color:#475569; margin-bottom:8px; font-family:'JetBrains Mono',monospace; }
        .tt-tip-row    { display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; line-height:1.9; gap:24px; }
        .tt-tip-row span:first-child { color:#2a3d50; }
        .tt-tip-status { font-size:9px; margin-top:7px; font-family:'JetBrains Mono',monospace; letter-spacing:1.5px; text-transform:uppercase; font-weight:700; }
      `}</style>

      <div data-tt="root">
        {/* ── Topbar ──────────────────────────────────────────── */}
        <div data-tt="topbar">
          <div data-tt="brand">
            <span data-tt="brand-icon">🛰</span>
            <div data-tt="brand-txt">TRANSPORT<br/>INTEL</div>
          </div>

          <div data-tt="tabs">
            <button data-tt={isF?'tab-f-on':'tab-f'} onClick={() => { setActiveTab('flights'); setSelected(null); setFilter(''); }}>
              <div data-tt="tab-ico">✈</div>
              <span>Flights</span>
              <span data-tt="tab-cnt">{flightMeta ? flightMeta.total_airborne.toLocaleString() : '…'}</span>
            </button>
            <button data-tt={!isF?'tab-s-on':'tab-s'} onClick={() => { setActiveTab('ships'); setSelected(null); setFilter(''); }}>
              <div data-tt="tab-ico">⚓</div>
              <span>Marine</span>
              <span data-tt="tab-cnt">{shipMeta ? shipMeta.total_vessels.toLocaleString() : '…'}</span>
            </button>
          </div>

          <div data-tt="tb-right">
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <div data-tt="srow">
                <div data-tt={flightError?'sdot-err':'sdot-ok'}/>
                <span data-tt={flightError?'terr':'tok'}>OPENSKY {flightError?'OFFLINE':'LIVE'}</span>
              </div>
              <div data-tt="srow">
                <div data-tt={shipError?'sdot-err':'sdot-ok'}/>
                <span data-tt={shipError?'terr':'tok'}>AIS {shipError?'OFFLINE':'LIVE'}</span>
              </div>
            </div>

            <div data-tt="statc" style={{ borderColor:'rgba(0,212,255,0.2)' }}>
              <div data-tt="statd" style={{ background:'#00d4ff', boxShadow:'0 0 6px #00d4ff' }}/>
              <div data-tt="statv" style={{ color:'#00d4ff' }}>{flightMeta ? flightMeta.total_airborne.toLocaleString() : '—'}</div>
              <div data-tt="statl">Airborne</div>
            </div>
            <div data-tt="statc" style={{ borderColor:'rgba(52,211,153,0.2)' }}>
              <div data-tt="statd" style={{ background:'#34d399', boxShadow:'0 0 6px #34d399' }}/>
              <div data-tt="statv" style={{ color:'#34d399' }}>{shipMeta ? shipMeta.total_vessels.toLocaleString() : '—'}</div>
              <div data-tt="statl">Vessels</div>
            </div>

            <div data-tt="lupd">
              {lastFlight && <div>✈ {lastFlight.toLocaleTimeString()}</div>}
              {lastShip   && <div>⚓ {lastShip.toLocaleTimeString()}</div>}
              <div data-tt="tdim" style={{ marginTop:1, fontSize:8 }}>15s · 60s</div>
            </div>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────── */}
        <div data-tt="body">
          <div data-tt="map-wrap">
            {(flightLoading && shipLoading) && (
              <div data-tt="spin-wrap">
                <div data-tt="spinner"/>
                <div data-tt="spin-lbl">CONNECTING…</div>
                <div data-tt="spin-sub">OpenSky · aisstream.io · CartoDB</div>
              </div>
            )}
            {/* tt-map-el class lets us scope leaflet overrides */}
            <div ref={mapRef} data-tt="map" className="tt-map-el"/>

            <div data-tt="legend">
              {isF ? (<>
                <div data-tt="leg-title">Flight Status</div>
                {[['En-Route','#00ff88'],['Climbing','#38bdf8'],['Descending','#fb923c']].map(([s,c]) => (
                  <div data-tt="leg-item" key={s}>
                    <div data-tt="leg-dot" style={{ background:c, boxShadow:`0 0 6px ${c}70` }}/>
                    <span data-tt="leg-lbl">{s}</span>
                  </div>
                ))}
              </>) : (<>
                <div data-tt="leg-title">Vessel Type</div>
                {Object.entries(SHIP_COLORS).map(([type, color]) => (
                  <div data-tt="leg-item" key={type}>
                    <div data-tt="leg-bar" style={{ background:color }}/>
                    <span data-tt="leg-lbl">{type}</span>
                  </div>
                ))}
              </>)}
            </div>
          </div>

          {/* ── Sidebar ─────────────────────────────────────── */}
          <div data-tt="sidebar">
            {selected && <DetailPanel item={selected} onClose={() => setSelected(null)}/>}

            <div data-tt="search-wrap">
              <input
                data-tt="search-inp"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder={isF ? 'Search callsign, country…' : 'Search name, MMSI, flag…'}
              />
            </div>

            {isF ? (<>
              <div data-tt="list-hdr" style={{ color:'#00d4ff' }}>
                <span>✈ FLIGHTS</span>
                <span data-tt="list-cnt">{filteredFlights.length.toLocaleString()}</span>
              </div>
              <div data-tt="list-scroll">
                {flightError && <div data-tt="error">⚠ {flightError}</div>}
                {!flightError && filteredFlights.length===0 && <div data-tt="empty">{flightLoading?'Connecting to OpenSky…':'No flights found'}</div>}
                {filteredFlights.map(f => (
                  <FlightRow key={f.icao24} f={f}
                    selected={selected!==null&&'icao24' in selected&&(selected as LiveFlight).icao24===f.icao24}
                    onClick={() => setSelected(f)}/>
                ))}
              </div>
            </>) : (<>
              <div data-tt="list-hdr" style={{ color:'#34d399' }}>
                <span>⚓ VESSELS</span>
                <span data-tt="list-cnt">{filteredShips.length.toLocaleString()}</span>
              </div>
              <div data-tt="list-scroll">
                {shipError && <div data-tt="error">⚠ {shipError}</div>}
                {shipLoading && ships.length===0 && <div data-tt="empty">Collecting AIS stream…<br/><span style={{fontSize:9,color:'#0f1f30'}}>~12s window</span></div>}
                {!shipLoading && !shipError && filteredShips.length===0 && <div data-tt="empty">No vessels found</div>}
                {filteredShips.map((s,i) => (
                  <ShipRow key={s.mmsi||i} s={s}
                    selected={selected!==null&&'mmsi' in selected&&(selected as LiveShip).mmsi===s.mmsi}
                    onClick={() => setSelected(s)}/>
                ))}
              </div>
            </>)}
          </div>
        </div>
      </div>
    </>
  );
}

export default TransportTab;