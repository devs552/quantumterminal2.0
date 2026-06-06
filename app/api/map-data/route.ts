// app/api/map-data/route.ts
import { NextRequest, NextResponse } from 'next/server';

const LAYER_QUERIES: Record<string, string> = {
  'intel-hotspots':    '(war OR conflict OR airstrike)',
  'conflict-zones':    '(conflict OR attack OR frontline)',
  'military-bases':    '(military OR naval OR garrison)',
  'military-activity': '(exercise OR troops OR warship)',
  'nuclear-sites':     '(nuclear OR reactor OR uranium)',
  'cyber-threats':     '(cyberattack OR hacking OR ransomware)',
  'protests':          '(protest OR demonstration OR riot)',
  'weather-alerts':    '(hurricane OR earthquake OR flood OR wildfire)',
  'ship-traffic':      '(shipping OR maritime OR tanker)',
  'displacement':      '(refugee OR evacuation OR asylum)',
};

interface DOCArticle {
  title?:       string;
  url?:         string;
  domain?:      string;
  language?:    string;
  sourcecountry?: string;
  seendate?:    string;
  tone?:        number;
  socialimage?: string;
  // GEO fields — present on some articles
  latitude?:    number;
  longitude?:   number;
  location?:    string;
}

interface DOCResponse {
  articles?: DOCArticle[];
}

function buildURL(query: string, maxRows: number): string {
  const encodedQuery = encodeURIComponent(query)
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%22/g, '"');

  return (
    `https://api.gdeltproject.org/api/v2/doc/doc` +
    `?query=${encodedQuery}` +
    `&mode=ArtList` +
    `&maxrecords=${Math.min(maxRows, 250)}` +
    `&format=JSON` +
    `&timespan=24h` +
    `&sort=DateDesc`
  );
}

async function fetchDOC(query: string, maxRows = 60): Promise<DOCArticle[]> {
  const url        = buildURL(query, maxRows);
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 10_000);

  console.log(`[map-data] fetching: ${url}`);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MapApp/1.0)' },
      signal:  controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
  clearTimeout(timer);

  if (!res.ok) throw new Error(`GDELT returned ${res.status}`);

  const text = await res.text();
  if (!text.trim() || !text.includes('{')) return [];

  try {
    const data = JSON.parse(text) as DOCResponse;
    return data?.articles ?? [];
  } catch {
    console.warn('[map-data] non-JSON from GDELT:', text.slice(0, 200));
    return [];
  }
}

// DOC 2.0 articles don't always have lat/lon directly.
// We derive rough coordinates from sourcecountry as a fallback.
// A small lookup of country centroids covers most cases.
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  'United States': [37.09, -95.71],
  'United Kingdom': [55.37, -3.43],
  'Russia': [61.52, 105.31],
  'China': [35.86, 104.19],
  'India': [20.59, 78.96],
  'France': [46.22, 2.21],
  'Germany': [51.16, 10.45],
  'Ukraine': [48.37, 31.16],
  'Israel': [31.04, 34.85],
  'Iran': [32.42, 53.68],
  'Pakistan': [30.37, 69.34],
  'Afghanistan': [33.93, 67.70],
  'Syria': [34.80, 38.99],
  'Iraq': [33.22, 43.67],
  'Turkey': [38.96, 35.24],
  'Brazil': [-14.23, -51.92],
  'Mexico': [23.63, -102.55],
  'Australia': [-25.27, 133.77],
  'Japan': [36.20, 138.25],
  'South Korea': [35.90, 127.76],
  'North Korea': [40.33, 127.51],
  'Sudan': [12.86, 30.21],
  'Ethiopia': [9.14, 40.48],
  'Nigeria': [9.08, 8.67],
  'Myanmar': [16.87, 96.19],
  'Yemen': [15.55, 48.51],
  'Libya': [26.33, 17.22],
  'Somalia': [5.15, 46.19],
  'Venezuela': [6.42, -66.58],
  'Saudi Arabia': [23.88, 45.07],
};

function getCoords(article: DOCArticle): [number, number] | null {
  // Use direct lat/lon if available
  if (article.latitude && article.longitude) {
    return [article.latitude, article.longitude];
  }
  // Fall back to country centroid
  if (article.sourcecountry) {
    const centroid = COUNTRY_CENTROIDS[article.sourcecountry];
    if (centroid) {
      // Add small random jitter so pins don't all stack on same point
      const jitter = () => (Math.random() - 0.5) * 4;
      return [centroid[0] + jitter(), centroid[1] + jitter()];
    }
  }
  return null;
}

function transformArticle(
  article: DOCArticle,
  layerId: string,
  index: number,
  coords: [number, number],
): GeoJSON.Feature {
  const tone     = article.tone ?? 0;
  const absTone  = Math.abs(tone);
  const severity = absTone > 10 ? 5 : absTone > 6 ? 4 : absTone > 3 ? 3 : absTone > 1 ? 2 : 1;

  return {
    type: 'Feature',
    geometry: {
      type:        'Point',
      coordinates: [coords[1], coords[0]], // GeoJSON is [lng, lat]
    },
    properties: {
      id:          `${layerId}-${index}`,
      label:       article.title  ?? article.domain ?? 'Event',
      url:         article.url    ?? null,
      source:      article.domain ?? 'GDELT',
      publishedAt: article.seendate ?? null,
      tone:        Number(tone.toFixed(2)),
      severity,
      layerId,
      image:       article.socialimage ?? null,
      country:     article.sourcecountry ?? null,
      language:    article.language ?? null,
    },
  };
}

export async function GET(request: NextRequest) {
  const layerId = request.nextUrl.searchParams.get('layer');

  if (!layerId) {
    return NextResponse.json({ error: 'Missing ?layer= param' }, { status: 400 });
  }

  const query = LAYER_QUERIES[layerId];
  if (!query) {
    return NextResponse.json({
      type: 'FeatureCollection', features: [],
      meta: { source: 'none', layer: layerId },
    });
  }

  try {
    const articles = await fetchDOC(query);

    const features = articles
      .map((article, i) => {
        const coords = getCoords(article);
        if (!coords) return null;
        return transformArticle(article, layerId, i, coords);
      })
      .filter(Boolean) as GeoJSON.Feature[];

    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features,
        meta: {
          source:    'GDELT DOC 2.0',
          layer:     layerId,
          count:     features.length,
          fetchedAt: new Date().toISOString(),
          query,
        },
      },
      { headers: { 'Cache-Control': 'public, max-age=900, stale-while-revalidate=300' } },
    );
  } catch (err) {
    console.error(`[map-data] failed for layer "${layerId}":`, err);
    return NextResponse.json(
      {
        type: 'FeatureCollection', features: [],
        meta: {
          source: 'fallback',
          layer:  layerId,
          error:  err instanceof Error ? err.message : 'Unknown error',
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}