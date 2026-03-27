'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapLegend } from './MapLegend';
import { LayerControl } from './LayerControl';
import { useMapStore } from '@/store/mapStore';
import { MAP_LAYERS } from '@/lib/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeatureProperties {
  id?: string;
  label?: string;
  url?: string;
  source?: string;
  publishedAt?: string;
  tone?: string;
  severity?: number;
  count?: number;
  layerId?: string;
}

// ── Color per layer ───────────────────────────────────────────────────────────

const LAYER_COLOR_MAP = Object.fromEntries(MAP_LAYERS.map(l => [l.id, l.color]));

// Layers that have real GDELT queries — others use static fallback
const GDELT_LAYERS = new Set([
  'intel-hotspots', 'conflict-zones', 'military-bases', 'military-activity',
  'nuclear-sites',  'cyber-threats',  'protests',       'weather-alerts',
  'ship-traffic',   'displacement',
]);

// ── Static fallback GeoJSON (used for layers without a GDELT query) ───────────

function getStaticFeatures(layerId: string): GeoJSON.FeatureCollection {
  const STATIC: Record<string, GeoJSON.Feature[]> = {
    'spaceports': [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-80.6, 28.6] },  properties: { label: 'Kennedy Space Center', severity: 1 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [45.6, 46.0] },   properties: { label: 'Baikonur Cosmodrome', severity: 1 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-53.8, 5.3] },   properties: { label: 'Guiana Space Centre', severity: 1 } },
    ],
    'undersea-cables': [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-7.7, 57.9] },   properties: { label: 'North Atlantic Cable Hub', severity: 2 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [103.8, 1.3] },   properties: { label: 'Singapore Landing', severity: 2 } },
    ],
    'pipelines': [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [37.0, 40.0] },   properties: { label: 'Trans-Anatolian Pipeline', severity: 2 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [55.0, 50.0] },   properties: { label: 'Russia-Europe Gas Line', severity: 3 } },
    ],
    'data-centers': [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.4, 37.8] }, properties: { label: 'Bay Area Hub', severity: 1 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [10.7, 59.9] },   properties: { label: 'Nordic Data Hub', severity: 1 } },
    ],
    'strategic-waterways': [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [32.3, 29.9] },   properties: { label: 'Suez Canal', severity: 3 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [103.9, 1.25] },  properties: { label: 'Strait of Malacca', severity: 2 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [56.5, 26.5] },   properties: { label: 'Strait of Hormuz', severity: 4 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-79.9, 9.0] },   properties: { label: 'Panama Canal', severity: 2 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-5.4, 35.9] },   properties: { label: 'Strait of Gibraltar', severity: 2 } },
    ],
    'economic-centers': [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-74.0, 40.7] },  properties: { label: 'New York', severity: 1 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [121.5, 31.2] },  properties: { label: 'Shanghai', severity: 1 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [2.35, 48.85] },  properties: { label: 'Paris', severity: 1 } },
    ],
    'critical-minerals': [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [25.9, -7.6] },   properties: { label: 'DRC Copper Belt', severity: 3 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [113.5, -26.0] }, properties: { label: 'Australia Lithium Belt', severity: 2 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-68.5, -22.3] }, properties: { label: 'Atacama Lithium Triangle', severity: 2 } },
    ],
    'flight-delays': [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-0.4, 51.5] },   properties: { label: 'Heathrow', severity: 2 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [13.4, 52.5] },   properties: { label: 'Berlin Brandenburg', severity: 1 } },
    ],
    'natural-events': [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [139.7, 35.7] },  properties: { label: 'Japan Seismic Zone', severity: 3 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-72.3, 18.5] },  properties: { label: 'Caribbean Seismic Zone', severity: 2 } },
    ],
    'climate-anomalies': [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-100.0, 70.0] }, properties: { label: 'Arctic Warming', severity: 4 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [25.0, -20.0] },  properties: { label: 'Southern Africa Drought', severity: 3 } },
    ],
    'internet-outages': [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [36.8, 3.0] },    properties: { label: 'East Africa Outage', severity: 3 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [69.3, 34.5] },   properties: { label: 'Central Asia Throttle', severity: 2 } },
    ],
  };

  return { type: 'FeatureCollection', features: STATIC[layerId] ?? [] };
}

// ── Fetch live GDELT data via our proxy ───────────────────────────────────────

async function fetchLayerData(layerId: string): Promise<GeoJSON.FeatureCollection> {
  if (!GDELT_LAYERS.has(layerId)) {
    return getStaticFeatures(layerId);
  }

  try {
    const res = await fetch(`/api/map-data?layer=${layerId}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as GeoJSON.FeatureCollection;

    // If GDELT returned nothing, use static fallback
    if (!data.features || data.features.length === 0) {
      console.info(`[GlobalMap] GDELT empty for "${layerId}", using static fallback`);
      return getStaticFeatures(layerId);
    }

    return data;
  } catch (err) {
    console.warn(`[GlobalMap] Failed to fetch "${layerId}":`, err);
    return getStaticFeatures(layerId);
  }
}

// ── Loading overlay ───────────────────────────────────────────────────────────

function MapLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0A0E27] z-10">
      <div className="text-center space-y-3">
        <div className="inline-block p-4 rounded-lg bg-[#0F1432]/50 border border-[#00D9FF]/20">
          <div className="text-sm font-mono text-[#00D9FF]">Initializing MapLibre GL…</div>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#00D9FF] border-t-transparent rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ── Popup component ───────────────────────────────────────────────────────────

interface PopupInfo {
  layerId: string;
  props: FeatureProperties;
  lngLat: { lng: number; lat: number };
}

function FeaturePopup({ info, onClose }: { info: PopupInfo; onClose: () => void }) {
  const color = LAYER_COLOR_MAP[info.layerId] ?? '#00D9FF';
  const sev   = info.props.severity ?? 1;
  const tone  = parseFloat(info.props.tone ?? '0');

  return (
    <div
      className="absolute z-30 pointer-events-auto"
      style={{ bottom: 80, left: '50%', transform: 'translateX(-50%)', minWidth: 260, maxWidth: 340 }}
    >
      <div
        className="rounded-xl p-4 space-y-2 font-mono text-xs"
        style={{
          background: '#0A0E27EE',
          border:     `1px solid ${color}50`,
          boxShadow:  `0 0 24px ${color}30`,
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="font-bold text-white text-sm leading-tight">{info.props.label ?? 'Event'}</div>
          <button
            onClick={onClose}
            className="text-[#7A8391] hover:text-white transition-colors shrink-0 text-base leading-none"
          >
            ×
          </button>
        </div>

        {/* Meta */}
        <div className="space-y-1 text-[10px]">
          <div className="flex justify-between">
            <span className="text-[#7A8391]">Source</span>
            <span style={{ color }}>{info.props.source ?? 'GDELT'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7A8391]">Severity</span>
            <span className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ color: i < sev ? color : '#2A3050' }}>■</span>
              ))}
            </span>
          </div>
          {info.props.tone && (
            <div className="flex justify-between">
              <span className="text-[#7A8391]">Tone</span>
              <span style={{ color: tone < 0 ? '#FF1744' : '#0FFF50' }}>
                {tone > 0 ? '+' : ''}{tone.toFixed(1)}
              </span>
            </div>
          )}
          {info.props.count && (
            <div className="flex justify-between">
              <span className="text-[#7A8391]">Coverage</span>
              <span className="text-white">{info.props.count} articles</span>
            </div>
          )}
          {info.props.publishedAt && (
            <div className="flex justify-between">
              <span className="text-[#7A8391]">Updated</span>
              <span className="text-[#B0B9C1]">
                {new Date(info.props.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[#7A8391]">Coords</span>
            <span className="text-[#B0B9C1]">
              {info.lngLat.lat.toFixed(3)}, {info.lngLat.lng.toFixed(3)}
            </span>
          </div>
        </div>

        {/* CTA */}
        {info.props.url && (
          <a
            href={info.props.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center py-1.5 rounded text-[10px] font-bold tracking-wider transition-all hover:brightness-125"
            style={{ background: `${color}20`, border: `1px solid ${color}40`, color }}
          >
            READ SOURCE ↗
          </a>
        )}

        {/* GDELT attribution */}
        <div className="text-[8px] text-[#2A3050] text-center">
          {GDELT_LAYERS.has(info.layerId) ? 'Live via GDELT GEO 2.0 · 15min cadence' : 'Static reference data'}
        </div>
      </div>
    </div>
  );
}

// ── GlobalMap ─────────────────────────────────────────────────────────────────

export function GlobalMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const popupRef     = useRef<any>(null);        // maplibre Popup instance

  const [mapReady,  setMapReady]  = useState(false);
  const [coords,    setCoords]    = useState({ lat: 20.0, lon: 0.0 });
  const [zoom,      setZoom]      = useState(2.5);
  const [utcTime,   setUtcTime]   = useState('');
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null);
  const [liveStats, setLiveStats] = useState({ conflicts: 0, military: 0, hotspots: 0, cyber: 0 });

  const { toggleLayer, visibleLayers } = useMapStore();

  // Live UTC clock
  useEffect(() => {
    const tick = () =>
      setUtcTime(new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Initialize map ──────────────────────────────────────────────────────────
  useEffect(() => {
    const container = mapContainer.current;
    if (!container) return;

    let cancelled = false;

    const init = async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        if (cancelled) return;

        const map = new maplibregl.Map({
          container,
          style: {
            version: 8,
            glyphs:  'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
            sources: {
              osm: {
                type:      'raster',
                tiles:     ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize:  256,
                attribution: '© OpenStreetMap contributors',
              },
            },
            layers: [{
              id:     'osm-layer',
              type:   'raster',
              source: 'osm',
              paint:  { 'raster-opacity': 0.35 },
            }],
          },
          center:  [0, 20],
          zoom:    2.5,
        });

        mapRef.current = map;

        map.on('load', async () => {
          if (cancelled) return;
          setMapReady(true);

          // Add all layer sources with empty data initially
          MAP_LAYERS.forEach(layerDef => {
            const sourceId = `source-${layerDef.id}`;
            map.addSource(sourceId, {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] },
            });

            // Circle layer
            map.addLayer({
              id:     `layer-${layerDef.id}`,
              type:   'circle',
              source: sourceId,
              paint: {
                'circle-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  2, ['interpolate', ['linear'], ['get', 'severity'], 1, 4, 5, 9],
                  8, ['interpolate', ['linear'], ['get', 'severity'], 1, 8, 5, 18],
                ],
                'circle-color':        layerDef.color,
                'circle-opacity':      0.85,
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#ffffff',
              },
              layout: {
                visibility: useMapStore.getState().visibleLayers.includes(layerDef.id)
                  ? 'visible' : 'none',
              },
            });

            // Pulse ring (slightly larger, low opacity)
            map.addLayer({
              id:     `pulse-${layerDef.id}`,
              type:   'circle',
              source: sourceId,
              paint: {
                'circle-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  2, ['interpolate', ['linear'], ['get', 'severity'], 1, 8, 5, 16],
                  8, ['interpolate', ['linear'], ['get', 'severity'], 1, 14, 5, 28],
                ],
                'circle-color':   layerDef.color,
                'circle-opacity': 0.15,
                'circle-stroke-width': 0,
              },
              layout: {
                visibility: useMapStore.getState().visibleLayers.includes(layerDef.id)
                  ? 'visible' : 'none',
              },
            });

            // Label layer
            map.addLayer({
              id:     `label-${layerDef.id}`,
              type:   'symbol',
              source: sourceId,
              layout: {
                'text-field':     ['get', 'label'],
                'text-size':      10,
                'text-offset':    [0, 1.5],
                'text-anchor':    'top',
                'visibility': useMapStore.getState().visibleLayers.includes(layerDef.id)
                  ? 'visible' : 'none',
              },
              paint: {
                'text-color':       '#ffffff',
                'text-halo-color':  '#000000',
                'text-halo-width':  1,
              },
            });

            // Click handler for circle layer
            map.on('click', `layer-${layerDef.id}`, (e: any) => {
              const feature = e.features?.[0];
              if (!feature) return;
              setPopupInfo({
                layerId: layerDef.id,
                props:   feature.properties as FeatureProperties,
                lngLat:  e.lngLat,
              });
            });

            // Cursor change on hover
            map.on('mouseenter', `layer-${layerDef.id}`, () => {
              map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', `layer-${layerDef.id}`, () => {
              map.getCanvas().style.cursor = '';
            });
          });

          // Fetch data for initially visible layers
          const initial = useMapStore.getState().visibleLayers;
          const counts  = { conflicts: 0, military: 0, hotspots: 0, cyber: 0 };

          await Promise.all(
            initial.map(async layerId => {
              const data = await fetchLayerData(layerId);
              if (cancelled) return;
              const src = map.getSource(`source-${layerId}`) as any;
              if (src) src.setData(data);

              // Accumulate live stats
              if (['conflict-zones', 'intel-hotspots'].includes(layerId)) counts.conflicts += data.features.length;
              if (['military-bases', 'military-activity'].includes(layerId)) counts.military += data.features.length;
              if (layerId === 'intel-hotspots') counts.hotspots += data.features.length;
              if (layerId === 'cyber-threats')  counts.cyber    += data.features.length;
            }),
          );

          if (!cancelled) setLiveStats(counts);
        });

        map.on('mousemove', (e: any) => {
          if (!cancelled) setCoords({ lat: +e.lngLat.lat.toFixed(4), lon: +e.lngLat.lng.toFixed(4) });
        });
        map.on('zoom', () => {
          if (!cancelled) setZoom(+map.getZoom().toFixed(1));
        });
        // Click on empty area closes popup
        map.on('click', () => setPopupInfo(null));

      } catch (err) {
        console.error('[GlobalMap] init error:', err);
        if (!cancelled) setMapReady(true);
      }
    };

    void init();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Sync visibleLayers: show/hide + lazy-fetch data when toggled on ─────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    MAP_LAYERS.forEach(layerDef => {
      const vis      = visibleLayers.includes(layerDef.id) ? 'visible' : 'none';
      const circleId = `layer-${layerDef.id}`;
      const pulseId  = `pulse-${layerDef.id}`;
      const labelId  = `label-${layerDef.id}`;

      [circleId, pulseId, labelId].forEach(id => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
      });

      // Lazy-fetch: load data the first time a layer becomes visible
      if (vis === 'visible') {
        const src = map.getSource(`source-${layerDef.id}`) as any;
        if (src) {
          const current = src.serialize();
          const isEmpty = !current?.data?.features?.length;
          if (isEmpty) {
           
             void fetchLayerData(layerDef.id).then(data => {
  const src = map?.getSource(`source-${layerDef.id}`) as any;
  src?.setData(data);
});
          
          }
        }
      }
    });
  }, [visibleLayers, mapReady]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      <div
        ref={mapContainer}
        className="flex-1 relative bg-[#0A0E27]"
        style={{ minHeight: 400, height: '100%' }}
      >
        {!mapReady && <MapLoading />}

        {/* Layer Controls */}
        <div className="absolute top-4 right-4 z-20">
          <LayerControl onToggleLayer={toggleLayer} />
        </div>

        {/* Map Legend */}
        <div className="absolute bottom-16 left-4 z-20">
          <MapLegend />
        </div>

        {/* Global Status Panel — live counts from GDELT */}
        <div className="absolute top-4 left-4 z-20">
          <div className="bg-[#0F1432]/80 backdrop-blur-md p-4 max-w-xs rounded-lg border border-[#00D9FF]/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00D9FF] animate-pulse" />
              <span className="text-xs font-mono text-[#00D9FF] tracking-wider">LIVE GLOBAL STATUS</span>
            </div>
            <div className="space-y-1 text-xs font-mono text-[#B0B9C1]">
              <div className="flex justify-between">
                <span>Active Conflicts:</span>
                <span className="text-[#FF1744]">{liveStats.conflicts || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Military Activity:</span>
                <span className="text-[#FFD700]">{liveStats.military || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Hotspots:</span>
                <span className="text-[#00D9FF]">{liveStats.hotspots || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Cyber Threats:</span>
                <span className="text-[#C084FC]">{liveStats.cyber || '—'}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-[#1A2040] text-[9px] font-mono text-[#3A4870]">
              GDELT GEO 2.0 · 15min cadence
            </div>
          </div>
        </div>

        {/* Active layers indicator */}
        {visibleLayers.length > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
            <div className="bg-[#0F1432]/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#00D9FF]/20 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00D9FF] animate-pulse" />
              <span className="text-xs font-mono text-[#00D9FF]">
                {visibleLayers.length} layer{visibleLayers.length !== 1 ? 's' : ''} active
              </span>
            </div>
          </div>
        )}

        {/* Coordinates & UTC */}
        <div className="absolute bottom-4 right-4 z-20">
          <div className="bg-[#0F1432]/80 backdrop-blur-md p-3 font-mono text-xs rounded-lg border border-[#00D9FF]/20">
            <div className="text-[#B0B9C1]">
              Lat: {coords.lat.toFixed(4)} | Lon: {coords.lon.toFixed(4)}
            </div>
            <div className="text-[#00D9FF] mt-1">
              Zoom: {zoom} | UTC: {utcTime}
            </div>
          </div>
        </div>

        {/* Click popup */}
        {popupInfo && (
          <FeaturePopup info={popupInfo} onClose={() => setPopupInfo(null)} />
        )}
      </div>
    </div>
  );
}