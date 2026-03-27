'use client';

/**
 * WarzonesTab — Live conflict map powered by UCDP API
 * No API key. No registration. Completely free.
 * Data: Uppsala Conflict Data Program · ucdp.uu.se
 *
 * All CSS scoped under [data-wz="root"] — zero bleed into parent app.
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ConflictEvent {
  id:         string;
  date:       string;
  type:       string;
  subType:    string;
  actor1:     string;
  actor2:     string;
  country:    string;
  region:     string;
  location:   string;
  lat:        number;
  lng:        number;
  fatalities: number;
  notes:      string;
  source:     string;
  conflict?:  string;
}

interface ApiResponse {
  success:   boolean;
  count:     number;
  total:     number;
  fetchedAt: number;
  source:    string;
  dateRange: { from: string; to: string };
  events:    ConflictEvent[];
  error?:    string;
}

// ── Event config ──────────────────────────────────────────────────────────────
const EV_CFG: Record<string, { color: string; label: string; speed: string }> = {
  'Battles':                    { color: '#ef4444', label: 'Battle',       speed: '1.4s' },
  'Non-State Conflict':         { color: '#f97316', label: 'Non-State',    speed: '1.8s' },
  'Violence against civilians': { color: '#fbbf24', label: 'Civilian',     speed: '2.6s' },
  'Armed Conflict':             { color: '#a78bfa', label: 'Conflict',     speed: '2s'   },
};

function getCfg(type: string) {
  return EV_CFG[type] ?? { color: '#64748b', label: type, speed: '2s' };
}

function fatalRadius(f: number) {
  if (f === 0)   return 8;
  if (f < 5)     return 11;
  if (f < 20)    return 15;
  if (f < 100)   return 20;
  return 26;
}

// ── Animated SVG markers ──────────────────────────────────────────────────────
let _seq = 0;

function battleMarker(r: number, color: string, speed: string) {
  const n = ++_seq, sz = r * 2 + 28, cx = sz / 2;
  const half = parseFloat(speed) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" style="overflow:visible;pointer-events:none">
  <defs>
    <radialGradient id="bg${n}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.9"/>
      <stop offset="70%" stop-color="${color}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>
    <filter id="gf${n}"><feGaussianBlur stdDeviation="2.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="1.8" opacity="0">
    <animate attributeName="r"       values="${r*0.4};${r+14}" dur="${speed}" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.9;0"            dur="${speed}" repeatCount="indefinite"/>
  </circle>
  <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="1.1" opacity="0">
    <animate attributeName="r"       values="${r*0.4};${r+14}" dur="${speed}" begin="${half}s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.55;0"           dur="${speed}" begin="${half}s" repeatCount="indefinite"/>
  </circle>
  <circle cx="${cx}" cy="${cx}" r="${r}" fill="url(#bg${n})" filter="url(#gf${n})"/>
  <line x1="${cx-r*.65}" y1="${cx}" x2="${cx+r*.65}" y2="${cx}" stroke="${color}" stroke-width="1.1" opacity="0.55"/>
  <line x1="${cx}" y1="${cx-r*.65}" x2="${cx}" y2="${cx+r*.65}" stroke="${color}" stroke-width="1.1" opacity="0.55"/>
  <circle cx="${cx}" cy="${cx}" r="3.2" fill="${color}"/>
  <circle cx="${cx}" cy="${cx}" r="1.5" fill="white" opacity="0.9"/>
</svg>`;
}

function nonStateMarker(r: number, color: string, speed: string) {
  const n = ++_seq, sz = r * 2 + 24, cx = sz / 2;
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45 * Math.PI) / 180;
    const x1 = cx + Math.cos(a) * r * 0.35, y1 = cx + Math.sin(a) * r * 0.35;
    const x2 = cx + Math.cos(a) * r * 1.05, y2 = cx + Math.sin(a) * r * 1.05;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="1.3" stroke-linecap="round">
      <animate attributeName="opacity" values="0.15;0.85;0.15" dur="${speed}" begin="${(i*0.08).toFixed(2)}s" repeatCount="indefinite"/>
    </line>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" style="overflow:visible;pointer-events:none">
  <defs>
    <radialGradient id="eg${n}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>
    <filter id="ef${n}"><feGaussianBlur stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle cx="${cx}" cy="${cx}" r="${r*1.3}" fill="${color}" opacity="0" filter="url(#ef${n})">
    <animate attributeName="opacity" values="0;0.3;0" dur="${speed}" repeatCount="indefinite"/>
    <animate attributeName="r" values="${r*.7};${r*1.5};${r*.7}" dur="${speed}" repeatCount="indefinite"/>
  </circle>
  <circle cx="${cx}" cy="${cx}" r="${r}" fill="url(#eg${n})" filter="url(#ef${n})"/>
  ${rays}
  <circle cx="${cx}" cy="${cx}" r="2.8" fill="${color}"/>
  <circle cx="${cx}" cy="${cx}" r="1.3" fill="white" opacity="0.9"/>
</svg>`;
}

function civilianMarker(r: number, color: string, speed: string) {
  const n = ++_seq, sz = r * 2 + 20, cx = sz / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" style="overflow:visible;pointer-events:none">
  <defs>
    <radialGradient id="cg${n}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>
    <filter id="cf${n}"><feGaussianBlur stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0">
    <animate attributeName="r"       values="${r};${r+11}" dur="${speed}" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.7;0"        dur="${speed}" repeatCount="indefinite"/>
  </circle>
  <circle cx="${cx}" cy="${cx}" r="${r}" fill="url(#cg${n})" filter="url(#cf${n})">
    <animate attributeName="opacity" values="0.55;1;0.55" dur="${speed}" repeatCount="indefinite"/>
  </circle>
  <circle cx="${cx}" cy="${cx}" r="2.5" fill="${color}"/>
  <circle cx="${cx}" cy="${cx}" r="1.2" fill="white" opacity="0.85"/>
</svg>`;
}

function genericMarker(r: number, color: string, speed: string) {
  const n = ++_seq, sz = r * 2 + 16, cx = sz / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" style="overflow:visible;pointer-events:none">
  <defs>
    <filter id="sf${n}"><feGaussianBlur stdDeviation="1.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.3"/>
  <circle cx="${cx}" cy="${cx}" r="${r*.55}" fill="none" stroke="${color}" stroke-width="0.6" opacity="0.2"/>
  <g transform-origin="${cx} ${cx}">
    <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cx}" to="360 ${cx} ${cx}" dur="${speed}" repeatCount="indefinite"/>
    <line x1="${cx}" y1="${cx}" x2="${cx}" y2="${cx-r}" stroke="${color}" stroke-width="1.2" opacity="0.7" stroke-linecap="round"/>
  </g>
  <circle cx="${cx}" cy="${cx}" r="2.5" fill="${color}" filter="url(#sf${n})" opacity="0.85"/>
</svg>`;
}

function makeMarker(evt: ConflictEvent): { html: string; size: number } {
  const { color, speed } = getCfg(evt.type);
  const r = fatalRadius(evt.fatalities);
  const sz = r * 2 + 28;
  let html: string;
  switch (evt.type) {
    case 'Battles':                    html = battleMarker(r, color, speed);    break;
    case 'Non-State Conflict':         html = nonStateMarker(r, color, speed);  break;
    case 'Violence against civilians': html = civilianMarker(r, color, speed);  break;
    default:                           html = genericMarker(r, color, speed);
  }
  return { html, size: sz };
}

// ── Leaflet hook ──────────────────────────────────────────────────────────────
const INIT_ATTR = 'data-wz-init';

function useConflictMap(
  containerRef: React.RefObject<HTMLDivElement>,
  events:       ConflictEvent[],
  typeFilter:   string,
  onSelect:     (e: ConflictEvent) => void,
) {
  const mapRef   = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const LRef     = useRef<any>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || el.getAttribute(INIT_ATTR) === '1') return;
    let dead = false;

    if (!document.getElementById('wz-leaflet-css')) {
      const lnk = document.createElement('link');
      lnk.id = 'wz-leaflet-css'; lnk.rel = 'stylesheet';
      lnk.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(lnk);
    }

    import('leaflet').then(mod => {
      if (dead || !el.isConnected || el.getAttribute(INIT_ATTR) === '1') return;
      const L = mod.default ?? mod;
      LRef.current = L;
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(el, {
        center: [25, 25], zoom: 3, minZoom: 2, maxZoom: 10,
        zoomControl: false, preferCanvas: false,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd', maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      mapRef.current   = map;
      layerRef.current = L.layerGroup().addTo(map);
      el.setAttribute(INIT_ATTR, '1');
    });

    return () => {
      dead = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = layerRef.current = LRef.current = null; }
      el.removeAttribute(INIT_ATTR);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const LL = LRef.current;
    if (!LL || !layerRef.current) return;
    layerRef.current.clearLayers();

    const visible = typeFilter === 'all' ? events : events.filter(e => e.type === typeFilter);

    for (const evt of visible) {
      const cfg = getCfg(evt.type);
      const { html, size } = makeMarker(evt);
      const half = size / 2;

      LL.marker([evt.lat, evt.lng], {
        icon: LL.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [half, half] }),
        zIndexOffset: evt.fatalities * 5,
      })
        .bindTooltip(
          `<div class="wz-tip">
            <div class="wz-tip-title" style="color:${cfg.color}">${cfg.label.toUpperCase()} · ${evt.country}</div>
            ${evt.conflict ? `<div class="wz-tip-conflict">${evt.conflict}</div>` : ''}
            <div class="wz-tip-date">${evt.date}</div>
            ${evt.actor1 ? `<div class="wz-tip-row"><span>Side A</span><span>${evt.actor1}</span></div>` : ''}
            ${evt.actor2 ? `<div class="wz-tip-row"><span>Side B</span><span>${evt.actor2}</span></div>` : ''}
            <div class="wz-tip-row">
              <span>Fatalities</span>
              <span style="color:${evt.fatalities > 0 ? '#ef4444' : '#64748b'};font-weight:700">
                ${evt.fatalities > 0 ? `${evt.fatalities} ✝` : '0'}
              </span>
            </div>
            <div class="wz-tip-sub">${evt.subType}</div>
          </div>`,
          { permanent: false, className: 'wz-leaflet-tip', sticky: true, offset: [16, 0] },
        )
        .on('click', () => onSelect(evt))
        .addTo(layerRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, typeFilter]);
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function EventDetail({ evt, onClose }: { evt: ConflictEvent; onClose: () => void }) {
  const cfg = getCfg(evt.type);
  return (
    <div data-wz="detail" style={{ borderTop: `2px solid ${cfg.color}` }}>
      <div data-wz="detail-hdr">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div data-wz="detail-title" style={{ color: cfg.color }}>
            {evt.conflict || evt.subType || evt.country}
          </div>
          <div data-wz="detail-badge" style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.color}45`, color: cfg.color }}>
            {cfg.label} · {evt.subType}
          </div>
        </div>
        <button data-wz="close-btn" onClick={onClose}>✕</button>
      </div>
      <div data-wz="detail-country">{evt.country}{evt.region ? ` · ${evt.region}` : ''} · {evt.date}</div>
      {([
        ['Side A',     evt.actor1 || '—'],
        ['Side B',     evt.actor2 || '—'],
        ['Fatalities', evt.fatalities > 0 ? `${evt.fatalities} ✝` : '0'],
        ['Country',    evt.country],
        ['Position',   `${evt.lat.toFixed(3)}°, ${evt.lng.toFixed(3)}°`],
        ['Source',     evt.source],
      ] as [string, string][]).map(([k, v]) => (
        <div data-wz="detail-row" key={k}>
          <span data-wz="dk">{k}</span>
          <span data-wz="dv" style={{ color: k === 'Fatalities' && evt.fatalities > 0 ? '#ef4444' : undefined }}>{v}</span>
        </div>
      ))}
      {evt.notes && (
        <div data-wz="detail-notes">
          {evt.notes.length > 300 ? evt.notes.slice(0, 300) + '…' : evt.notes}
        </div>
      )}
    </div>
  );
}

function EventRow({ evt, selected, onClick }: { evt: ConflictEvent; selected: boolean; onClick: () => void }) {
  const cfg = getCfg(evt.type);
  return (
    <div data-wz={selected ? 'row-sel' : 'row'} onClick={onClick}>
      <div data-wz="row-top">
        <div data-wz="row-dot" style={{ background: cfg.color, boxShadow: `0 0 5px ${cfg.color}80` }}/>
        <span data-wz="row-name">{evt.conflict || evt.country}</span>
        {evt.fatalities > 0 && <span data-wz="row-fatal">{evt.fatalities}✝</span>}
      </div>
      <div data-wz="row-meta">{evt.country} · {evt.subType.slice(0, 30)} · {evt.date}</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function WarzonesTab() {
  const mapRef = useRef<HTMLDivElement>(null as unknown as HTMLDivElement);

  const [events,     setEvents]     = useState<ConflictEvent[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [meta,       setMeta]       = useState<ApiResponse | null>(null);
  const [selected,   setSelected]   = useState<ConflictEvent | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [search,     setSearch]     = useState('');
  const [lastUpd,    setLastUpd]    = useState<Date | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res  = await fetch('/api/warzones');
      const json = await res.json() as ApiResponse;
      if (json.success) {
        setEvents(json.events);
        setMeta(json);
        setError(null);
        setLastUpd(new Date());
      } else {
        setError(json.error ?? 'Failed to load conflict data');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const t = setInterval(fetchEvents, 3_600_000); // hourly
    return () => clearInterval(t);
  }, [fetchEvents]);

  const onSelect = useCallback((e: ConflictEvent) => setSelected(e), []);
  useConflictMap(mapRef, events, typeFilter, onSelect);

  const stats = useMemo(() => ({
    battles:   events.filter(e => e.type === 'Battles').length,
    nonState:  events.filter(e => e.type === 'Non-State Conflict').length,
    civilian:  events.filter(e => e.type === 'Violence against civilians').length,
    fatalities: events.reduce((s, e) => s + e.fatalities, 0),
    countries: new Set(events.map(e => e.country)).size,
  }), [events]);

  const q = search.toLowerCase();
  const listEvents = useMemo(() => {
    let evts = typeFilter === 'all' ? events : events.filter(e => e.type === typeFilter);
    if (q) evts = evts.filter(e =>
      (e.conflict ?? '').toLowerCase().includes(q) ||
      e.country.toLowerCase().includes(q) ||
      e.actor1.toLowerCase().includes(q) ||
      e.actor2.toLowerCase().includes(q),
    );
    return [...evts].sort((a, b) => b.fatalities - a.fatalities || b.date.localeCompare(a.date));
  }, [events, typeFilter, q]);

  const FILTERS = [
    { key: 'all',                            label: 'ALL',       color: '#ef4444', count: events.length },
    { key: 'Battles',                        label: 'BATTLES',   color: '#ef4444', count: stats.battles },
    { key: 'Non-State Conflict',             label: 'NON-STATE', color: '#f97316', count: stats.nonState },
    { key: 'Violence against civilians',     label: 'CIVILIAN',  color: '#fbbf24', count: stats.civilian },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Share+Tech+Mono&display=swap');

        [data-wz="root"] {
          display:flex; flex-direction:column; height:100%;
          background:#060809; color:#dde4ed;
          font-family:'Barlow Condensed',sans-serif; overflow:hidden;
        }
        [data-wz="root"] *,[data-wz="root"] *::before,[data-wz="root"] *::after {
          box-sizing:border-box; margin:0; padding:0;
        }

        /* ── Topbar ─────────────────────────────── */
        [data-wz="topbar"] {
          display:flex; align-items:stretch; height:56px; flex-shrink:0;
          background:#060809; border-bottom:1px solid rgba(239,68,68,0.15);
          position:relative;
        }
        [data-wz="topbar"]::after {
          content:''; position:absolute; bottom:0; left:0; right:0; height:1px;
          background:linear-gradient(90deg,transparent,rgba(239,68,68,0.6),transparent);
        }
        [data-wz="brand"] {
          display:flex; align-items:center; gap:12px; padding:0 22px;
          border-right:1px solid rgba(239,68,68,0.1); flex-shrink:0;
        }
        [data-wz="brand-sigil"] { width:34px; height:34px; flex-shrink:0; }
        [data-wz="brand-title"] {
          font-size:20px; font-weight:800; letter-spacing:5px;
          color:#ef4444; line-height:1; text-transform:uppercase;
          text-shadow:0 0 20px rgba(239,68,68,0.4);
        }
        [data-wz="brand-sub"] {
          font-family:'Share Tech Mono',monospace; font-size:8px;
          color:rgba(239,68,68,0.4); letter-spacing:2.5px; margin-top:2px;
        }

        /* ── Filters ────────────────────────────── */
        [data-wz="filters"] { display:flex; align-items:stretch; padding:0 4px; }
        [data-wz="filter"],[data-wz="filter-on"] {
          display:flex; align-items:center; gap:8px; padding:0 16px;
          border:none; background:transparent; cursor:pointer;
          font-family:'Barlow Condensed',sans-serif; font-size:12px;
          font-weight:700; letter-spacing:2px; color:#2a3a45;
          transition:color 0.18s; position:relative;
        }
        [data-wz="filter"]::after,[data-wz="filter-on"]::after {
          content:''; position:absolute; bottom:0;
          height:2px; left:50%; right:50%; transition:all 0.22s;
        }
        [data-wz="filter-on"]        { color:#ef4444; }
        [data-wz="filter-on"]::after { left:10px; right:10px; background:#ef4444; border-radius:2px 2px 0 0; }
        [data-wz="filter-pip"] { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        [data-wz="filter-on"] [data-wz="filter-pip"] { box-shadow:0 0 7px currentColor; }
        [data-wz="filter-count"] {
          font-family:'Share Tech Mono',monospace; font-size:9px;
          padding:1px 6px; border-radius:9px; background:rgba(255,255,255,0.04); color:#2a3a45;
        }
        [data-wz="filter-on"] [data-wz="filter-count"] { background:rgba(239,68,68,0.15); color:#ef4444; }

        /* ── Right cluster ──────────────────────── */
        [data-wz="tb-right"] {
          display:flex; align-items:center; gap:10px;
          margin-left:auto; padding:0 20px;
          border-left:1px solid rgba(239,68,68,0.08);
        }
        [data-wz="kpi"] {
          display:flex; flex-direction:column; align-items:flex-end;
          padding:4px 11px; border:1px solid rgba(239,68,68,0.12);
          border-radius:7px; background:rgba(239,68,68,0.03);
        }
        [data-wz="kpi-val"] { font-family:'Share Tech Mono',monospace; font-size:16px; line-height:1.1; }
        [data-wz="kpi-lbl"] { font-size:8px; color:#2a3a45; letter-spacing:1.5px; text-transform:uppercase; margin-top:1px; }
        [data-wz="live-badge"] {
          display:flex; align-items:center; gap:7px;
          font-family:'Share Tech Mono',monospace; font-size:9px; letter-spacing:1.5px;
        }
        [data-wz="live-dot"] {
          width:8px; height:8px; border-radius:50%;
          background:#ef4444; box-shadow:0 0 8px #ef4444;
          animation:wz-hb 1.6s ease-in-out infinite;
        }
        @keyframes wz-hb { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.6);opacity:0.45} }
        [data-wz="live-txt"] { color:#ef4444; }
        [data-wz="meta-txt"] { font-family:'Share Tech Mono',monospace; font-size:9px; color:#1a2830; line-height:1.8; text-align:right; }

        /* ── Body ───────────────────────────────── */
        [data-wz="body"] { display:flex; flex:1; overflow:hidden; }
        [data-wz="map-wrap"] { flex:1; position:relative; min-width:0; }
        [data-wz="map"]      { width:100%; height:100%; }

        /* ── Overlay ────────────────────────────── */
        [data-wz="overlay"] {
          position:absolute; inset:0; z-index:900;
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          background:rgba(6,8,9,0.96); gap:10px;
        }
        [data-wz="spinner"] {
          width:52px; height:52px; border-radius:50%;
          border:2px solid rgba(239,68,68,0.1); border-top-color:#ef4444;
          animation:wz-spin 1s linear infinite;
        }
        @keyframes wz-spin { to{transform:rotate(360deg)} }
        [data-wz="ov-title"] {
          font-size:13px; font-weight:800; letter-spacing:6px; color:#ef4444; text-transform:uppercase;
        }
        [data-wz="ov-sub"] {
          font-family:'Share Tech Mono',monospace; font-size:10px;
          color:#1a2830; text-align:center; line-height:1.9;
        }
        [data-wz="ov-err"] {
          color:rgba(239,68,68,0.8); font-family:'Share Tech Mono',monospace;
          font-size:10px; max-width:400px; text-align:center; line-height:1.7;
          padding:12px 18px; border:1px solid rgba(239,68,68,0.2);
          border-radius:8px; background:rgba(239,68,68,0.04);
        }

        /* ── Date ribbon ────────────────────────── */
        [data-wz="date-ribbon"] {
          position:absolute; top:12px; left:50%; transform:translateX(-50%);
          z-index:500; pointer-events:none;
          background:rgba(6,8,9,0.9); border:1px solid rgba(239,68,68,0.18);
          border-radius:20px; padding:5px 20px;
          font-family:'Share Tech Mono',monospace; font-size:10px;
          color:rgba(239,68,68,0.6); letter-spacing:2px; backdrop-filter:blur(8px);
        }

        /* ── Legend ─────────────────────────────── */
        [data-wz="legend"] {
          position:absolute; bottom:44px; left:14px; z-index:500;
          background:rgba(6,8,9,0.94); border:1px solid rgba(239,68,68,0.12);
          border-radius:10px; padding:12px 16px; backdrop-filter:blur(12px);
        }
        [data-wz="leg-title"] {
          font-family:'Share Tech Mono',monospace; font-size:8px;
          color:rgba(239,68,68,0.35); letter-spacing:2px; text-transform:uppercase; margin-bottom:9px;
        }
        [data-wz="leg-row"]  { display:flex; align-items:center; gap:9px; margin-bottom:7px; }
        [data-wz="leg-dot"]  { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
        [data-wz="leg-lbl"]  { font-size:11px; color:#3d5060; font-weight:600; letter-spacing:0.5px; white-space:nowrap; }
        [data-wz="leg-note"] {
          margin-top:8px; padding-top:7px; border-top:1px solid rgba(255,255,255,0.03);
          font-family:'Share Tech Mono',monospace; font-size:8px; color:#1a2830; line-height:1.75;
        }

        /* ── Sidebar ────────────────────────────── */
        [data-wz="sidebar"] {
          width:295px; flex-shrink:0; display:flex; flex-direction:column;
          overflow:hidden; background:#050708;
          border-left:1px solid rgba(239,68,68,0.07);
        }

        /* ── Detail ─────────────────────────────── */
        [data-wz="detail"] {
          flex-shrink:0; padding:13px 15px;
          border-bottom:1px solid rgba(239,68,68,0.1);
          background:rgba(239,68,68,0.02);
          animation:wz-fi .18s ease;
        }
        @keyframes wz-fi { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:none} }
        [data-wz="detail-hdr"]   { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px; }
        [data-wz="detail-title"] { font-size:14px; font-weight:800; letter-spacing:0.5px; text-transform:uppercase; line-height:1.2; }
        [data-wz="detail-badge"] { display:inline-block; font-family:'Share Tech Mono',monospace; font-size:8px; letter-spacing:1.2px; text-transform:uppercase; padding:2px 9px; border-radius:20px; margin-bottom:7px; }
        [data-wz="detail-country"] { font-family:'Share Tech Mono',monospace; font-size:9px; color:#1e3040; margin-bottom:8px; }
        [data-wz="detail-row"] { display:flex; justify-content:space-between; font-size:11px; line-height:2; border-bottom:1px solid rgba(255,255,255,0.025); }
        [data-wz="dk"] { font-family:'Share Tech Mono',monospace; font-size:9px; color:#1e3040; letter-spacing:0.5px; text-transform:uppercase; }
        [data-wz="dv"] { color:#7a9aaf; font-size:11px; font-weight:600; }
        [data-wz="detail-notes"] { margin-top:8px; padding:8px 10px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); border-radius:5px; font-family:'Share Tech Mono',monospace; font-size:9px; color:#2a3a45; line-height:1.75; }
        [data-wz="close-btn"] { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); color:#2a3a45; border-radius:5px; padding:4px 9px; cursor:pointer; font-size:10px; font-family:'Barlow Condensed',sans-serif; font-weight:600; transition:all .14s; flex-shrink:0; }
        [data-wz="close-btn"]:hover { background:rgba(239,68,68,0.1); color:#ef4444; border-color:rgba(239,68,68,0.3); }

        /* ── Search ─────────────────────────────── */
        [data-wz="search-wrap"] { padding:10px 13px; border-bottom:1px solid rgba(239,68,68,0.06); flex-shrink:0; }
        [data-wz="search"] { width:100%; background:rgba(255,255,255,0.03); border:1px solid rgba(239,68,68,0.1); border-radius:7px; color:#7a9aaf; font-size:12px; padding:7px 12px; letter-spacing:0.5px; font-family:'Barlow Condensed',sans-serif; font-weight:500; outline:none; transition:border-color .18s; }
        [data-wz="search"]:focus { border-color:rgba(239,68,68,0.3); }
        [data-wz="search"]::placeholder { color:#1a2830; }

        /* ── List ───────────────────────────────── */
        [data-wz="list-hdr"] { display:flex; justify-content:space-between; align-items:center; padding:6px 14px 5px; font-family:'Share Tech Mono',monospace; font-size:8px; letter-spacing:2.5px; border-bottom:1px solid rgba(255,255,255,0.025); position:sticky; top:0; z-index:2; background:rgba(5,7,8,0.99); }
        [data-wz="list-cnt"] { color:#1a2830; font-size:9px; }
        [data-wz="list-scroll"] { flex:1; overflow-y:auto; }
        [data-wz="list-scroll"]::-webkit-scrollbar { width:2px; }
        [data-wz="list-scroll"]::-webkit-scrollbar-thumb { background:rgba(239,68,68,0.12); border-radius:2px; }
        [data-wz="row"],[data-wz="row-sel"] { padding:6px 14px; border-bottom:1px solid rgba(255,255,255,0.02); cursor:pointer; transition:background .1s; }
        [data-wz="row"]:hover { background:rgba(239,68,68,0.035); }
        [data-wz="row-sel"] { background:rgba(239,68,68,0.06); border-left:2px solid rgba(239,68,68,0.5); padding-left:12px; }
        [data-wz="row-top"]  { display:flex; align-items:center; gap:8px; }
        [data-wz="row-dot"]  { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        [data-wz="row-name"] { font-size:12px; font-weight:700; color:#afc0ce; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; letter-spacing:0.3px; }
        [data-wz="row-fatal"] { font-family:'Share Tech Mono',monospace; font-size:9px; color:#ef4444; flex-shrink:0; }
        [data-wz="row-meta"] { font-size:9px; color:#1a2830; margin-top:1px; padding-left:15px; font-family:'Share Tech Mono',monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        [data-wz="list-empty"] { padding:32px 16px; text-align:center; color:#1a2830; font-family:'Share Tech Mono',monospace; font-size:10px; line-height:2; }
        [data-wz="credit"] { padding:6px 14px; border-top:1px solid rgba(255,255,255,0.025); flex-shrink:0; font-family:'Share Tech Mono',monospace; font-size:8px; color:#1a2830; letter-spacing:1px; }

        /* ── Leaflet ────────────────────────────── */
        .wz-map-el .leaflet-container     { background:#060809 !important; }
        .wz-map-el .leaflet-control-attribution { background:rgba(6,8,9,0.85)!important; color:#1a2830!important; font-size:8px!important; border-radius:4px!important; }
        .wz-map-el .leaflet-control-zoom a { background:rgba(8,10,12,0.95)!important; color:#2a3a45!important; border-color:rgba(239,68,68,0.1)!important; }
        .wz-map-el .leaflet-control-zoom a:hover { background:rgba(239,68,68,0.08)!important; color:#ef4444!important; }
        .wz-leaflet-tip { background:transparent!important; border:none!important; box-shadow:none!important; }
        .wz-leaflet-tip::before { display:none!important; }
        .wz-tip { background:rgba(6,8,9,0.97); border:1px solid rgba(239,68,68,0.18); border-radius:9px; padding:10px 14px; min-width:190px; max-width:260px; backdrop-filter:blur(14px); font-family:'Barlow Condensed',sans-serif; box-shadow:0 8px 32px rgba(0,0,0,0.85); }
        .wz-tip-title    { font-size:13px; font-weight:800; margin-bottom:3px; letter-spacing:0.5px; text-transform:uppercase; }
        .wz-tip-conflict { font-family:'Share Tech Mono',monospace; font-size:9px; color:#7a9aaf; margin-bottom:2px; }
        .wz-tip-date     { font-family:'Share Tech Mono',monospace; font-size:9px; color:#1a2830; margin-bottom:7px; }
        .wz-tip-row      { display:flex; justify-content:space-between; font-size:11px; color:#7a9aaf; line-height:1.85; gap:20px; }
        .wz-tip-row span:first-child { color:#2a3a45; font-family:'Share Tech Mono',monospace; font-size:9px; text-transform:uppercase; }
        .wz-tip-sub      { font-size:9px; color:#1a2830; margin-top:6px; font-family:'Share Tech Mono',monospace; }
      `}</style>

      <div data-wz="root">
        {/* ── TOPBAR ──────────────────────────────────────────── */}
        <div data-wz="topbar">
          <div data-wz="brand">
            <div data-wz="brand-sigil">
              <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="17" cy="17" r="15" stroke="#ef4444" strokeWidth="1" opacity="0.4"/>
                <circle cx="17" cy="17" r="9"  stroke="#ef4444" strokeWidth="1.5" opacity="0.7"/>
                <circle cx="17" cy="17" r="3"  fill="#ef4444">
                  <animate attributeName="opacity" values="1;0.3;1" dur="1.8s" repeatCount="indefinite"/>
                </circle>
                <line x1="17" y1="2"  x2="17" y2="10" stroke="#ef4444" strokeWidth="1.2" opacity="0.6"/>
                <line x1="17" y1="24" x2="17" y2="32" stroke="#ef4444" strokeWidth="1.2" opacity="0.6"/>
                <line x1="2"  y1="17" x2="10" y2="17" stroke="#ef4444" strokeWidth="1.2" opacity="0.6"/>
                <line x1="24" y1="17" x2="32" y2="17" stroke="#ef4444" strokeWidth="1.2" opacity="0.6"/>
              </svg>
            </div>
            <div>
              <div data-wz="brand-title">WARZONES</div>
              <div data-wz="brand-sub">UCDP GLOBAL CONFLICT INTEL</div>
            </div>
          </div>

          <div data-wz="filters">
            {FILTERS.map(f => (
              <button
                key={f.key}
                data-wz={typeFilter === f.key ? 'filter-on' : 'filter'}
                onClick={() => { setTypeFilter(f.key); setSelected(null); }}
              >
                <div data-wz="filter-pip" style={{ background: f.color }}/>
                {f.label}
                <span data-wz="filter-count">{f.count}</span>
              </button>
            ))}
          </div>

          <div data-wz="tb-right">
            <div data-wz="live-badge">
              <div data-wz="live-dot"/>
              <span data-wz="live-txt">UCDP LIVE</span>
            </div>
            <div data-wz="kpi" style={{ borderColor:'rgba(239,68,68,0.18)' }}>
              <div data-wz="kpi-val" style={{ color:'#ef4444' }}>{meta ? meta.count.toLocaleString() : '—'}</div>
              <div data-wz="kpi-lbl">Events</div>
            </div>
            <div data-wz="kpi" style={{ borderColor:'rgba(239,68,68,0.1)' }}>
              <div data-wz="kpi-val" style={{ color:'#f97316' }}>{stats.fatalities.toLocaleString()}</div>
              <div data-wz="kpi-lbl">Fatalities</div>
            </div>
            <div data-wz="kpi" style={{ borderColor:'rgba(100,116,139,0.18)' }}>
              <div data-wz="kpi-val" style={{ color:'#94a3b8' }}>{stats.countries}</div>
              <div data-wz="kpi-lbl">Countries</div>
            </div>
            <div data-wz="meta-txt">
              {lastUpd && <div>UPD {lastUpd.toLocaleTimeString()}</div>}
              {meta && <div>{meta.dateRange.from} → {meta.dateRange.to}</div>}
            </div>
          </div>
        </div>

        {/* ── BODY ─────────────────────────────────────────────── */}
        <div data-wz="body">
          <div data-wz="map-wrap">
            {loading && (
              <div data-wz="overlay">
                <div data-wz="spinner"/>
                <div data-wz="ov-title">Scanning conflict zones</div>
                <div data-wz="ov-sub">UCDP Georeferenced Event Dataset<br/>Uppsala University · No API key required</div>
              </div>
            )}
            {!loading && error && (
              <div data-wz="overlay">
                <div data-wz="ov-title">Connection Failed</div>
                <div data-wz="ov-err">{error}</div>
              </div>
            )}
            {meta && !loading && (
              <div data-wz="date-ribbon">
                ⚑ UCDP GED · {meta.dateRange.from} – {meta.dateRange.to}
              </div>
            )}

            <div ref={mapRef} data-wz="map" className="wz-map-el"/>

            <div data-wz="legend">
              <div data-wz="leg-title">Event Type</div>
              {[
                { color:'#ef4444', label:'State-Based Battles'        },
                { color:'#f97316', label:'Non-State Conflict'         },
                { color:'#fbbf24', label:'Violence vs. Civilians'     },
              ].map(({ color, label }) => (
                <div data-wz="leg-row" key={label}>
                  <div data-wz="leg-dot" style={{ background:color, boxShadow:`0 0 5px ${color}60` }}/>
                  <span data-wz="leg-lbl">{label}</span>
                </div>
              ))}
              <div data-wz="leg-note">Marker size = fatality count<br/>Rings = live animation</div>
            </div>
          </div>

          {/* ── SIDEBAR ─────────────────────────────────────────── */}
          <div data-wz="sidebar">
            {selected && <EventDetail evt={selected} onClose={() => setSelected(null)}/>}
            <div data-wz="search-wrap">
              <input
                data-wz="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search conflict, country, actor…"
              />
            </div>
            <div data-wz="list-hdr" style={{ color:'rgba(239,68,68,0.6)' }}>
              <span>⚑ EVENTS — BY CASUALTIES</span>
              <span data-wz="list-cnt">{listEvents.length}</span>
            </div>
            <div data-wz="list-scroll">
              {!loading && listEvents.length === 0 && (
                <div data-wz="list-empty">
                  {error ? 'Failed to load data' : 'No events match filter'}
                </div>
              )}
              {listEvents.map(evt => (
                <EventRow
                  key={evt.id}
                  evt={evt}
                  selected={selected?.id === evt.id}
                  onClick={() => setSelected(evt)}
                />
              ))}
            </div>
            <div data-wz="credit">
              DATA: UCDP GED CANDIDATE · ucdp.uu.se · 6-MONTH WINDOW
            </div>
          </div>
        </div>
      </div>
    </>
  );
}