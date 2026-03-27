// app/api/transport/flights/route.ts
// Real-time flight data from OpenSky Network (free, no API key required)
// Docs: https://openskynetwork.github.io/opensky-api/rest.html

import { NextResponse } from 'next/server';

export interface Flight {
  icao24: string;       // Unique ICAO 24-bit address (hex)
  callsign: string;
  origin_country: string;
  lat: number;
  lng: number;
  altitude: number;     // meters
  velocity: number;     // m/s
  heading: number;      // degrees
  vertical_rate: number;
  on_ground: boolean;
  squawk: string;
}

interface OpenSkyResponse {
  time: number;
  states: (string | number | boolean | null)[][] | null;
}

// OpenSky field indices
const IDX = {
  icao24: 0, callsign: 1, origin_country: 2, time_position: 3,
  last_contact: 4, longitude: 5, latitude: 6, baro_altitude: 7,
  on_ground: 8, velocity: 9, true_track: 10, vertical_rate: 11,
  sensors: 12, geo_altitude: 13, squawk: 14, spi: 15, position_source: 16,
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; QuantumTerminal/1.0)',
  'Accept': 'application/json',
};

export async function GET() {
  try {
    // Fetch all live aircraft — OpenSky provides free global data
    const res = await fetch(
      'https://opensky-network.org/api/states/all',
      { headers: HEADERS, next: { revalidate: 15 } }
    );

    if (!res.ok) {
      throw new Error(`OpenSky returned ${res.status}`);
    }

    const raw: OpenSkyResponse = await res.json();
    const states = raw.states ?? [];

    // Filter and transform
    const flights: Flight[] = [];

    for (const s of states) {
      const lat      = s[IDX.latitude]   as number | null;
      const lng      = s[IDX.longitude]  as number | null;
      const onGround = s[IDX.on_ground]  as boolean;
      const callsign = ((s[IDX.callsign] as string) ?? '').trim();
      const altitude = (s[IDX.baro_altitude] as number | null) ?? 0;

      // Skip: on ground, no position, no callsign, or very low altitude
      if (!lat || !lng || onGround || !callsign || altitude < 1000) continue;

      flights.push({
        icao24:         (s[IDX.icao24]        as string) ?? '',
        callsign,
        origin_country: (s[IDX.origin_country] as string) ?? '',
        lat,
        lng,
        altitude:       altitude,
        velocity:       (s[IDX.velocity]       as number | null) ?? 0,
        heading:        (s[IDX.true_track]     as number | null) ?? 0,
        vertical_rate:  (s[IDX.vertical_rate]  as number | null) ?? 0,
        on_ground:      false,
        squawk:         (s[IDX.squawk]         as string | null) ?? '',
      });
    }

    // Limit to 300 flights for performance (sample evenly across the globe)
    const sampled = flights.length > 300
      ? flights.filter((_, i) => i % Math.floor(flights.length / 300) === 0).slice(0, 300)
      : flights;

    return NextResponse.json({
      success: true,
      count: sampled.length,
      total_airborne: flights.length,
      timestamp: raw.time,
      fetchedAt: Date.now(),
      flights: sampled,
      source: 'OpenSky Network (opensky-network.org)',
    });

  } catch (err) {
    console.error('[flights]', err);

    // Graceful fallback with empty data
    return NextResponse.json({
      success: false,
      count: 0,
      total_airborne: 0,
      timestamp: Math.floor(Date.now() / 1000),
      fetchedAt: Date.now(),
      flights: [],
      error: err instanceof Error ? err.message : 'Failed to fetch flight data',
      source: 'OpenSky Network (failed)',
    }, { status: 502 });
  }
}