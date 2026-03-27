// app/api/alerts/live/route.ts
// GET  /api/alerts/live        — SSE subscribe  (?test=1 for instant test alert)
// POST /api/alerts/live        — push alert manually

import { NextRequest } from 'next/server';

export type AlertSource   = 'gdelt' | 'markets' | 'crypto' | 'weather' | 'cyber' | 'military' | 'system';
export type AlertSeverity = 1 | 2 | 3 | 4 | 5;

export interface LiveAlert {
  id:        string;
  title:     string;
  body:      string;
  source:    AlertSource;
  severity:  AlertSeverity;
  timestamp: string;
  url?:      string;
  location?: string;
  metadata?: Record<string, string | number>;
  layerId?:  string;
}

// ── Global state (survives Next.js hot-reloads) ───────────────────────────────

type SSEClient = {
  id:          string;
  controller:  ReadableStreamDefaultController<Uint8Array>;
  minSeverity: AlertSeverity;
  sources?:    AlertSource[];
};

declare global {
  var __sseClients:     Map<string, SSEClient>         | undefined;
  var __alertHeartbeat: ReturnType<typeof setInterval> | undefined;
  var __gdeltPoll:      ReturnType<typeof setInterval> | undefined;
  var __seenAlerts:     Map<string, number>            | undefined;
}

if (!globalThis.__sseClients) globalThis.__sseClients = new Map();
if (!globalThis.__seenAlerts) globalThis.__seenAlerts = new Map();

const clients    = globalThis.__sseClients!;
const seenAlerts = globalThis.__seenAlerts!;
const enc        = new TextEncoder();

// ── Broadcast ─────────────────────────────────────────────────────────────────

export function broadcastAlert(alert: LiveAlert): number {
  const frame = enc.encode(`data: ${JSON.stringify({ type: 'alert', payload: alert })}\n\n`);
  let sent = 0;
  for (const client of clients.values()) {
    if (alert.severity < client.minSeverity) continue;
    if (client.sources && !client.sources.includes(alert.source)) continue;
    try { client.controller.enqueue(frame); sent++; }
    catch { clients.delete(client.id); }
  }
  console.log(`[alerts] broadcast "${alert.title}" sev=${alert.severity} → ${sent}/${clients.size}`);
  return sent;
}

function heartbeat() {
  const frame = enc.encode(
    `data: ${JSON.stringify({ type: 'heartbeat', ts: Date.now(), clients: clients.size })}\n\n`
  );
  for (const client of clients.values()) {
    try { client.controller.enqueue(frame); } catch { clients.delete(client.id); }
  }
}

if (!globalThis.__alertHeartbeat) {
  globalThis.__alertHeartbeat = setInterval(heartbeat, 25_000);
}

// ── Dedup (1-hour rolling window) ─────────────────────────────────────────────

const DEDUP_MS = 60 * 60_000;

function isSeen(id: string): boolean {
  const t = seenAlerts.get(id);
  if (!t) return false;
  if (Date.now() - t > DEDUP_MS) { seenAlerts.delete(id); return false; }
  return true;
}
function markSeen(id: string) { seenAlerts.set(id, Date.now()); }
function makeId(layerId: string, label: string): string {
  const hour = Math.floor(Date.now() / DEDUP_MS);
  return `${hour}::${layerId}::${label.toLowerCase().replace(/\s+/g, '-').slice(0, 60)}`;
}

// ── GDELT GEO 2.0 API — correct usage ────────────────────────────────────────
//
// Correct endpoint: https://api.gdeltproject.org/api/v2/geo/geo
// Required params:
//   query    — free-text English keywords
//   mode     — PointData (returns GeoJSON features with article lists per location)
//   format   — GeoJSON
//   TIMESPAN — minutes (15–1440). Default=1440 (24h). Use 120 for freshness.
//
// GeoJSON feature.properties shape (PointData mode):
//   {
//     name:     string   — location name
//     html:     string   — HTML snippet listing articles (contains URLs, titles, tone)
//     count:    number   — article count at this location
//     type:     string   — location type (CITY, COUNTRY, etc)
//     lat/lng:  number   — (in geometry.coordinates, NOT properties)
//   }
//
// IMPORTANT: `tone` is NOT a top-level property in GeoJSON PointData output.
// Tone is embedded inside the `html` field as text. To get per-article tone
// we parse it out, or we use the `sort=toneDesc` param to rank by negativity
// and treat position as a proxy for severity.
//
// OUTPUTFIELDS is NOT a valid GEO API param (it's for the DOC API). Remove it.

const GDELT_GEO = 'https://api.gdeltproject.org/api/v2/geo/geo';

// Use tone<-5 query operator to pre-filter for negative/conflict coverage.
// This guarantees all returned features are already high-severity candidates.
const POLL_QUERIES: Array<{
  query:       string;
  layerId:     string;
  source:      AlertSource;
  severity:    AlertSeverity;  // fixed severity — we can't get per-feature tone in PointData
}> = [
  {
    query:    'conflict war attack bombing explosion "killed" OR "dead" tone<-5',
    layerId:  'conflict-zones',
    source:   'gdelt',
    severity: 4,
  },
  {
    query:    'military troops weapons strike deployment tone<-5',
    layerId:  'military-activity',
    source:   'military',
    severity: 3,
  },
  {
    query:    'cyberattack hacking ransomware breach tone<-3',
    layerId:  'cyber-threats',
    source:   'cyber',
    severity: 3,
  },
  {
    query:    'hurricane typhoon earthquake tsunami flood disaster tone<-5',
    layerId:  'weather-alerts',
    source:   'weather',
    severity: 4,
  },
  {
    query:    'nuclear missile threat sanctions crisis tone<-7',
    layerId:  'intel-hotspots',
    source:   'gdelt',
    severity: 5,
  },
];

function coordsLabel([lng, lat]: [number, number]): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
}

// Extract the first URL from GDELT's HTML snippet
// The html field looks like: <a href="https://...">title</a> ...
function extractUrl(html: string): string | undefined {
  const m = html?.match(/href="(https?:\/\/[^"]+)"/);
  return m?.[1];
}

async function fetchGdeltLayer(
  query: string, layerId: string, source: AlertSource, severity: AlertSeverity
): Promise<void> {
  // Build correct GDELT GEO 2.0 params
  const params = new URLSearchParams({
    query,
    mode:     'PointData',   // returns GeoJSON FeatureCollection
    format:   'GeoJSON',
    TIMESPAN: '120',         // last 2 hours
    MAXROWS:  '10',          // max locations to return
    sort:     'toneDesc',    // most negative tone first → highest priority
  });

  const url = `${GDELT_GEO}?${params}`;
  console.log(`[alerts/poll] ${layerId}: ${url.slice(0, 120)}…`);

  const res = await fetch(url, {
    signal:  AbortSignal.timeout(15_000),
    headers: { Accept: 'application/json, text/plain, */*' },
    cache:   'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[alerts/poll] GDELT "${layerId}" HTTP ${res.status}: ${body.slice(0, 200)}`);
    return;
  }

  const contentType = res.headers.get('content-type') ?? '';

  // GDELT sometimes returns empty string or non-JSON on no results
  const text = await res.text();
  if (!text || text.trim() === '' || text.trim() === '{}') {
    console.log(`[alerts/poll] "${layerId}" → empty response (no matching events)`);
    return;
  }

  let data: { features?: any[] };
  try {
    data = JSON.parse(text);
  } catch {
    console.warn(`[alerts/poll] "${layerId}" non-JSON response: ${text.slice(0, 100)}`);
    return;
  }

  const features = data.features ?? [];
  console.log(`[alerts/poll] "${layerId}" → ${features.length} location features`);

  const sevLabels = ['', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'EXTREME'];

  for (const f of features) {
    const p    = f.properties ?? {};
    const name = String(p.name ?? p.NAME ?? 'Unknown Location').trim();
    if (!name || name === 'Unknown Location') continue;

    const id = makeId(layerId, name);
    if (isSeen(id)) continue;
    markSeen(id);

    const coords = Array.isArray(f.geometry?.coordinates)
      ? (f.geometry.coordinates as [number, number])
      : null;

    const articleUrl = extractUrl(p.html ?? '');
    const count      = Number(p.count ?? p.COUNT ?? 1);

    const alert: LiveAlert = {
      id,
      title:     `${sevLabels[severity]} — ${name}`,
      body:      `${count} article${count !== 1 ? 's' : ''} detected near this location matching "${layerId.replace(/-/g, ' ')}" coverage.`,
      source,
      severity,
      timestamp: new Date().toISOString(),
      url:       articleUrl,
      location:  coords ? coordsLabel(coords) : name,
      layerId,
      metadata: {
        Layer:    layerId,
        Articles: count,
        Region:   name,
      },
    };

    broadcastAlert(alert);
  }
}

async function pollGDELT() {
  if (clients.size === 0) {
    console.log('[alerts/poll] No clients — skipping');
    return;
  }
  console.log(`[alerts/poll] Cycle start — ${clients.size} client(s)`);

  await Promise.allSettled(
    POLL_QUERIES.map(q =>
      fetchGdeltLayer(q.query, q.layerId, q.source, q.severity)
        .catch(err => console.warn(`[alerts/poll] ${q.layerId}:`, err.message))
    )
  );

  console.log('[alerts/poll] Cycle complete');
}

if (!globalThis.__gdeltPoll) {
  console.log('[alerts] Scheduling GDELT poller (5s warmup, then every 90s)');
  setTimeout(pollGDELT, 5_000);
  globalThis.__gdeltPoll = setInterval(pollGDELT, 90_000);
}

// ── GET — SSE subscribe ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sp          = request.nextUrl.searchParams;
  const minSeverity = (parseInt(sp.get('minSeverity') ?? '3', 10) || 3) as AlertSeverity;
  const sourcesRaw  = sp.get('sources');
  const sources     = sourcesRaw ? (sourcesRaw.split(',') as AlertSource[]) : undefined;
  const sendTest    = sp.get('test') === '1';
  const clientId    = crypto.randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      clients.set(clientId, { id: clientId, controller, minSeverity, sources });

      // Connection ACK
      controller.enqueue(enc.encode(
        `data: ${JSON.stringify({
          type:          'connected',
          clientId,
          timestamp:     new Date().toISOString(),
          activeClients: clients.size,
          config:        { minSeverity, sources: sources ?? 'all' },
        })}\n\n`
      ));

      // ?test=1 — send a synthetic alert after 1s to verify end-to-end
      if (sendTest) {
        setTimeout(() => {
          try {
            const testAlert: LiveAlert = {
              id:        `test-${Date.now()}`,
              title:     '🧪 TEST — Pipeline verified',
              body:      'SSE → React → Modal is working. This is a synthetic test alert.',
              source:    'system',
              severity:  3,
              timestamp: new Date().toISOString(),
              metadata:  { Mode: 'TEST', Clients: String(clients.size) },
            };
            controller.enqueue(enc.encode(
              `data: ${JSON.stringify({ type: 'alert', payload: testAlert })}\n\n`
            ));
          } catch { /* client gone */ }
        }, 1_000);
      }

      console.log(`[alerts/live] +client ${clientId} (total: ${clients.size})`);
    },
    cancel() {
      clients.delete(clientId);
      console.log(`[alerts/live] -client ${clientId} (total: ${clients.size})`);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':                'text/event-stream',
      'Cache-Control':               'no-cache, no-transform',
      'Connection':                  'keep-alive',
      'X-Accel-Buffering':           'no',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ── POST — push alert manually ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const secret = process.env.ALERT_WEBHOOK_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: Partial<LiveAlert>;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.title || !body.source || !body.severity) {
    return Response.json(
      { success: false, error: 'title, source, severity required' },
      { status: 400 }
    );
  }

  const alert: LiveAlert = {
    id:        body.id ?? `push-${body.source}-${Date.now()}`,
    title:     body.title,
    body:      body.body ?? '',
    source:    body.source,
    severity:  Math.max(1, Math.min(5, body.severity)) as AlertSeverity,
    timestamp: body.timestamp ?? new Date().toISOString(),
    url:       body.url,
    location:  body.location,
    metadata:  body.metadata,
    layerId:   body.layerId,
  };

  const sentTo = broadcastAlert(alert);
  return Response.json({ success: true, data: { alert, sentTo } });
}