/**
 * app/api/warzones/route.ts
 *
 * UCDP Georeferenced Event Dataset (Candidate — monthly release)
 * Uppsala University · https://ucdp.uu.se
 *
 * ✅ Completely FREE — no API key, no registration, no OAuth.
 *
 * ── Strategy ──────────────────────────────────────────────────────────────────
 * As of February 2026, the UCDP JSON API requires a token.
 * HOWEVER, the direct CSV bulk downloads remain fully public and unauthenticated.
 *
 * Download URL pattern (no auth needed):
 *   https://ucdp.uu.se/downloads/candidateged/GEDEvent_v{YY}_{M}_{D}.csv
 *
 * Examples confirmed on the downloads page:
 *   GEDEvent_v26_0_1.csv   ← Jan 2026 (current)
 *   GEDEvent_v25_0_12.csv  ← Dec 2025
 *
 * We probe newest→oldest, parse the CSV server-side, filter to the last
 * 6 months, and return exactly the same shape the frontend already expects.
 * One request, no pagination, no auth.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server';

// ─── Version probing ──────────────────────────────────────────────────────────

/** Build the list of CSV URLs to try, newest first. */
function csvCandidates(): Array<{ url: string; version: string }> {
  const now   = new Date();
  const year  = now.getFullYear() % 100; // e.g. 26
  const month = now.getMonth() + 1;      // 1–12

  const list: Array<{ url: string; version: string }> = [];

  // Monthly candidates: current month back 3 months
  for (let delta = 0; delta <= 3; delta++) {
    let m = month - delta;
    let y = year;
    if (m <= 0) { m += 12; y -= 1; }
    const version  = `${y}.0.${m}`;
    const filename = `GEDEvent_v${y}_0_${m}.csv`;
    list.push({ version, url: `https://ucdp.uu.se/downloads/candidateged/${filename}` });
  }

  return list;
}

/** Fetch the first CSV that responds 200 with valid content. */
async function fetchLatestCsv(): Promise<{ csv: string; version: string }> {
  const candidates = csvCandidates();

  for (const { url, version } of candidates) {
    try {
      const res = await fetch(url, {
        headers: { Accept: '*/*' },
        // Cache 24 h server-side — UCDP updates monthly, daily is plenty fresh
        next: { revalidate: 86400 },
      });

      if (!res.ok) {
        console.log(`[warzones] ${version}: HTTP ${res.status} — trying next`);
        continue;
      }

      const text = await res.text();

      // Reject HTML error pages
      if (text.trimStart().startsWith('<')) {
        console.log(`[warzones] ${version}: got HTML — trying next`);
        continue;
      }

      // Sanity-check: first line must look like a CSV header
      const firstLine = text.split('\n')[0] ?? '';
      if (!firstLine.includes('latitude') || !firstLine.includes('id')) {
        console.log(`[warzones] ${version}: unexpected header "${firstLine.slice(0, 80)}" — trying next`);
        continue;
      }

      console.log(`[warzones] Using UCDP ${version} (${(text.length / 1024).toFixed(0)} KB)`);
      return { csv: text, version };

    } catch (err: any) {
      console.log(`[warzones] ${version}: ${err.message} — trying next`);
    }
  }

  throw new Error(
    `No accessible UCDP CSV found. Tried: ${candidates.map(c => c.version).join(', ')}. ` +
    `Check https://ucdp.uu.se/downloads/ for current versions.`,
  );
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

/**
 * Minimal RFC-4180 CSV parser — handles quoted fields with embedded commas/newlines.
 */
function parseCsv(raw: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  let pos = 0;
  const len = raw.length;

  function parseField(): string {
    if (pos < len && raw[pos] === '"') {
      pos++; // skip opening quote
      let field = '';
      while (pos < len) {
        if (raw[pos] === '"') {
          pos++;
          if (pos < len && raw[pos] === '"') { field += '"'; pos++; } // "" → "
          else break;
        } else {
          field += raw[pos++];
        }
      }
      return field;
    }
    const start = pos;
    while (pos < len && raw[pos] !== ',' && raw[pos] !== '\n' && raw[pos] !== '\r') pos++;
    return raw.slice(start, pos);
  }

  function parseLine(): string[] {
    const fields: string[] = [];
    while (pos < len && raw[pos] !== '\n' && raw[pos] !== '\r') {
      fields.push(parseField());
      if (pos < len && raw[pos] === ',') pos++;
    }
    if (pos < len && raw[pos] === '\r') pos++;
    if (pos < len && raw[pos] === '\n') pos++;
    return fields;
  }

  const header = parseLine();
  while (pos < len) {
    const line = parseLine();
    if (line.length === 0 || (line.length === 1 && line[0] === '')) continue;
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = line[i] ?? '';
    rows.push(row);
  }

  return rows;
}

// ─── Date helper ─────────────────────────────────────────────────────────────

function sixMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().split('T')[0];
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // 1. Fetch the latest publicly available CSV
    const { csv, version } = await fetchLatestCsv();

    // 2. Parse
    const rows = parseCsv(csv);
    console.log(`[warzones] parsed ${rows.length} total rows`);

    // 3. Filter to last 6 months
    //    UCDP CSVs contain all events since 1989 — we only need recent ones.
    const cutoff = sixMonthsAgo();
    const recent = rows.filter(r => (r['date_end'] ?? r['date_start'] ?? '') >= cutoff);
    console.log(`[warzones] ${recent.length} events since ${cutoff}`);

    // 4. Normalise to ConflictEvent shape (same as before)
    const events = recent
      .filter(r => r['latitude'] && r['longitude'])
      .map(r => {
        const viol = parseInt(r['type_of_violence'] ?? '0', 10);
        let type: string, subType: string;

        switch (viol) {
          case 1:
            type    = 'Battles';
            subType = r['dyad_name'] ?? 'State-based conflict';
            break;
          case 2:
            type    = 'Non-State Conflict';
            subType = r['dyad_name'] ?? 'Non-state conflict';
            break;
          case 3:
            type    = 'Violence against civilians';
            subType = r['side_a'] ?? 'One-sided violence';
            break;
          default:
            type    = 'Armed Conflict';
            subType = r['dyad_name'] ?? '';
        }

        return {
          id:         r['id']             ?? '',
          date:       r['date_start']     ?? r['year'] ?? '',
          type,
          subType,
          actor1:     r['side_a']         ?? '',
          actor2:     r['side_b']         ?? '',
          country:    r['country']        ?? '',
          region:     r['region']         ?? '',
          location:   r['country']        ?? '',
          lat:        parseFloat(r['latitude']  ?? '0'),
          lng:        parseFloat(r['longitude'] ?? '0'),
          fatalities: parseInt(r['best'] ?? r['low'] ?? '0', 10) || 0,
          notes:      r['source_article'] ?? '',
          source:     `UCDP GED Candidate ${version}`,
          conflict:   r['conflict_name']  ?? r['dyad_name'] ?? '',
        };
      });

    // 5. Deduplicate by id
    const seen   = new Set<string>();
    const unique = events.filter(e => {
      if (!e.id || seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    console.log(`[warzones] returning ${unique.length} unique events`);

    return NextResponse.json({
      success:   true,
      count:     unique.length,
      total:     unique.length,
      fetchedAt: Date.now(),
      source:    `UCDP GED Candidate ${version}`,
      dateRange: {
        from: cutoff,
        to:   new Date().toISOString().split('T')[0],
      },
      events: unique,
    });

  } catch (err: any) {
    console.error('[warzones] ERROR:', err.message);
    return NextResponse.json(
      { success: false, events: [], error: err.message },
      { status: 500 },
    );
  }
}