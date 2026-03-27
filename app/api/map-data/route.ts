// app/api/map-data/route.ts
// Proxies GDELT GEO 2.0 API — completely free, no API key, updates every 15 min
// Docs: https://blog.gdeltproject.org/gdelt-geo-2-0-api-debuts/

import { NextRequest, NextResponse } from 'next/server';

// ── GDELT query map per layer ID ─────────────────────────────────────────────
// GDELT GEO 2.0 base: https://api.gdeltproject.org/api/v2/geo/geo
// Returns GeoJSON FeatureCollection with lat/lon point features

// GDELT requires each OR group to be wrapped in parentheses
const LAYER_QUERIES: Record<string, string> = {
  'intel-hotspots':    '(war OR conflict OR airstrike OR offensive)',
  'conflict-zones':    '(conflict OR attack OR battlefield OR frontline)',
  'military-bases':    '("military base" OR "naval base" OR "troop deployment")',
  'military-activity': '("military exercise" OR "troop movement" OR warship)',
  'nuclear-sites':     '("nuclear plant" OR "uranium enrichment" OR "nuclear weapon")',
  'cyber-threats':     '(cyberattack OR hacking OR ransomware OR "data breach")',
  'protests':          '(protest OR demonstration OR riot OR uprising)',
  'weather-alerts':    '(hurricane OR typhoon OR earthquake OR flood OR wildfire)',
  'ship-traffic':      '(shipping OR maritime OR "cargo ship" OR strait)',
  'displacement':      '(refugee OR displacement OR evacuation OR asylum)',
};
// ── GDELT response shape ──────────────────────────────────────────────────────

interface GDELTFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    name?: string;
    url?: string;
    urlpubtimedate?: string;
    urltone?: number;
    domain?: string;
    count?: number;
    shareimage?: string;
    [key: string]: unknown;
  };
}

interface GDELTResponse {
  type: 'FeatureCollection';
  features: GDELTFeature[];
}

// ── Fetch from GDELT GEO 2.0 ─────────────────────────────────────────────────

async function fetchGDELT(
  query: string,
  maxRows = 50,
): Promise<GDELTFeature[]> {
  const params = new URLSearchParams({
    query,
    mode:      'pointdata',
    maxrows:   String(maxRows),
    format:    'geojson',
    timespan:  '1d',           // last 24 hours, updated every 15 min
    OUTPUTFIELDS: 'name,url,urlpubtimedate,urltone,domain,count,shareimage',
  });

  const url = `https://api.gdeltproject.org/api/v2/geo/geo?${params.toString()}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'QuantumTerminal/1.0' },
    next: { revalidate: 900 }, // cache 15 min server-side (matches GDELT update cadence)
  });

  if (!res.ok) {
    throw new Error(`GDELT returned ${res.status}`);
  }

  const text = await res.text();

  // GDELT sometimes returns empty body or non-JSON on no results
  if (!text.trim() || !text.includes('{')) return [];

  const data = JSON.parse(text) as GDELTResponse;
  return data?.features ?? [];
}

// ── Transform GDELT feature → internal GeoJSON feature ───────────────────────

function transformFeature(
  f: GDELTFeature,
  layerId: string,
  index: number,
): GeoJSON.Feature {
  const tone     = f.properties.urltone ?? 0;
  // severity: negative tone → higher severity (conflicts are tone-negative)
  const severity = tone < -5 ? 5 : tone < -2 ? 4 : tone < 0 ? 3 : tone < 2 ? 2 : 1;

  return {
    type: 'Feature',
    geometry: f.geometry,
    properties: {
      id:          `${layerId}-${index}`,
      label:       f.properties.name ?? f.properties.domain ?? 'Event',
      url:         f.properties.url ?? null,
      source:      f.properties.domain ?? 'GDELT',
      publishedAt: f.properties.urlpubtimedate ?? null,
      tone:        tone.toFixed(2),
      severity,
      layerId,
      count:       f.properties.count ?? 1,
    },
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const layerId = request.nextUrl.searchParams.get('layer');

  if (!layerId) {
    return NextResponse.json({ error: 'Missing ?layer= param' }, { status: 400 });
  }

  const query = LAYER_QUERIES[layerId];

  if (!query) {
    // Unknown layer — return empty GeoJSON (don't error, just no data)
    return NextResponse.json({
      type: 'FeatureCollection',
      features: [],
      meta: { source: 'none', layer: layerId },
    });
  }

  try {
    const raw      = await fetchGDELT(query, 60);
    const features = raw.map((f, i) => transformFeature(f, layerId, i));

    return NextResponse.json(
      {
        type:     'FeatureCollection',
        features,
        meta: {
          source:    'GDELT GEO 2.0',
          layer:     layerId,
          count:     features.length,
          fetchedAt: new Date().toISOString(),
          query,
        },
      },
      { headers: { 'Cache-Control': 'public, max-age=900, stale-while-revalidate=300' } },
    );
  } catch (err) {
    console.error(`[map-data] GDELT fetch failed for layer "${layerId}":`, err);

    // Return empty GeoJSON — map stays functional, just no live data
    return NextResponse.json(
      {
        type:     'FeatureCollection',
        features: [],
        meta: {
          source: 'fallback',
          layer:  layerId,
          error:  err instanceof Error ? err.message : 'Unknown error',
        },
      },
      {
        status:  200, // still 200 so the map doesn't break
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}