// app/api/alerts/live/route.ts
// GET  /api/alerts/live   -- SSE subscribe (?test=1 for instant test alert)
// POST /api/alerts/live   -- push alert manually

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
  // eslint-disable-next-line no-var
  var __sseClients:     Map<string, SSEClient>         | undefined;
  // eslint-disable-next-line no-var
  var __alertHeartbeat: ReturnType<typeof setInterval> | undefined;
  // eslint-disable-next-line no-var
  var __gdeltPoll:      ReturnType<typeof setInterval> | undefined;
  // eslint-disable-next-line no-var
  var __seenAlerts:     Map<string, number>            | undefined;
}

if (!globalThis.__sseClients) globalThis.__sseClients = new Map();
if (!globalThis.__seenAlerts) globalThis.__seenAlerts = new Map();

const clients    = globalThis.__sseClients!;
const seenAlerts = globalThis.__seenAlerts!;
const enc        = new TextEncoder();

// ── Broadcast ─────────────────────────────────────────────────────────────────

export function broadcastAlert(alert: LiveAlert): number {
  const frame = enc.encode(
    `data: ${JSON.stringify({ type: 'alert', payload: alert })}\n\n`,
  );
  let sent = 0;
  for (const client of clients.values()) {
    if (alert.severity < client.minSeverity) continue;
    if (client.sources && !client.sources.includes(alert.source)) continue;
    try {
      client.controller.enqueue(frame);
      sent++;
    } catch {
      clients.delete(client.id);
    }
  }
  console.log(
    `[alerts] broadcast "${alert.title}" sev=${alert.severity} -> ${sent}/${clients.size}`,
  );
  return sent;
}

function heartbeat() {
  const frame = enc.encode(
    `data: ${JSON.stringify({ type: 'heartbeat', ts: Date.now(), clients: clients.size })}\n\n`,
  );
  for (const client of clients.values()) {
    try {
      client.controller.enqueue(frame);
    } catch {
      clients.delete(client.id);
    }
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
  if (Date.now() - t > DEDUP_MS) {
    seenAlerts.delete(id);
    return false;
  }
  return true;
}

function markSeen(id: string) {
  seenAlerts.set(id, Date.now());
}

function makeId(layerId: string, title: string): string {
  const hour = Math.floor(Date.now() / DEDUP_MS);
  return `${hour}::${layerId}::${title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 60)}`;
}

// ── GDELT DOC 2.0 ArtList ─────────────────────────────────────────────────────
//
// Endpoint : https://api.gdeltproject.org/api/v2/doc/doc
// Params   :
//   query      -- free-text keywords + tone operators (tone<-5 etc.)
//   mode       -- ArtList  (returns JSON array of articles)
//   format     -- JSON
//   maxrecords -- up to 250 (we use 10 per query)
//   timespan   -- e.g. "2h", "24h", "1440min"
//   sort       -- DateDesc | ToneAsc (most negative first)
//
// Article shape:
//   { url, title, seendate, domain, language, sourcecountry, tone, socialimage }
//
// GEO 2.0 (/api/v2/geo/geo) is RETIRED -- do not use it.

const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';

interface GDELTArticle {
  url?:           string;
  title?:         string;
  seendate?:      string;
  domain?:        string;
  language?:      string;
  sourcecountry?: string;
  tone?:          number;
  socialimage?:   string;
}

interface GDELTDocResponse {
  articles?: GDELTArticle[];
}

const POLL_QUERIES: Array<{
  query:    string;
  layerId:  string;
  source:   AlertSource;
  baseSev:  AlertSeverity;
}> = [
  {
    query:   '(conflict OR war OR attack OR bombing OR explosion) tone<-5',
    layerId: 'conflict-zones',
    source:  'gdelt',
    baseSev: 4,
  },
  {
    query:   '(military OR troops OR weapons OR strike OR deployment) tone<-5',
    layerId: 'military-activity',
    source:  'military',
    baseSev: 3,
  },
  {
    query:   '(cyberattack OR hacking OR ransomware OR breach) tone<-3',
    layerId: 'cyber-threats',
    source:  'cyber',
    baseSev: 3,
  },
  {
    query:   '(hurricane OR typhoon OR earthquake OR tsunami OR flood OR disaster) tone<-5',
    layerId: 'weather-alerts',
    source:  'weather',
    baseSev: 4,
  },
  {
    query:   '(nuclear OR missile OR threat OR sanctions OR crisis) tone<-7',
    layerId: 'intel-hotspots',
    source:  'gdelt',
    baseSev: 5,
  },
];

// Clamp tone -> severity offset: very negative tone bumps severity by 1
function toneToSeverityBump(tone: number): number {
  if (tone < -10) return 1;
  return 0;
}

function clampSeverity(n: number): AlertSeverity {
  return Math.max(1, Math.min(5, n)) as AlertSeverity;
}

function buildGDELTUrl(query: string): string {
  // encodeURIComponent gives %20 for spaces (correct) and %28/%29 for parens
  // GDELT wants literal parens, so restore them
  const encodedQuery = encodeURIComponent(query)
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%22/g, '"');

  return (
    `${GDELT_DOC}` +
    `?query=${encodedQuery}` +
    `&mode=ArtList` +
    `&format=JSON` +
    `&maxrecords=10` +
    `&timespan=2h` +
    `&sort=ToneAsc`  // most negative (alarming) articles first
  );
}

async function fetchGdeltLayer(
  query:   string,
  layerId: string,
  source:  AlertSource,
  baseSev: AlertSeverity,
): Promise<void> {
  const url = buildGDELTUrl(query);
  console.log(`[alerts/poll] ${layerId}: ${url.slice(0, 120)}...`);

  const res = await fetch(url, {
    signal:  AbortSignal.timeout(15_000),
    headers: {
      Accept:       'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (compatible; AlertBot/1.0)',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(
      `[alerts/poll] GDELT "${layerId}" HTTP ${res.status}: ${body.slice(0, 200)}`,
    );
    return;
  }

  const text = await res.text();
  if (!text || text.trim() === '' || text.trim() === '{}') {
    console.log(`[alerts/poll] "${layerId}" -> empty response`);
    return;
  }

  let data: GDELTDocResponse;
  try {
    data = JSON.parse(text) as GDELTDocResponse;
  } catch {
    console.warn(
      `[alerts/poll] "${layerId}" non-JSON: ${text.slice(0, 100)}`,
    );
    return;
  }

  const articles = data.articles ?? [];
  console.log(`[alerts/poll] "${layerId}" -> ${articles.length} articles`);

  const sevLabels = ['', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'EXTREME'];

  for (const article of articles) {
    const title = (article.title ?? article.domain ?? '').trim();
    if (!title) continue;

    const id = makeId(layerId, title);
    if (isSeen(id)) continue;
    markSeen(id);

    const tone     = typeof article.tone === 'number' ? article.tone : 0;
    const severity = clampSeverity(baseSev + toneToSeverityBump(tone));
    const country  = article.sourcecountry ?? '';
    const domain   = article.domain ?? 'GDELT';

    const alert: LiveAlert = {
      id,
      title:    `${sevLabels[severity]} -- ${title}`,
      body:     `Reported by ${domain}${country ? ` (${country})` : ''}. Tone score: ${tone.toFixed(1)}.`,
      source,
      severity,
      timestamp: article.seendate
        ? new Date(
            article.seendate.replace(
              /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
              '$1-$2-$3T$4:$5:$6Z',
            ),
          ).toISOString()
        : new Date().toISOString(),
      url:     article.url,
      location: country || undefined,
      layerId,
      metadata: {
        Domain:   domain,
        Tone:     tone,
        Language: article.language ?? 'en',
        Layer:    layerId,
      },
    };

    broadcastAlert(alert);
  }
}

async function pollGDELT() {
  if (clients.size === 0) {
    console.log('[alerts/poll] No clients -- skipping');
    return;
  }
  console.log(`[alerts/poll] Cycle start -- ${clients.size} client(s)`);

  await Promise.allSettled(
    POLL_QUERIES.map((q) =>
      fetchGdeltLayer(q.query, q.layerId, q.source, q.baseSev).catch((err: unknown) =>
        console.warn(
          `[alerts/poll] ${q.layerId}:`,
          err instanceof Error ? err.message : String(err),
        ),
      ),
    ),
  );

  console.log('[alerts/poll] Cycle complete');
}

if (!globalThis.__gdeltPoll) {
  console.log('[alerts] Scheduling GDELT poller (5s warmup, then every 90s)');
  setTimeout(() => { void pollGDELT(); }, 5_000);
  globalThis.__gdeltPoll = setInterval(() => { void pollGDELT(); }, 90_000);
}

// ── GET -- SSE subscribe ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sp          = request.nextUrl.searchParams;
  const minSeverity = (
    parseInt(sp.get('minSeverity') ?? '3', 10) || 3
  ) as AlertSeverity;
  const sourcesRaw = sp.get('sources');
  const sources    = sourcesRaw
    ? (sourcesRaw.split(',') as AlertSource[])
    : undefined;
  const sendTest = sp.get('test') === '1';
  const clientId = crypto.randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      clients.set(clientId, { id: clientId, controller, minSeverity, sources });

      // Connection ACK
      controller.enqueue(
        enc.encode(
          `data: ${JSON.stringify({
            type:          'connected',
            clientId,
            timestamp:     new Date().toISOString(),
            activeClients: clients.size,
            config:        { minSeverity, sources: sources ?? 'all' },
          })}\n\n`,
        ),
      );

      // ?test=1 -- synthetic alert after 1s to verify end-to-end
      if (sendTest) {
        setTimeout(() => {
          try {
            const testAlert: LiveAlert = {
              id:        `test-${Date.now()}`,
              title:     'TEST -- Pipeline verified',
              body:      'SSE -> React -> Modal is working. Synthetic test alert.',
              source:    'system',
              severity:  3,
              timestamp: new Date().toISOString(),
              metadata:  { Mode: 'TEST', Clients: String(clients.size) },
            };
            controller.enqueue(
              enc.encode(
                `data: ${JSON.stringify({ type: 'alert', payload: testAlert })}\n\n`,
              ),
            );
          } catch {
            // client disconnected
          }
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
      Connection:                    'keep-alive',
      'X-Accel-Buffering':           'no',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ── POST -- push alert manually ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const secret = process.env.ALERT_WEBHOOK_SECRET;
  if (
    secret &&
    request.headers.get('authorization') !== `Bearer ${secret}`
  ) {
    return Response.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let body: Partial<LiveAlert>;
  try {
    body = (await request.json()) as Partial<LiveAlert>;
  } catch {
    return Response.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 },
    );
  }

  if (!body.title || !body.source || !body.severity) {
    return Response.json(
      { success: false, error: 'title, source, severity required' },
      { status: 400 },
    );
  }

  const alert: LiveAlert = {
    id:        body.id ?? `push-${body.source}-${Date.now()}`,
    title:     body.title,
    body:      body.body ?? '',
    source:    body.source,
    severity:  clampSeverity(body.severity),
    timestamp: body.timestamp ?? new Date().toISOString(),
    url:       body.url,
    location:  body.location,
    metadata:  body.metadata,
    layerId:   body.layerId,
  };

  const sentTo = broadcastAlert(alert);
  return Response.json({ success: true, data: { alert, sentTo } });
}