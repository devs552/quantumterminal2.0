import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export interface FinancialSite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  country: string;
  region: string;
  bbox: [number, number, number, number]; // [west, south, east, north]
  gibsLayer: string;
  gibsDate: string;
  // Use-case module
  module: 'oil_tank' | 'flaring' | 'parking' | 'ndvi' | 'maritime';
  // Module-specific data
  data: OilTankData | FlaringData | ParkingData | NdviData | MaritimeData;
}

export interface OilTankData {
  tankCount: number;
  estimatedVolumeMMbbl: number;
  shadowAngleDeg: number;
  fillLevelPct: number;
  weekOverWeekChangePct: number;
  operator: string;
  capacity: string;
}

export interface FlaringData {
  flaringIntensityMW: number;
  co2EstimateMtpa: number;
  flareCountActive: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  wellType: string;
  permitStatus: 'permitted' | 'unpermitted' | 'unknown';
}

export interface ParkingData {
  retailer: string;
  locationCount: number;
  avgOccupancyPct: number;
  weekOverWeekChangePct: number;
  vsSeasonalAvgPct: number;
  earningsDate: string;
  signalStrength: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
}

export interface NdviData {
  crop: string;
  ndviIndex: number;       // 0–1
  ndviVs5YrAvg: number;    // delta
  estimatedYieldMt: number;
  harvestDateEst: string;
  moistureStress: 'low' | 'moderate' | 'high';
  acreageMHa: number;
}

export interface MaritimeData {
  vesselCount: number;
  avgDraftM: number;
  avgDraftChangeM: number; // positive = more loaded
  commodityType: string;
  portCongestionScore: number; // 0–100
  waitingVessels: number;
  tradeRoute: string;
}

interface TLEEntry {
  name: string;
  line1: string;
  line2: string;
  type: string;
}

export interface SatellitePosition {
  id: string;
  name: string;
  lat: number;
  lng: number;
  alt: number;
  velocity: number;
  type: string;
  inclination: number;
  period: number;
  epoch: string;
}

export interface GibsLayer {
  id: string;
  label: string;
  description: string;
  tileUrl: string;
  attribution: string;
  maxZoom: number;
  useCase: FinancialSite['module'][];
}

// ─────────────────────────────────────────────────────────────────────────────
// GIBS LAYERS — matched to financial use cases
// ─────────────────────────────────────────────────────────────────────────────
const GIBS_LAYERS: GibsLayer[] = [
  {
    id: 'true_color',
    label: 'True Color (VIIRS)',
    description: 'Natural color — best for parking lot counting and maritime vessel detection',
    tileUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/2024-01-15/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    attribution: 'NASA GIBS / VIIRS SNPP',
    maxZoom: 9,
    useCase: ['parking', 'maritime', 'oil_tank'],
  },
  {
    id: 'nighttime_lights',
    label: 'Nighttime Lights (VIIRS DNB)',
    description: 'Detects industrial flaring and off-grid emissions at night',
    tileUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_DayNightBand_ENCC/default/2024-01-15/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
    attribution: 'NASA GIBS / VIIRS DNB',
    maxZoom: 8,
    useCase: ['flaring'],
  },
  {
    id: 'ndvi',
    label: 'Vegetation Index (MODIS NDVI)',
    description: 'Normalized Difference Vegetation Index for crop health monitoring',
    tileUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/2024-01-09/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
    attribution: 'NASA GIBS / MODIS Terra',
    maxZoom: 7,
    useCase: ['ndvi'],
  },
  {
    id: 'land_surface_temp',
    label: 'Land Surface Temp (MODIS)',
    description: 'Thermal anomalies reveal flaring activity and industrial heat signatures',
    tileUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/2024-01-15/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
    attribution: 'NASA GIBS / MODIS Terra LST',
    maxZoom: 7,
    useCase: ['flaring', 'oil_tank'],
  },
  {
    id: 'sea_surface_temp',
    label: 'Sea Surface Temp (MODIS)',
    description: 'Ocean temperature patterns affecting shipping lane efficiency',
    tileUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_L3_SST_MidIR_9km_Day_v2019.0/default/2024-01-15/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
    attribution: 'NASA GIBS / MODIS Terra SST',
    maxZoom: 7,
    useCase: ['maritime'],
  },
  {
    id: 'corrected_reflectance',
    label: 'Corrected Reflectance (MODIS)',
    description: 'High-contrast optical for infrastructure and vehicle detection',
    tileUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-01-15/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    attribution: 'NASA GIBS / MODIS Terra',
    maxZoom: 9,
    useCase: ['parking', 'oil_tank', 'maritime'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FINANCIAL INTELLIGENCE SITES
// ─────────────────────────────────────────────────────────────────────────────
const FINANCIAL_SITES: FinancialSite[] = [
  // ── OIL TANK SITES ─────────────────────────────────────────────────────────
  {
    id: 'cushing_ok',
    name: 'Cushing Tank Farm',
    lat: 35.985, lng: -96.767,
    country: 'USA', region: 'Oklahoma',
    bbox: [-96.85, 35.92, -96.68, 36.05],
    gibsLayer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    gibsDate: '2024-01-15',
    module: 'oil_tank',
    data: {
      tankCount: 342,
      estimatedVolumeMMbbl: 38.4,
      shadowAngleDeg: 34.2,
      fillLevelPct: 68,
      weekOverWeekChangePct: -2.3,
      operator: 'Multiple (Magellan, Plains, etc.)',
      capacity: '76 MMbbl (world\'s largest)',
    } as OilTankData,
  },
  {
    id: 'ras_tanura',
    name: 'Ras Tanura Terminal',
    lat: 26.645, lng: 50.162,
    country: 'Saudi Arabia', region: 'Eastern Province',
    bbox: [50.08, 26.58, 50.24, 26.71],
    gibsLayer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    gibsDate: '2024-01-15',
    module: 'oil_tank',
    data: {
      tankCount: 128,
      estimatedVolumeMMbbl: 22.1,
      shadowAngleDeg: 28.7,
      fillLevelPct: 81,
      weekOverWeekChangePct: 4.1,
      operator: 'Saudi Aramco',
      capacity: '33 MMbbl',
    } as OilTankData,
  },
  {
    id: 'rotterdam_port',
    name: 'Rotterdam Oil Terminal',
    lat: 51.916, lng: 4.142,
    country: 'Netherlands', region: 'South Holland',
    bbox: [4.02, 51.86, 4.26, 51.97],
    gibsLayer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    gibsDate: '2024-01-15',
    module: 'oil_tank',
    data: {
      tankCount: 89,
      estimatedVolumeMMbbl: 14.7,
      shadowAngleDeg: 22.1,
      fillLevelPct: 55,
      weekOverWeekChangePct: -5.8,
      operator: 'Vopak / Shell / BP',
      capacity: '28 MMbbl',
    } as OilTankData,
  },
  // ── FLARING SITES ──────────────────────────────────────────────────────────
  {
    id: 'permian_basin',
    name: 'Permian Basin Flaring',
    lat: 31.85, lng: -102.4,
    country: 'USA', region: 'West Texas',
    bbox: [-103.2, 31.2, -101.6, 32.5],
    gibsLayer: 'VIIRS_SNPP_DayNightBand_ENCC',
    gibsDate: '2024-01-15',
    module: 'flaring',
    data: {
      flaringIntensityMW: 847,
      co2EstimateMtpa: 4.2,
      flareCountActive: 312,
      trend: 'decreasing',
      wellType: 'Tight oil / shale',
      permitStatus: 'permitted',
    } as FlaringData,
  },
  {
    id: 'niger_delta',
    name: 'Niger Delta Flaring',
    lat: 5.2, lng: 6.1,
    country: 'Nigeria', region: 'Rivers / Delta State',
    bbox: [5.3, 4.6, 6.9, 5.8],
    gibsLayer: 'VIIRS_SNPP_DayNightBand_ENCC',
    gibsDate: '2024-01-15',
    module: 'flaring',
    data: {
      flaringIntensityMW: 2340,
      co2EstimateMtpa: 11.7,
      flareCountActive: 588,
      trend: 'stable',
      wellType: 'Conventional / offshore',
      permitStatus: 'unpermitted',
    } as FlaringData,
  },
  {
    id: 'xinjiang_flaring',
    name: 'Xinjiang Industrial Emissions',
    lat: 41.8, lng: 85.6,
    country: 'China', region: 'Xinjiang',
    bbox: [84.2, 41.0, 87.0, 42.6],
    gibsLayer: 'MODIS_Terra_Land_Surface_Temp_Day',
    gibsDate: '2024-01-15',
    module: 'flaring',
    data: {
      flaringIntensityMW: 1120,
      co2EstimateMtpa: 8.9,
      flareCountActive: 204,
      trend: 'increasing',
      wellType: 'Coal / industrial',
      permitStatus: 'unknown',
    } as FlaringData,
  },
  // ── PARKING / RETAIL ───────────────────────────────────────────────────────
  {
    id: 'walmart_us',
    name: 'Walmart US Portfolio Sample',
    lat: 36.35, lng: -94.21,
    country: 'USA', region: 'Multi-state',
    bbox: [-94.28, 36.29, -94.14, 36.41],
    gibsLayer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    gibsDate: '2024-01-15',
    module: 'parking',
    data: {
      retailer: 'Walmart (WMT)',
      locationCount: 4612,
      avgOccupancyPct: 73,
      weekOverWeekChangePct: 8.4,
      vsSeasonalAvgPct: 11.2,
      earningsDate: '2024-02-20',
      signalStrength: 'strong_buy',
    } as ParkingData,
  },
  {
    id: 'costco_us',
    name: 'Costco Wholesale Portfolio',
    lat: 47.60, lng: -122.33,
    country: 'USA', region: 'Multi-state',
    bbox: [-122.40, 47.55, -122.26, 47.65],
    gibsLayer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    gibsDate: '2024-01-15',
    module: 'parking',
    data: {
      retailer: 'Costco (COST)',
      locationCount: 591,
      avgOccupancyPct: 81,
      weekOverWeekChangePct: 3.1,
      vsSeasonalAvgPct: 5.4,
      earningsDate: '2024-03-07',
      signalStrength: 'buy',
    } as ParkingData,
  },
  {
    id: 'target_us',
    name: 'Target Corporation Portfolio',
    lat: 44.98, lng: -93.27,
    country: 'USA', region: 'Multi-state',
    bbox: [-93.35, 44.93, -93.19, 45.03],
    gibsLayer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    gibsDate: '2024-01-15',
    module: 'parking',
    data: {
      retailer: 'Target (TGT)',
      locationCount: 1956,
      avgOccupancyPct: 51,
      weekOverWeekChangePct: -4.7,
      vsSeasonalAvgPct: -8.3,
      earningsDate: '2024-03-05',
      signalStrength: 'sell',
    } as ParkingData,
  },
  // ── NDVI / AGRICULTURE ─────────────────────────────────────────────────────
  {
    id: 'ukraine_wheat',
    name: 'Ukraine Wheat Belt',
    lat: 48.5, lng: 33.2,
    country: 'Ukraine', region: 'Dnipropetrovsk / Zaporizhzhia',
    bbox: [31.0, 47.5, 35.4, 49.5],
    gibsLayer: 'MODIS_Terra_NDVI_8Day',
    gibsDate: '2024-01-09',
    module: 'ndvi',
    data: {
      crop: 'Winter Wheat',
      ndviIndex: 0.51,
      ndviVs5YrAvg: -0.12,
      estimatedYieldMt: 18.4,
      harvestDateEst: '2024-07-10',
      moistureStress: 'high',
      acreageMHa: 5.2,
    } as NdviData,
  },
  {
    id: 'brazil_soy',
    name: 'Mato Grosso Soybean',
    lat: -12.6, lng: -55.9,
    country: 'Brazil', region: 'Mato Grosso',
    bbox: [-57.5, -13.8, -54.3, -11.4],
    gibsLayer: 'MODIS_Terra_NDVI_8Day',
    gibsDate: '2024-01-09',
    module: 'ndvi',
    data: {
      crop: 'Soybean',
      ndviIndex: 0.74,
      ndviVs5YrAvg: 0.06,
      estimatedYieldMt: 42.1,
      harvestDateEst: '2024-03-15',
      moistureStress: 'low',
      acreageMHa: 11.8,
    } as NdviData,
  },
  {
    id: 'us_corn_belt',
    name: 'US Corn Belt (Iowa / Illinois)',
    lat: 41.9, lng: -92.4,
    country: 'USA', region: 'Midwest',
    bbox: [-94.8, 40.8, -90.0, 43.0],
    gibsLayer: 'MODIS_Terra_NDVI_8Day',
    gibsDate: '2024-01-09',
    module: 'ndvi',
    data: {
      crop: 'Corn / Maize',
      ndviIndex: 0.18,
      ndviVs5YrAvg: 0.02,
      estimatedYieldMt: 389.0,
      harvestDateEst: '2024-10-01',
      moistureStress: 'low',
      acreageMHa: 33.4,
    } as NdviData,
  },
  // ── MARITIME ───────────────────────────────────────────────────────────────
  {
    id: 'strait_of_hormuz',
    name: 'Strait of Hormuz',
    lat: 26.58, lng: 56.25,
    country: 'International', region: 'Persian Gulf',
    bbox: [55.8, 26.1, 56.7, 27.1],
    gibsLayer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    gibsDate: '2024-01-15',
    module: 'maritime',
    data: {
      vesselCount: 47,
      avgDraftM: 14.8,
      avgDraftChangeM: 0.6,
      commodityType: 'Crude Oil / LNG',
      portCongestionScore: 72,
      waitingVessels: 12,
      tradeRoute: 'Persian Gulf → Asia / Europe',
    } as MaritimeData,
  },
  {
    id: 'suez_canal',
    name: 'Suez Canal Transit Zone',
    lat: 30.42, lng: 32.35,
    country: 'Egypt', region: 'Suez Governorate',
    bbox: [32.25, 29.9, 32.60, 30.95],
    gibsLayer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    gibsDate: '2024-01-15',
    module: 'maritime',
    data: {
      vesselCount: 38,
      avgDraftM: 12.4,
      avgDraftChangeM: -0.3,
      commodityType: 'Mixed (container / bulk / tanker)',
      portCongestionScore: 85,
      waitingVessels: 21,
      tradeRoute: 'Asia / Middle East → Europe',
    } as MaritimeData,
  },
  {
    id: 'singapore_strait',
    name: 'Singapore Strait',
    lat: 1.27, lng: 103.85,
    country: 'Singapore', region: 'Malacca / Singapore',
    bbox: [103.55, 1.05, 104.15, 1.49],
    gibsLayer: 'MODIS_Terra_L3_SST_MidIR_9km_Day_v2019.0',
    gibsDate: '2024-01-15',
    module: 'maritime',
    data: {
      vesselCount: 92,
      avgDraftM: 11.1,
      avgDraftChangeM: 0.2,
      commodityType: 'Container / Petrochemicals',
      portCongestionScore: 61,
      waitingVessels: 8,
      tradeRoute: 'East Asia → Europe / Middle East',
    } as MaritimeData,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TLE SATELLITE TRACKING
// ─────────────────────────────────────────────────────────────────────────────
const TLE_SOURCES = [
  { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle', type: 'Space Station' },
  { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle', type: 'Starlink', max: 80 },
  { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle', type: 'Weather', max: 20 },
  { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=geo&FORMAT=tle', type: 'GEO', max: 40 },
  { url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle', type: 'Observation', max: 40 },
];

function parseTLE(text: string, type: string): TLEEntry[] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const out: TLEEntry[] = [];
  for (let i = 0; i < lines.length - 2; i++) {
    if (lines[i + 1].startsWith('1 ') && lines[i + 2].startsWith('2 ')) {
      out.push({ name: lines[i].replace(/^0 /, '').trim(), line1: lines[i + 1], line2: lines[i + 2], type });
      i += 2;
    }
  }
  return out;
}

function propagateTLE(tle: TLEEntry): SatellitePosition | null {
  try {
    const L1 = tle.line1, L2 = tle.line2;
    const epochYear2 = parseInt(L1.substring(18, 20), 10);
    const epochDay   = parseFloat(L1.substring(20, 32));
    const inclDeg    = parseFloat(L2.substring(8, 16));
    const raanDeg    = parseFloat(L2.substring(17, 25));
    const ecc        = parseFloat('0.' + L2.substring(26, 33).trim());
    const argPDeg    = parseFloat(L2.substring(34, 42));
    const maDeg      = parseFloat(L2.substring(43, 51));
    const mmRevPerDay = parseFloat(L2.substring(52, 63));
    const noradId    = L2.substring(2, 7).trim();

    if (isNaN(inclDeg) || isNaN(mmRevPerDay) || mmRevPerDay <= 0) return null;

    const fullYear = epochYear2 < 57 ? 2000 + epochYear2 : 1900 + epochYear2;
    const epochMs  = Date.UTC(fullYear, 0, 1) + (epochDay - 1) * 86_400_000;
    const dtMin    = (Date.now() - epochMs) / 60_000;

    const GM  = 398_600.4418;
    const n   = mmRevPerDay * 2 * Math.PI / 1440;
    const nS  = n / 60;
    const a   = Math.cbrt(GM / (nS * nS));
    const T   = 1440 / mmRevPerDay;

    const maRad = ((maDeg + mmRevPerDay * 360 * dtMin / 1440) % 360) * Math.PI / 180;
    let E = maRad;
    for (let i = 0; i < 5; i++) E = E - (E - ecc * Math.sin(E) - maRad) / (1 - ecc * Math.cos(E));

    const nu = 2 * Math.atan2(Math.sqrt(1 + ecc) * Math.sin(E / 2), Math.sqrt(1 - ecc) * Math.cos(E / 2));
    const r  = a * (1 - ecc * Math.cos(E));
    const alt = r - 6371;

    const incl = inclDeg * Math.PI / 180;
    const argP = argPDeg * Math.PI / 180;
    const raan = raanDeg * Math.PI / 180;
    const u    = argP + nu;

    const xECI = r * (Math.cos(raan) * Math.cos(u) - Math.sin(raan) * Math.sin(u) * Math.cos(incl));
    const yECI = r * (Math.sin(raan) * Math.cos(u) + Math.cos(raan) * Math.sin(u) * Math.cos(incl));
    const zECI = r * Math.sin(incl) * Math.sin(u);

    const jd      = 2_440_587.5 + Date.now() / 86_400_000;
    const Tj      = (jd - 2_451_545.0) / 36_525;
    const gmstDeg = (280.46061837 + 360.98564736629 * (jd - 2_451_545.0) + 0.000387933 * Tj * Tj) % 360;
    const gmstRad = gmstDeg * Math.PI / 180;

    const xE =  xECI * Math.cos(gmstRad) + yECI * Math.sin(gmstRad);
    const yE = -xECI * Math.sin(gmstRad) + yECI * Math.cos(gmstRad);
    const zE =  zECI;

    const lng = Math.atan2(yE, xE) * 180 / Math.PI;
    const lat = Math.atan2(zE, Math.sqrt(xE ** 2 + yE ** 2)) * 180 / Math.PI;
    const velocity = Math.sqrt(GM * (2 / r - 1 / a));

    return {
      id: noradId, name: tle.name, type: tle.type,
      lat: parseFloat(lat.toFixed(4)), lng: parseFloat(lng.toFixed(4)),
      alt: parseFloat(Math.max(0, alt).toFixed(1)),
      velocity: parseFloat(velocity.toFixed(3)),
      inclination: parseFloat(inclDeg.toFixed(2)),
      period: parseFloat(T.toFixed(1)),
      epoch: new Date(epochMs).toISOString(),
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'sites'; // 'sites' | 'satellites' | 'all'

  // ── Sites + Layers ─────────────────────────────────────────────────────────
  if (type === 'sites' || type === 'all') {
    if (type === 'sites') {
      return NextResponse.json({
        success: true,
        sites: FINANCIAL_SITES,
        layers: GIBS_LAYERS,
        updated: new Date().toISOString(),
      });
    }
  }

  // ── Satellite TLE positions ────────────────────────────────────────────────
  if (type === 'satellites' || type === 'all') {
    const allTLE: TLEEntry[] = [];

    await Promise.allSettled(
      TLE_SOURCES.map(async ({ url, type: satType, max }) => {
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'FinancialSatelliteIntelligence/1.0' },
            signal: AbortSignal.timeout(10_000),
            // @ts-ignore Next.js ISR cache
            next: { revalidate: 7200 },
          });
          if (!res.ok) return;
          const text = await res.text();
          if (!text || text.includes('<!DOCTYPE')) return;
          let entries = parseTLE(text, satType);
          if (max) entries = entries.slice(0, max);
          allTLE.push(...entries);
        } catch { /* silently skip failed sources */ }
      })
    );

    const seen = new Set<string>();
    const satellites = allTLE
      .map(propagateTLE)
      .filter((s): s is SatellitePosition => {
        if (!s || isNaN(s.lat) || isNaN(s.lng) || Math.abs(s.lat) > 90) return false;
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

    if (type === 'satellites') {
      return NextResponse.json({
        success: satellites.length > 0,
        count: satellites.length,
        satellites,
        source: 'CelesTrak GP Catalog',
        updated: new Date().toISOString(),
      });
    }

    // type === 'all'
    return NextResponse.json({
      success: true,
      sites: FINANCIAL_SITES,
      layers: GIBS_LAYERS,
      satellites,
      updated: new Date().toISOString(),
    });
  }

  return NextResponse.json({ success: false, error: 'Invalid type param. Use: sites | satellites | all' }, { status: 400 });
}