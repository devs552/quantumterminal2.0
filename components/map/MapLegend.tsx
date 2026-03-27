'use client';

import React from 'react';

export function MapLegend() {
  const legendItems = [
    { label: 'High Threat', color: 'bg-red-500', intensity: 'Strong' },
    { label: 'Medium Alert', color: 'bg-amber-500', intensity: 'Moderate' },
    { label: 'Active Monitor', color: 'bg-cyan-500', intensity: 'Elevated' },
    { label: 'Info Point', color: 'bg-green-500', intensity: 'Normal' },
    { label: 'Infrastructure', color: 'bg-blue-500', intensity: 'Strategic' },
  ];

  return (
    <div className="glass-panel p-3 w-48">
      <div className="text-xs font-mono text-primary mb-3">THREAT LEGEND</div>
      <div className="space-y-2">
        {legendItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${item.color} opacity-80 shadow-lg`}></div>
            <div className="flex-1">
              <div className="text-xs text-foreground">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.intensity}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground">
        <div className="mb-1">Glow intensity = Risk level</div>
        <div>Hover for details</div>
      </div>
    </div>
  );
}
