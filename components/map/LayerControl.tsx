'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { useMapStore } from '@/store/mapStore';
import { MAP_LAYERS } from '@/lib/constants';

// ✅ Group MAP_LAYERS by category using the actual IDs from constants.ts
// This guarantees LayerControl IDs always match what the store uses.

const LAYER_CATEGORIES: Record<string, string[]> = {
  Intelligence: [
    'intel-hotspots',
    'conflict-zones',
    'military-bases',
    'military-activity',
  ],
  Infrastructure: [
    'nuclear-sites',
    'spaceports',
    'undersea-cables',
    'pipelines',
    'data-centers',
    'strategic-waterways',
    'economic-centers',
    'critical-minerals',
  ],
  Transportation: [
    'ship-traffic',
    'flight-delays',
  ],
  Events: [
    'protests',
    'displacement',
    'fires',
    'natural-events',
  ],
  Environment: [
    'climate-anomalies',
    'weather-alerts',
  ],
  Cyber: [
    'internet-outages',
    'cyber-threats',
  ],
};

// Build a lookup map from MAP_LAYERS so we can get displayName/name by ID
const LAYER_LOOKUP = new Map(MAP_LAYERS.map(l => [l.id, l]));

export function LayerControl({ onToggleLayer }: { onToggleLayer: (id: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(Object.keys(LAYER_CATEGORIES).map((cat, i) => [cat, i === 0]))
  );

  // ✅ visibleLayers is string[] — use .includes() for lookup
  const visibleLayers = useMapStore((state) => state.visibleLayers);

  const toggleCategory = (cat: string) =>
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="glass-panel p-2 text-xs font-mono text-primary hover:bg-primary/20 transition-all"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="glass-panel w-52 max-h-[28rem] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/30 sticky top-0 bg-[#0F1432] z-10">
        <span className="text-xs font-mono text-primary tracking-wider">MAP LAYERS</span>
        <button
          onClick={() => setExpanded(false)}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      <div className="p-2 space-y-1">
        {Object.entries(LAYER_CATEGORIES).map(([category, layerIds]) => {
          // Only show category if at least one layer ID exists in MAP_LAYERS
          const validLayers = layerIds
            .map(id => LAYER_LOOKUP.get(id))
            .filter(Boolean) as typeof MAP_LAYERS;

          if (validLayers.length === 0) return null;

          const isExpanded = expandedCategories[category];
          const activeCount = validLayers.filter(l => visibleLayers.includes(l.id)).length;

          return (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="w-full text-left text-xs font-semibold text-primary px-2 py-1.5 hover:bg-primary/10 rounded transition-all flex items-center justify-between"
              >
                <span>{category}</span>
                <div className="flex items-center gap-1.5">
                  {/* Active layer count badge */}
                  {activeCount > 0 && (
                    <span className="text-[9px] bg-[#00D9FF]/20 text-[#00D9FF] px-1.5 py-0.5 rounded-full font-mono">
                      {activeCount}
                    </span>
                  )}
                  {isExpanded
                    ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="ml-2 space-y-0.5">
                  {validLayers.map((layer) => {
                    const isVisible = visibleLayers.includes(layer.id);
                    return (
                      <label
                        key={layer.id}
                        className={`flex items-center gap-2 px-2 py-1 text-xs cursor-pointer rounded transition-all ${
                          isVisible
                            ? 'bg-[#00D9FF]/5 text-[#B0B9C1]'
                            : 'text-[#7A8391] hover:bg-card/50 hover:text-[#B0B9C1]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          // ✅ .includes() — correct for string[]
                          checked={isVisible}
                          onChange={() => onToggleLayer(layer.id)}
                          className="w-3 h-3 cursor-pointer accent-cyan-400 flex-shrink-0"
                        />
                        {/* displayName already includes emoji e.g. "🎯 Hotspots" */}
                        <span className="truncate">{layer.displayName}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}