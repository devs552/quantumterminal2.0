import { NextResponse } from "next/server";

/**
 * Submarine Cable API
 *
 * Data: TeleGeography Submarine Cable Map (free, open data, CC BY 4.0)
 *
 * CORRECT live API endpoints (as of 2024/2025):
 *   https://www.submarinecablemap.com/api/v3/cable/cable-geo.json
 *   https://www.submarinecablemap.com/api/v3/landing-point/landing-point-geo.json
 *
 * NOTE: The old GitHub raw URL (raw.githubusercontent.com/telegeography/...) is dead.
 *       TeleGeography stopped maintaining the public GitHub repo.
 *       Use their live website API instead — it's always up to date.
 */

const TELEGEOGRAPHY_API = "https://www.submarinecablemap.com/api/v3";

interface CableFeature {
  type: string;
  properties: {
    id: string;
    name: string;
    color: string;
    owners?: string[];
    rfs?: string;
    length?: string;
    notes?: string;
    url?: string;
  };
  geometry: {
    type: string;
    coordinates: number[][] | number[][][];
  };
}

interface LandingPointFeature {
  type: string;
  properties: {
    id: string;
    name: string;
    country?: string;
    cables?: Array<{ name: string } | string>;
  };
  geometry: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
}

export async function GET() {
  try {
    // Fetch cables and landing points in parallel
    const [cableRes, lpRes] = await Promise.all([
      fetch(`${TELEGEOGRAPHY_API}/cable/cable-geo.json`, {
        headers: {
          "User-Agent": "QuantumTerminal/1.0",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(12_000),
        next: { revalidate: 86400 }, // Cache 24h — cable routes rarely change
      } as RequestInit),
      fetch(`${TELEGEOGRAPHY_API}/landing-point/landing-point-geo.json`, {
        headers: {
          "User-Agent": "QuantumTerminal/1.0",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(12_000),
        next: { revalidate: 86400 },
      } as RequestInit),
    ]);

    if (!cableRes.ok) {
      throw new Error(`TeleGeography cable API returned HTTP ${cableRes.status}. URL: ${TELEGEOGRAPHY_API}/cable/cable-geo.json`);
    }

    const cableGeoJson = await cableRes.json();

    // Process cable features
    const cables = (cableGeoJson.features || []).map((f: CableFeature) => ({
      id:          f.properties.id || "",
      name:        f.properties.name || "Unknown Cable",
      color:       f.properties.color || "#00aaff",
      owners:      f.properties.owners || [],
      rfs:         f.properties.rfs || null,
      length:      f.properties.length || null,
      notes:       f.properties.notes || "",
      url:         f.properties.url || "",
      geometry:    f.geometry,
    }));

    // Process landing points (best-effort — don't fail if this 404s)
    let landingPoints: unknown[] = [];
    if (lpRes.ok) {
      const lpGeoJson = await lpRes.json();
      landingPoints = (lpGeoJson.features || [])
        .filter((f: LandingPointFeature) => f.geometry?.type === "Point")
        .map((f: LandingPointFeature) => ({
          id:        f.properties.id || "",
          name:      f.properties.name || "",
          latitude:  f.geometry.coordinates[1],
          longitude: f.geometry.coordinates[0],
          country:   f.properties.country || "",
          cables:    (f.properties.cables || []).map(
            (c: { name: string } | string) => (typeof c === "string" ? c : c.name)
          ),
        }));
    }

    return NextResponse.json({
      success:              true,
      count:                cables.length,
      landing_points_count: landingPoints.length,
      cables,
      landingPoints,
      source:  "TeleGeography Submarine Cable Map · CC BY 4.0 (submarinecablemap.com)",
      updated: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[cables] fetch error:", err.message);
    return NextResponse.json(
      {
        success:      false,
        error:        err.message,
        cables:       [],
        landingPoints: [],
      },
      { status: 502 }
    );
  }
}