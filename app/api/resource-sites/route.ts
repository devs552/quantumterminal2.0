import { NextResponse } from "next/server";

export const revalidate = 3600;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export interface ResourceSite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: "oil" | "gas" | "gold" | "mineral";
  subtype: string;
  description: string;
  reserves?: string;
  country: string;
  production?: string;
  /** Bounding box [west, south, east, north] for NASA WMS snapshot */
  bbox: [number, number, number, number];
  /** NASA GIBS WMS layer best suited for this site */
  gibsLayer: string;
  /** Date for the GIBS snapshot (YYYY-MM-DD) */
  gibsDate: string;
}

export interface GibsLayer {
  id: string;
  label: string;
  description: string;
  /** WMTS tile URL template for Leaflet */
  tileUrl: string;
  attribution: string;
  maxZoom: number;
  format: "jpg" | "png";
}

// ─────────────────────────────────────────────────────────────────────────────
// NASA GIBS LAYERS
// All are free, no API key required.
// Base: https://gibs.earthdata.nasa.gov/wmts/epsg3857/best
// ─────────────────────────────────────────────────────────────────────────────
const GIBS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

function gibsTile(layer: string, date: string, format: "jpg" | "png") {
  return `${GIBS_BASE}/${layer}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.${format}`;
}

// Dynamic dates
const today = new Date();
const fmt = (d: Date) => d.toISOString().split("T")[0];
const daysAgo = (n: number) => fmt(new Date(Date.now() - n * 864e5));

const LAYERS: GibsLayer[] = [
  {
    id: "true_color",
    label: "True Color (MODIS Terra)",
    description: "Daily true-color imagery. Best for visualizing surface features, land use, and large-scale extraction sites.",
    tileUrl: gibsTile("MODIS_Terra_CorrectedReflectance_TrueColor", daysAgo(1), "jpg"),
    attribution: "NASA GIBS / MODIS Terra",
    maxZoom: 9,
    format: "jpg",
  },
  {
    id: "viirs_night",
    label: "Night Lights (VIIRS)",
    description: "Nighttime lights reveal gas flaring at oil fields, mining operations, and industrial activity invisible by day.",
    tileUrl: gibsTile("VIIRS_SNPP_DayNightBand_ENCC", daysAgo(3), "png"),
    attribution: "NASA GIBS / VIIRS Suomi NPP",
    maxZoom: 8,
    format: "png",
  },
  {
    id: "thermal",
    label: "Land Surface Temp (MODIS)",
    description: "Thermal anomalies expose geothermal zones, heavy industry, and subsurface heat — key indicators for mineral exploration.",
    tileUrl: gibsTile("MODIS_Terra_Land_Surface_Temp_Day", daysAgo(1), "png"),
    attribution: "NASA GIBS / MODIS Terra LST",
    maxZoom: 7,
    format: "png",
  },
  {
    id: "ndvi",
    label: "Vegetation Index (NDVI)",
    description: "Low NDVI (bare soil) zones correlate with open-pit mines, tailing ponds, and arid mineral belts.",
    tileUrl: gibsTile("MODIS_Terra_NDVI_8Day", daysAgo(8), "png"),
    attribution: "NASA GIBS / MODIS NDVI",
    maxZoom: 7,
    format: "png",
  },
  {
    id: "sar_backscatter",
    label: "False Color (MODIS Bands 7-2-1)",
    description: "Shortwave infrared false color enhances bare rock, soil, and mineral alteration zones invisible in true color.",
    tileUrl: gibsTile("MODIS_Terra_CorrectedReflectance_Bands721", daysAgo(1), "jpg"),
    attribution: "NASA GIBS / MODIS Bands 7-2-1",
    maxZoom: 9,
    format: "jpg",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// RESOURCE SITES DATABASE
// Curated major global deposits visible / studied via satellite
// ─────────────────────────────────────────────────────────────────────────────
const SITES: ResourceSite[] = [
  // ── OIL ──────────────────────────────────────────────────────────────────
  {
    id: "ghawar",
    name: "Ghawar Oil Field",
    lat: 24.8, lng: 49.1,
    type: "oil", subtype: "Conventional Crude",
    description: "The world's largest conventional oil field, stretching 280km through the Arabian Peninsula. Gas flaring visible from space at night.",
    reserves: "~48 billion barrels",
    production: "~3.8 million bbl/day",
    country: "Saudi Arabia",
    bbox: [47.5, 23.0, 51.0, 27.0],
    gibsLayer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    gibsDate: daysAgo(2),
  },
  {
    id: "burgan",
    name: "Greater Burgan Field",
    lat: 28.9, lng: 47.9,
    type: "oil", subtype: "Conventional Crude",
    description: "Second-largest oil field in the world. Oil lakes from the 1991 Gulf War fires are still visible in MODIS imagery.",
    reserves: "~66 billion barrels",
    production: "~1.7 million bbl/day",
    country: "Kuwait",
    bbox: [46.5, 27.5, 49.5, 30.5],
    gibsLayer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    gibsDate: daysAgo(2),
  },
  {
    id: "orinoco",
    name: "Orinoco Heavy Oil Belt",
    lat: 8.5, lng: -63.8,
    type: "oil", subtype: "Heavy Oil / Bitumen",
    description: "World's largest proven oil reserve. Extra-heavy crude requires massive surface upgrading plants visible as industrial complexes.",
    reserves: "~300 billion barrels",
    country: "Venezuela",
    bbox: [-67.0, 6.5, -60.0, 10.5],
    gibsLayer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    gibsDate: daysAgo(2),
  },
  {
    id: "permian",
    name: "Permian Basin",
    lat: 31.8, lng: -102.5,
    type: "oil", subtype: "Shale / Tight Oil",
    description: "America's most prolific oil basin. Dense flaring from natural gas burn-off makes it one of the brightest spots in NASA nighttime imagery.",
    production: "~6 million bbl/day",
    country: "USA",
    bbox: [-105.5, 29.5, -99.5, 34.5],
    gibsLayer: "VIIRS_SNPP_DayNightBand_ENCC",
    gibsDate: daysAgo(3),
  },
  {
    id: "west_siberia",
    name: "West Siberia Oil Basin",
    lat: 61.5, lng: 72.5,
    type: "oil", subtype: "Conventional Crude",
    description: "Largest oil and gas province on Earth. Samotlor and Priobskoye fields. Extensive pipeline networks visible in satellite imagery.",
    reserves: "~144 billion barrels (total basin)",
    country: "Russia",
    bbox: [68.0, 58.0, 78.0, 66.0],
    gibsLayer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    gibsDate: daysAgo(2),
  },
  // ── GAS ──────────────────────────────────────────────────────────────────
  {
    id: "north_dome",
    name: "North Dome / South Pars",
    lat: 26.8, lng: 52.5,
    type: "gas", subtype: "Natural Gas",
    description: "World's largest single natural gas reservoir shared between Qatar and Iran. LNG export terminals visible from orbit.",
    reserves: "~51 trillion m³",
    country: "Qatar / Iran",
    bbox: [50.0, 25.0, 55.0, 29.0],
    gibsLayer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    gibsDate: daysAgo(2),
  },
  {
    id: "urengoy",
    name: "Urengoy Gas Field",
    lat: 66.0, lng: 76.5,
    type: "gas", subtype: "Natural Gas",
    description: "World's second-largest natural gas field. Arctic infrastructure and compressor stations form a distinctive industrial footprint.",
    reserves: "~10.2 trillion m³",
    country: "Russia",
    bbox: [73.0, 63.5, 80.5, 68.5],
    gibsLayer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    gibsDate: daysAgo(2),
  },
  {
    id: "niger_delta",
    name: "Niger Delta Gas Flares",
    lat: 5.0, lng: 6.5,
    type: "gas", subtype: "Associated Gas Flaring",
    description: "One of the world's most intense gas flaring regions. Nigeria flares more gas than any other country — the flares are visible from the ISS.",
    country: "Nigeria",
    bbox: [4.0, 3.5, 9.0, 7.0],
    gibsLayer: "VIIRS_SNPP_DayNightBand_ENCC",
    gibsDate: daysAgo(3),
  },
  // ── GOLD ─────────────────────────────────────────────────────────────────
  {
    id: "witwatersrand",
    name: "Witwatersrand Gold Belt",
    lat: -26.3, lng: 27.5,
    type: "gold", subtype: "Reef Gold",
    description: "Produced over 50% of all gold mined in history. Massive tailings dams (yellowish/grey dumps) extend for hundreds of km and are clearly visible from space.",
    reserves: "~50,000 tonnes extracted",
    country: "South Africa",
    bbox: [25.5, -27.5, 29.5, -24.5],
    gibsLayer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    gibsDate: daysAgo(2),
  },
  {
    id: "madre_de_dios",
    name: "Madre de Dios Gold Mining",
    lat: -11.5, lng: -69.5,
    type: "gold", subtype: "Alluvial / Artisanal",
    description: "Illegal alluvial gold mining leaves devastating bare-earth scars in the Amazon rainforest. Mercury contamination plumes visible in false-color imagery.",
    country: "Peru",
    bbox: [-72.0, -13.5, -67.0, -9.5],
    gibsLayer: "MODIS_Terra_CorrectedReflectance_Bands721",
    gibsDate: daysAgo(2),
  },
  {
    id: "kalgoorlie",
    name: "Kalgoorlie Super Pit",
    lat: -30.77, lng: 121.5,
    type: "gold", subtype: "Open-Pit Gold",
    description: "One of the world's largest open-pit gold mines — 3.5km long, 1.5km wide, 600m deep. The pit is easily visible from satellite and even the ISS.",
    production: "~500,000 oz/year",
    country: "Australia",
    bbox: [120.5, -31.5, 122.5, -30.0],
    gibsLayer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    gibsDate: daysAgo(2),
  },
  {
    id: "kumtor",
    name: "Kumtor Gold Mine",
    lat: 41.85, lng: 78.2,
    type: "gold", subtype: "High-Altitude Open-Pit",
    description: "Central Asia's largest gold mine at 4,000m altitude. Glacial stripping for gold access creates dramatic melt patterns visible in satellite imagery.",
    country: "Kyrgyzstan",
    bbox: [77.0, 41.0, 79.5, 42.7],
    gibsLayer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    gibsDate: daysAgo(2),
  },
  // ── MINERALS ─────────────────────────────────────────────────────────────
  {
    id: "atacama_lithium",
    name: "Atacama Lithium Brines",
    lat: -23.5, lng: -68.2,
    type: "mineral", subtype: "Lithium / Salt Flat",
    description: "World's largest lithium reserve. Evaporation ponds in the Atacama salt flat create vivid turquoise/yellow geometric patterns — among the most striking satellite images on Earth.",
    reserves: "~9.2 million tonnes Li",
    country: "Chile",
    bbox: [-69.5, -25.0, -67.0, -22.0],
    gibsLayer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    gibsDate: daysAgo(2),
  },
  {
    id: "carajas",
    name: "Carajás Iron Ore Mine",
    lat: -6.1, lng: -50.3,
    type: "mineral", subtype: "Iron Ore",
    description: "World's largest iron ore mine by reserves. Cut into the Amazon plateau, the 50km² open pit and rail corridors are visible in true-color imagery.",
    reserves: "~7.2 billion tonnes",
    production: "~170 million tonnes/year",
    country: "Brazil",
    bbox: [-51.5, -7.0, -49.0, -5.0],
    gibsLayer: "MODIS_Terra_CorrectedReflectance_Bands721",
    gibsDate: daysAgo(2),
  },
  {
    id: "norilsk",
    name: "Norilsk Nickel Complex",
    lat: 69.35, lng: 88.2,
    type: "mineral", subtype: "Nickel / Palladium / Copper",
    description: "World's largest nickel and palladium producer. SO₂ pollution is so severe it kills vegetation for 30km — the dead zone is visible in NDVI imagery.",
    production: "~200,000 tonnes Ni/year",
    country: "Russia",
    bbox: [86.5, 68.0, 90.0, 70.5],
    gibsLayer: "MODIS_Terra_NDVI_8Day",
    gibsDate: daysAgo(8),
  },
  {
    id: "bingham_canyon",
    name: "Bingham Canyon Copper Mine",
    lat: 40.52, lng: -112.15,
    type: "mineral", subtype: "Copper (Open-Pit)",
    description: "Largest man-made excavation on Earth — 4km wide and 1.2km deep. The spiral terraced pit is immediately recognizable in any satellite view.",
    production: "~300,000 tonnes Cu/year",
    country: "USA",
    bbox: [-113.0, 40.0, -111.5, 41.2],
    gibsLayer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    gibsDate: daysAgo(2),
  },
  {
    id: "pilbara",
    name: "Pilbara Iron & Minerals",
    lat: -22.5, lng: 118.5,
    type: "mineral", subtype: "Iron Ore / Manganese",
    description: "Australia's iron ore heartland. Red-banded iron formations (BIF) give the landscape a vivid red color in true-color imagery. Home to Rio Tinto, BHP and FMG mega-mines.",
    production: "~900 million tonnes Fe/year (region)",
    country: "Australia",
    bbox: [116.0, -24.5, 121.5, -20.5],
    gibsLayer: "MODIS_Terra_CorrectedReflectance_Bands721",
    gibsDate: daysAgo(2),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type"); // oil | gas | gold | mineral | null=all

  const sites = typeFilter
    ? SITES.filter((s) => s.type === typeFilter)
    : SITES;

  return NextResponse.json({
    success: true,
    sites,
    layers: LAYERS,
    totalSites: SITES.length,
    updatedAt: Date.now(),
    attribution:
      "Imagery: NASA GIBS (gibs.earthdata.nasa.gov) · No API key required · CC0 / Public Domain",
  });
}