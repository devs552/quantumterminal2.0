// GeoJSON Layer Definitions for MapLibre GL
// These define all the geospatial data layers displayed on the global map

export interface LayerConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  intensity: number; // 0-1 for glow
  minZoom: number;
  maxZoom: number;
  paint: Record<string, any>;
  layout: Record<string, any>;
  source: {
    type: 'geojson' | 'vector' | 'raster';
    data?: any;
    url?: string;
  };
}

// Layer Configurations - Ready for MapLibre GL implementation
export const GEOJSON_LAYERS: Record<string, LayerConfig> = {
  // Intelligence & Risk Layers
  intelHotspots: {
    id: 'intel-hotspots',
    name: 'Intelligence Hotspots',
    icon: '🎯',
    color: '#00D9FF', // Cyan
    intensity: 0.8,
    minZoom: 2,
    maxZoom: 24,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3, 12, 8],
      'circle-color': '#00D9FF',
      'circle-opacity': 0.8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#00D9FF',
      'circle-stroke-opacity': 0.4,
    },
    layout: {},
    source: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [], // Populated from API
      },
    },
  },

  conflictZones: {
    id: 'conflict-zones',
    name: 'Conflict Zones',
    icon: '⚔',
    color: '#FF0000', // Red
    intensity: 0.9,
    minZoom: 2,
    maxZoom: 24,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 12, 10],
      'circle-color': '#FF0000',
      'circle-opacity': 0.7,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FF0000',
      'circle-stroke-opacity': 0.5,
    },
    layout: {},
    source: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    },
  },

  militaryBases: {
    id: 'military-bases',
    name: 'Military Bases',
    icon: '🏛',
    color: '#FFB800', // Amber
    intensity: 0.6,
    minZoom: 3,
    maxZoom: 24,
    paint: {
      'circle-radius': 5,
      'circle-color': '#FFB800',
      'circle-opacity': 0.7,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#FFB800',
    },
    layout: {},
    source: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    },
  },

  // Infrastructure Layers
  nuclearSites: {
    id: 'nuclear-sites',
    name: 'Nuclear Sites',
    icon: '☢',
    color: '#FF0000',
    intensity: 0.95,
    minZoom: 3,
    maxZoom: 24,
    paint: {
      'circle-radius': 6,
      'circle-color': '#FF0000',
      'circle-opacity': 0.8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FF0000',
    },
    layout: {},
    source: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    },
  },

  spaceports: {
    id: 'spaceports',
    name: 'Spaceports',
    icon: '🚀',
    color: '#00D9FF',
    intensity: 0.7,
    minZoom: 3,
    maxZoom: 24,
    paint: {
      'circle-radius': 5,
      'circle-color': '#00D9FF',
      'circle-opacity': 0.7,
    },
    layout: {},
    source: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    },
  },

  underseaCables: {
    id: 'undersea-cables',
    name: 'Undersea Cables',
    icon: '🔌',
    color: '#0099FF',
    intensity: 0.5,
    minZoom: 2,
    maxZoom: 24,
    paint: {
      'line-color': '#0099FF',
      'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1, 12, 3],
      'line-opacity': 0.6,
    },
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    source: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    },
  },

  pipelines: {
    id: 'pipelines',
    name: 'Pipelines',
    icon: '🛢',
    color: '#FF8C00',
    intensity: 0.5,
    minZoom: 3,
    maxZoom: 24,
    paint: {
      'line-color': '#FF8C00',
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1, 12, 2],
      'line-opacity': 0.6,
      'line-dasharray': [2, 2],
    },
    layout: {
      'line-join': 'round',
    },
    source: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    },
  },

  dataCenters: {
    id: 'data-centers',
    name: 'AI Data Centers',
    icon: '🖥',
    color: '#00D9FF',
    intensity: 0.75,
    minZoom: 3,
    maxZoom: 24,
    paint: {
      'circle-radius': 5,
      'circle-color': '#00D9FF',
      'circle-opacity': 0.8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#00D9FF',
    },
    layout: {},
    source: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    },
  },

  // Transportation Layers
  shipTraffic: {
    id: 'ship-traffic',
    name: 'Ship Traffic',
    icon: '🚢',
    color: '#0099FF',
    intensity: 0.4,
    minZoom: 2,
    maxZoom: 24,
    paint: {
      'line-color': '#0099FF',
      'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 12, 2],
      'line-opacity': 0.4,
    },
    layout: {
      'line-join': 'round',
    },
    source: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    },
  },

  flightActivity: {
    id: 'flight-activity',
    name: 'Flight Activity',
    icon: '✈',
    color: '#00FF00',
    intensity: 0.3,
    minZoom: 2,
    maxZoom: 24,
    paint: {
      'circle-radius': 3,
      'circle-color': '#00FF00',
      'circle-opacity': 0.5,
    },
    layout: {},
    source: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    },
  },

  // Event Layers
  protests: {
    id: 'protests',
    name: 'Protests & Demonstrations',
    icon: '📢',
    color: '#FFB800',
    intensity: 0.7,
    minZoom: 3,
    maxZoom: 24,
    paint: {
      'circle-radius': 5,
      'circle-color': '#FFB800',
      'circle-opacity': 0.7,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#FFB800',
    },
    layout: {},
    source: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    },
  },

  displacement: {
    id: 'displacement',
    name: 'Population Displacement',
    icon: '👥',
    color: '#FF0000',
    intensity: 0.8,
    minZoom: 2,
    maxZoom: 24,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 2, 12, 6],
      'circle-color': '#FF0000',
      'circle-opacity': 0.6,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#FF0000',
    },
    layout: {},
    source: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    },
  },

  // Natural Hazards
  weather: {
    id: 'weather-alerts',
    name: 'Weather Alerts',
    icon: '⛈',
    color: '#00FF00',
    intensity: 0.6,
    minZoom: 2,
    maxZoom: 24,
    paint: {
      'circle-radius': 4,
      'circle-color': '#00FF00',
      'circle-opacity': 0.6,
    },
    layout: {},
    source: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    },
  },

  earthquakes: {
    id: 'earthquakes',
    name: 'Earthquakes & Seismic',
    icon: '🌋',
    color: '#FF0000',
    intensity: 0.85,
    minZoom: 2,
    maxZoom: 24,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['feature-state', 'magnitude'], 3, 5, 8, 15],
      'circle-color': '#FF0000',
      'circle-opacity': 0.7,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#FF0000',
    },
    layout: {},
    source: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    },
  },
};

// Helper function to generate sample GeoJSON feature
export function createFeature(
  id: string,
  lat: number,
  lon: number,
  properties: Record<string, any> = {}
) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lon, lat],
    },
    properties: {
      id,
      ...properties,
    },
  };
}

// Generate sample data for demo
export function generateSampleGeodata() {
  const samples: Record<string, any> = {};

  Object.entries(GEOJSON_LAYERS).forEach(([key, layer]) => {
    const features = [];

    // Generate 3-5 random points for each layer
    for (let i = 0; i < Math.floor(Math.random() * 3) + 2; i++) {
      const lat = Math.random() * 180 - 90;
      const lon = Math.random() * 360 - 180;

      features.push(
        createFeature(`${key}-${i}`, lat, lon, {
          severity: Math.floor(Math.random() * 10),
          lastUpdated: new Date().toISOString(),
        })
      );
    }

    samples[key] = {
      type: 'FeatureCollection',
      features,
    };
  });

  return samples;
}
