'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapLegend } from './MapLegend';
import { LayerControl } from './LayerControl';
import { useMapStore } from '@/store/mapStore';
import { MAP_LAYERS } from '@/lib/constants';

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
  country?: string;
  language?: string;
  image?: string;
}

const LAYER_COLOR_MAP = Object.fromEntries(MAP_LAYERS.map(l => [l.id, l.color]));

const GDELT_LAYERS = new Set([
  'intel-hotspots', 'conflict-zones', 'military-bases', 'military-activity',
  'nuclear-sites',  'cyber-threats',  'protests',       'weather-alerts',
  'ship-traffic',   'displacement',
]);

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

async function fetchLayerData(layerId: string): Promise<GeoJSON.FeatureCollection> {
  if (!GDELT_LAYERS.has(layerId)) return getStaticFeatures(layerId);
  try {
    const res = await fetch(`/api/map-data?layer=${layerId}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as GeoJSON.FeatureCollection;
    if (!data.features || data.features.length === 0) return getStaticFeatures(layerId);
    return data;
  } catch (err) {
    console.warn(`[GlobalMap] Failed to fetch "${layerId}":`, err);
    return getStaticFeatures(layerId);
  }
}

function MapLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
      <div className="text-center space-y-3">
        <div className="inline-block px-5 py-3 rounded-xl bg-white border border-gray-200 shadow-sm">
          <div className="text-sm font-medium text-gray-700">Loading map…</div>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    </div>
  );
}

interface PopupInfo {
  layerId: string;
  props: FeatureProperties;
  lngLat: { lng: number; lat: number };
}

function FeaturePopup({ info, onClose }: { info: PopupInfo; onClose: () => void }) {
  const color = LAYER_COLOR_MAP[info.layerId] ?? '#2563eb';
  const sev   = info.props.severity ?? 1;
  const tone  = parseFloat(info.props.tone ?? '0');

  return (
    <div
      className="absolute z-30 pointer-events-auto"
      style={{ bottom: 90, left: '50%', transform: 'translateX(-50%)', minWidth: 280, maxWidth: 360 }}
    >
      <div
        className="rounded-2xl p-4 space-y-3 text-xs font-sans"
        style={{
          background:     '#ffffff',
          border:         '1px solid #e5e7eb',
          boxShadow:      '0 8px 30px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
            style={{ background: color }}
          />
          <div className="font-semibold text-gray-900 text-sm leading-snug flex-1">
            {info.props.label ?? 'Event'}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors shrink-0 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Image thumbnail if available */}
        {info.props.image && (
          <img
            src={info.props.image}
            alt=""
            className="w-full h-28 object-cover rounded-lg"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        )}

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-[11px]">
          <span className="text-gray-400">Source</span>
          <span className="text-gray-700 text-right truncate">{info.props.source ?? 'GDELT'}</span>

          <span className="text-gray-400">Severity</span>
          <span className="flex gap-0.5 justify-end">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} style={{ color: i < sev ? color : '#d1d5db' }}>■</span>
            ))}
          </span>

          {info.props.tone !== undefined && (
            <>
              <span className="text-gray-400">Tone</span>
              <span
                className="text-right font-medium"
                style={{ color: tone < -2 ? '#ef4444' : tone > 2 ? '#16a34a' : '#6b7280' }}
              >
                {tone > 0 ? '+' : ''}{tone.toFixed(1)}
              </span>
            </>
          )}

          {info.props.country && (
            <>
              <span className="text-gray-400">Country</span>
              <span className="text-gray-700 text-right">{info.props.country}</span>
            </>
          )}

          {info.props.publishedAt && (
            <>
              <span className="text-gray-400">Published</span>
              <span className="text-gray-500 text-right">
                {new Date(info.props.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </>
          )}

          <span className="text-gray-400">Coords</span>
          <span className="text-gray-500 text-right">
            {info.lngLat.lat.toFixed(3)}, {info.lngLat.lng.toFixed(3)}
          </span>
        </div>

        {/* CTA */}
        {info.props.url && (
          <a
            href={info.props.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-semibold tracking-wide transition-all hover:opacity-80"
            style={{ background: color, color: '#fff' }}
          >
            Read article ↗
          </a>
        )}

        <div className="text-[9px] text-gray-300 text-center">
          {GDELT_LAYERS.has(info.layerId) ? 'Live via GDELT DOC 2.0' : 'Static reference data'}
        </div>
      </div>
    </div>
  );
}

export function GlobalMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);

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

  // Zoom helpers
  const zoomIn  = () => mapRef.current?.zoomIn({ duration: 300 });
  const zoomOut = () => mapRef.current?.zoomOut({ duration: 300 });

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
              // CartoDB Positron — clean, light, Google Maps-like
              carto: {
                type:  'raster',
                tiles: [
                  'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
                  'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
                  'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
                ],
                tileSize:    256,
                attribution: '© OpenStreetMap contributors © CARTO',
                maxzoom:     19,
              },
            },
            layers: [{
              id:     'carto-layer',
              type:   'raster',
              source: 'carto',
              paint:  {
                'raster-opacity':   1,
                'raster-saturation': -0.1,  // very slightly desaturated for crispness
              },
            }],
          },
          center:    [0, 20],
          zoom:      2.5,
          minZoom:   1.5,
          maxZoom:   18,
          // Smooth scroll zoom — same feel as Google Maps
          scrollZoom: { around: 'center' },
        });

        // Disable map rotation (keeps it Google-like)
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();

        mapRef.current = map;

        map.on('load', async () => {
          if (cancelled) return;
          setMapReady(true);

          MAP_LAYERS.forEach(layerDef => {
            const sourceId = `source-${layerDef.id}`;
            map.addSource(sourceId, {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] },
            });

            // Main circle
            map.addLayer({
              id:     `layer-${layerDef.id}`,
              type:   'circle',
              source: sourceId,
              paint: {
                'circle-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  2, ['interpolate', ['linear'], ['get', 'severity'], 1, 5, 5, 10],
                  8, ['interpolate', ['linear'], ['get', 'severity'], 1, 9, 5, 20],
                ],
                'circle-color':        layerDef.color,
                'circle-opacity':      0.9,
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#ffffff',
              },
              layout: {
                visibility: useMapStore.getState().visibleLayers.includes(layerDef.id)
                  ? 'visible' : 'none',
              },
            });

            // Soft halo (replaces dark pulse)
            map.addLayer({
              id:     `pulse-${layerDef.id}`,
              type:   'circle',
              source: sourceId,
              paint: {
                'circle-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  2, ['interpolate', ['linear'], ['get', 'severity'], 1, 10, 5, 18],
                  8, ['interpolate', ['linear'], ['get', 'severity'], 1, 18, 5, 32],
                ],
                'circle-color':   layerDef.color,
                'circle-opacity': 0.12,
                'circle-stroke-width': 0,
              },
              layout: {
                visibility: useMapStore.getState().visibleLayers.includes(layerDef.id)
                  ? 'visible' : 'none',
              },
            });

            // Labels
            map.addLayer({
              id:     `label-${layerDef.id}`,
              type:   'symbol',
              source: sourceId,
              layout: {
                'text-field':  ['get', 'label'],
                'text-size':   11,
                'text-offset': [0, 1.6],
                'text-anchor': 'top',
                'visibility':  useMapStore.getState().visibleLayers.includes(layerDef.id)
                  ? 'visible' : 'none',
              },
              paint: {
                'text-color':      '#1f2937',
                'text-halo-color': '#ffffff',
                'text-halo-width': 1.5,
              },
            });

            map.on('click', `layer-${layerDef.id}`, (e: any) => {
              e.originalEvent.stopPropagation();
              const feature = e.features?.[0];
              if (!feature) return;
              setPopupInfo({
                layerId: layerDef.id,
                props:   feature.properties as FeatureProperties,
                lngLat:  e.lngLat,
              });
            });

            map.on('mouseenter', `layer-${layerDef.id}`, () => {
              map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', `layer-${layerDef.id}`, () => {
              map.getCanvas().style.cursor = '';
            });
          });

          // Fetch initially visible layers
          const initial = useMapStore.getState().visibleLayers;
          const counts  = { conflicts: 0, military: 0, hotspots: 0, cyber: 0 };

          await Promise.all(
            initial.map(async layerId => {
              const data = await fetchLayerData(layerId);
              if (cancelled) return;
              const src = map.getSource(`source-${layerId}`) as any;
              if (src) src.setData(data);

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

  // ── Sync layer visibility ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    MAP_LAYERS.forEach(layerDef => {
      const vis = visibleLayers.includes(layerDef.id) ? 'visible' : 'none';
      [`layer-${layerDef.id}`, `pulse-${layerDef.id}`, `label-${layerDef.id}`].forEach(id => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
      });

      if (vis === 'visible') {
        const src = map.getSource(`source-${layerDef.id}`) as any;
        if (src) {
          const isEmpty = !src.serialize()?.data?.features?.length;
          if (isEmpty) {
            void fetchLayerData(layerDef.id).then(data => {
              const m = mapRef.current;
              if (!m) return;
              const s = m.getSource(`source-${layerDef.id}`) as any;
              if (s) s.setData(data);
            });
          }
        }
      }
    });
  }, [visibleLayers, mapReady]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-white">
      <div
        ref={mapContainer}
        className="flex-1 relative"
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

        {/* Live Status Panel — light card */}
        <div className="absolute top-4 left-4 z-20">
          <div className="bg-white/95 backdrop-blur-sm p-4 max-w-xs rounded-2xl border border-gray-200 shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-gray-700 tracking-wide uppercase">
                Live global status
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex justify-between items-center">
                <span>Active conflicts</span>
                <span className="font-semibold text-red-500">{liveStats.conflicts || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Military activity</span>
                <span className="font-semibold text-amber-500">{liveStats.military || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Hotspots</span>
                <span className="font-semibold text-blue-500">{liveStats.hotspots || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Cyber threats</span>
                <span className="font-semibold text-purple-500">{liveStats.cyber || '—'}</span>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-gray-100 text-[9px] text-gray-300 font-mono">
              GDELT DOC 2.0 · live feed
            </div>
          </div>
        </div>

        {/* Active layers badge */}
        {visibleLayers.length > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
            <div className="bg-white/95 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-gray-200 shadow-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-medium text-gray-700">
                {visibleLayers.length} layer{visibleLayers.length !== 1 ? 's' : ''} active
              </span>
            </div>
          </div>
        )}

        {/* Google Maps-style zoom controls */}
        <div className="absolute bottom-24 right-4 z-20 flex flex-col rounded-lg overflow-hidden border border-gray-200 shadow-md">
          <button
            onClick={zoomIn}
            className="w-9 h-9 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-700 text-xl font-light border-b border-gray-200 transition-colors"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={zoomOut}
            className="w-9 h-9 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-700 text-xl font-light transition-colors"
            aria-label="Zoom out"
          >
            −
          </button>
        </div>

        {/* Coordinates bar — bottom right */}
        <div className="absolute bottom-4 right-4 z-20">
          <div className="bg-white/90 backdrop-blur-sm px-3 py-2 text-xs rounded-lg border border-gray-200 shadow-sm font-mono text-gray-500">
            {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)} · zoom {zoom} · {utcTime} UTC
          </div>
        </div>

        {/* Popup */}
        {popupInfo && (
          <FeaturePopup info={popupInfo} onClose={() => setPopupInfo(null)} />
        )}
      </div>
    </div>
  );
}