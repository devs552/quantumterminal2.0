'use client';

import { create } from 'zustand';
import { MAP_LAYERS } from '@/lib/constants';

interface MapState {
  visibleLayers: string[];
  zoom: number;
  latitude: number;
  longitude: number;
  selectedFeature: any | null;
  hoverFeature: any | null;
  layerOpacity: Record<string, number>;
  layerIntensity: Record<string, number>;
  mapStyle: 'dark' | 'light';
  
  toggleLayer: (layerId: string) => void;
  setZoom: (zoom: number) => void;
  setCenter: (lat: number, lon: number) => void;
  selectFeature: (feature: any) => void;
  hoverFeatureFn: (feature: any) => void;
  setVisibleLayers: (layers: string[]) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  setLayerIntensity: (layerId: string, intensity: number) => void;
  toggleMapStyle: () => void;
}

const initialLayers = MAP_LAYERS.slice(0, 5).map(l => l.id);

export const useMapStore = create<MapState>((set) => ({
  visibleLayers: initialLayers,
  zoom: 2.5,
  latitude: 20,
  longitude: 0,
  selectedFeature: null,
  hoverFeature: null,
  layerOpacity: {},
  layerIntensity: {},
  mapStyle: 'dark',
  
  toggleLayer: (layerId) =>
    set((state) => ({
      visibleLayers: state.visibleLayers.includes(layerId)
        ? state.visibleLayers.filter(id => id !== layerId)
        : [...state.visibleLayers, layerId],
    })),
  
  setZoom: (zoom) => set({ zoom }),
  
  setCenter: (lat, lon) => set({ latitude: lat, longitude: lon }),
  
  selectFeature: (feature) => set({ selectedFeature: feature }),
  
  hoverFeatureFn: (feature) => set({ hoverFeature: feature }),
  
  setVisibleLayers: (layers) => set({ visibleLayers: layers }),
  
  setLayerOpacity: (layerId, opacity) =>
    set((state) => ({
      layerOpacity: { ...state.layerOpacity, [layerId]: opacity },
    })),
  
  setLayerIntensity: (layerId, intensity) =>
    set((state) => ({
      layerIntensity: { ...state.layerIntensity, [layerId]: intensity },
    })),
  
  toggleMapStyle: () =>
    set((state) => ({
      mapStyle: state.mapStyle === 'dark' ? 'light' : 'dark',
    })),
}));
