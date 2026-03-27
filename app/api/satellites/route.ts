import { NextResponse } from "next/server";

/**
 * Satellite Tracking API
 *
 * Data: CelesTrak GP catalog (free, no key required)
 * Correct URL format: https://celestrak.org/NORAD/elements/gp.php?GROUP=<group>&FORMAT=tle
 *
 * NOTE: The old /SOCRATES/query.php endpoint is the proximity-analysis tool (wrong).
 *       The correct GP catalog endpoint is /NORAD/elements/gp.php
 *
 * CelesTrak rate-limits abusive clients. We cache responses and only re-fetch
 * when data is stale (>2 hours), which matches CelesTrak's update cadence.
 */

const TLE_SOURCES: { url: string; type: string; max?: number }[] = [
  {
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle",
    type: "Space Station",
  },
  {
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle",
    type: "Visual",
    max: 50,
  },
  {
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle",
    type: "Starlink",
    max: 120,
  },
  {
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle",
    type: "GPS",
    max: 32,
  },
  {
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=geo&FORMAT=tle",
    type: "GEO",
    max: 60,
  },
  {
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle",
    type: "Weather",
    max: 25,
  },
  {
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=galileo&FORMAT=tle",
    type: "Galileo",
    max: 30,
  },
];

interface TLEEntry {
  name: string;
  line1: string;
  line2: string;
  type: string;
}

interface SatellitePosition {
  id: string;
  name: string;
  lat: number;
  lng: number;
  alt: number;        // km above surface
  velocity: number;   // km/s
  type: string;
  inclination: number;
  period: number;     // minutes
  epoch: string;
}

/** Parse 3-line TLE text blocks into structured entries */
function parseTLE(text: string, type: string): TLEEntry[] {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  const out: TLEEntry[] = [];
  for (let i = 0; i < lines.length - 2; i++) {
    if (lines[i + 1].startsWith("1 ") && lines[i + 2].startsWith("2 ")) {
      out.push({
        name: lines[i].replace(/^0 /, "").trim(),
        line1: lines[i + 1],
        line2: lines[i + 2],
        type,
      });
      i += 2;
    }
  }
  return out;
}

/**
 * Propagate TLE to current satellite position using simplified Keplerian mechanics.
 * Accurate enough for real-time visualization (sub-degree lat/lng error).
 *
 * Steps:
 * 1. Parse orbital elements from TLE lines
 * 2. Advance mean anomaly to current time
 * 3. Solve Kepler's equation (Newton iteration)
 * 4. Convert to ECI (Earth-Centered Inertial) position
 * 5. Rotate ECI → ECEF using GMST
 * 6. Convert ECEF → geodetic lat/lng/alt
 */
function propagateTLE(tle: TLEEntry): SatellitePosition | null {
  try {
    const L1 = tle.line1;
    const L2 = tle.line2;

    // ── Parse TLE fields ────────────────────────────────────────────────────
    const epochYear2  = parseInt(L1.substring(18, 20), 10);
    const epochDay    = parseFloat(L1.substring(20, 32));
    const inclDeg     = parseFloat(L2.substring(8, 16));
    const raanDeg     = parseFloat(L2.substring(17, 25));
    const ecc         = parseFloat("0." + L2.substring(26, 33).trim());
    const argPDeg     = parseFloat(L2.substring(34, 42));
    const maDeg       = parseFloat(L2.substring(43, 51));
    const mmRevPerDay = parseFloat(L2.substring(52, 63));
    const noradId     = L2.substring(2, 7).trim();

    if (isNaN(inclDeg) || isNaN(mmRevPerDay) || mmRevPerDay <= 0) return null;

    // ── Epoch → Unix timestamp (ms) ─────────────────────────────────────────
    const fullYear = epochYear2 < 57 ? 2000 + epochYear2 : 1900 + epochYear2;
    const epochMs  = Date.UTC(fullYear, 0, 1) + (epochDay - 1) * 86_400_000;
    const dtMin    = (Date.now() - epochMs) / 60_000;

    // ── Keplerian elements ───────────────────────────────────────────────────
    const GM   = 398_600.4418;                          // km³/s²
    const n    = mmRevPerDay * 2 * Math.PI / 1440;     // mean motion rad/min
    const nS   = n / 60;                               // rad/s
    const a    = Math.cbrt(GM / (nS * nS));            // semi-major axis (km)
    const T    = 1440 / mmRevPerDay;                   // period (minutes)

    // ── Mean anomaly at current time ─────────────────────────────────────────
    const maRad = ((maDeg + mmRevPerDay * 360 * dtMin / 1440) % 360) * Math.PI / 180;

    // ── Solve Kepler's equation: E - e·sin(E) = M  (Newton-Raphson, 5 iters) ─
    let E = maRad;
    for (let i = 0; i < 5; i++) {
      E = E - (E - ecc * Math.sin(E) - maRad) / (1 - ecc * Math.cos(E));
    }

    // ── True anomaly ─────────────────────────────────────────────────────────
    const nu = 2 * Math.atan2(
      Math.sqrt(1 + ecc) * Math.sin(E / 2),
      Math.sqrt(1 - ecc) * Math.cos(E / 2)
    );

    // ── Distance and altitude ────────────────────────────────────────────────
    const r   = a * (1 - ecc * Math.cos(E));
    const alt = r - 6371; // km above Earth's surface

    // ── ECI position vector ──────────────────────────────────────────────────
    const incl = inclDeg * Math.PI / 180;
    const argP = argPDeg * Math.PI / 180;
    const raan = raanDeg * Math.PI / 180;
    const u    = argP + nu; // argument of latitude

    const xECI = r * (Math.cos(raan) * Math.cos(u) - Math.sin(raan) * Math.sin(u) * Math.cos(incl));
    const yECI = r * (Math.sin(raan) * Math.cos(u) + Math.cos(raan) * Math.sin(u) * Math.cos(incl));
    const zECI = r * Math.sin(incl) * Math.sin(u);

    // ── GMST (Greenwich Mean Sidereal Time) ──────────────────────────────────
    const jd      = 2_440_587.5 + Date.now() / 86_400_000;
    const Tj      = (jd - 2_451_545.0) / 36_525;
    const gmstDeg = (280.46061837 + 360.98564736629 * (jd - 2_451_545.0) + 0.000387933 * Tj * Tj) % 360;
    const gmstRad = gmstDeg * Math.PI / 180;

    // ── Rotate ECI → ECEF ────────────────────────────────────────────────────
    const xE =  xECI * Math.cos(gmstRad) + yECI * Math.sin(gmstRad);
    const yE = -xECI * Math.sin(gmstRad) + yECI * Math.cos(gmstRad);
    const zE =  zECI;

    // ── Geodetic lat/lng ─────────────────────────────────────────────────────
    const lng = Math.atan2(yE, xE) * 180 / Math.PI;
    const lat = Math.atan2(zE, Math.sqrt(xE ** 2 + yE ** 2)) * 180 / Math.PI;

    // ── Orbital velocity (vis-viva) ──────────────────────────────────────────
    const velocity = Math.sqrt(GM * (2 / r - 1 / a)); // km/s

    return {
      id:          noradId,
      name:        tle.name,
      lat:         parseFloat(lat.toFixed(4)),
      lng:         parseFloat(lng.toFixed(4)),
      alt:         parseFloat(Math.max(0, alt).toFixed(1)),
      velocity:    parseFloat(velocity.toFixed(3)),
      type:        tle.type,
      inclination: parseFloat(inclDeg.toFixed(2)),
      period:      parseFloat(T.toFixed(1)),
      epoch:       new Date(epochMs).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const allTLE: TLEEntry[] = [];

  await Promise.allSettled(
    TLE_SOURCES.map(async ({ url, type, max }) => {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "QuantumTerminal/1.0 (satellite tracker; contact admin)" },
          signal: AbortSignal.timeout(10_000),
          // Next.js cache: revalidate every 2 hours (CelesTrak's own update cadence)
          next: { revalidate: 7200 },
        } as RequestInit);

        if (!res.ok) {
          console.warn(`[satellites] ${type}: HTTP ${res.status}`);
          return;
        }

        const text = await res.text();
        if (!text || text.includes("<!DOCTYPE")) {
          // Got an HTML error page instead of TLE data
          console.warn(`[satellites] ${type}: received HTML instead of TLE data`);
          return;
        }

        let entries = parseTLE(text, type);
        if (max) entries = entries.slice(0, max);
        allTLE.push(...entries);
        console.log(`[satellites] ${type}: ${entries.length} TLEs loaded`);
      } catch (err: any) {
        console.warn(`[satellites] ${type} failed:`, err.message);
      }
    })
  );

  if (allTLE.length === 0) {
    return NextResponse.json(
      {
        success: false,
        satellites: [],
        error: "Could not fetch TLE data from CelesTrak (celestrak.org). The service may be temporarily unavailable.",
      },
      { status: 503 }
    );
  }

  // Propagate to current positions and deduplicate by NORAD ID
  const seen = new Set<string>();
  const satellites = allTLE
    .map(propagateTLE)
    .filter((s): s is SatellitePosition => {
      if (!s) return false;
      if (isNaN(s.lat) || isNaN(s.lng)) return false;
      if (Math.abs(s.lat) > 90) return false;
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

  return NextResponse.json({
    success:    true,
    count:      satellites.length,
    satellites,
    source:     "CelesTrak GP Catalog (celestrak.org/NORAD/elements/gp.php)",
    updated:    new Date().toISOString(),
  });
}