'use client';

import React, { useState } from 'react';
import { GlobalMap } from './GlobalMap';
import { useDashboardStore } from '@/store/dashboardStore';
import TransportTab from '@/components/dashboards/Transporttab';
import SatelliteTab from '@/components/dashboards/Satellitetab ';
import CablesTab from '@/components/dashboards/Cablestab';
import WarzonesTab from '@/components/dashboards/Warzonestab';
import SatelliteImageryTab from '@/components/dashboards/SatelliteImageryTab';

// ─── Panel Types ──────────────────────────────────────────────────────────────

interface MapPanel {
  id: string;
  label: string;
  component: React.ReactNode;
}

// ─── Panels Configuration ─────────────────────────────────────────────────────

const MAP_PANELS: MapPanel[] = [
  {
    id: 'map',
    label: 'Main Map',
    component: <GlobalMap />,
  },
  {
    id: 'transport',
    label: 'Transport Intel',
    component: <TransportTab />,
  },
  {
    id: 'cabels',
    label: 'Cables & Networks',
    component: <CablesTab />,
  },
  {
    id: 'sattelite',
    label: 'Satellite & Geospatial',
    component: <SatelliteTab />,
  },
  {
    id: 'warzones',
    label: 'Warzones',
    component: <WarzonesTab />,
  },
  {
    id: 'sattelite-imagery',
    label: 'Satellite Imagery',
    component: <SatelliteImageryTab />,
  },
];

// ─── Global Map Container ─────────────────────────────────────────────────────

export function GlobalMapContainer() {
  const { activeTab, setActiveTab } = useDashboardStore();

  // Determine current panel
  const currentPanel = MAP_PANELS.find((p) => p.id === activeTab) || MAP_PANELS[0];

  return (
    <div className="h-full w-full flex flex-col">
      {/* Panel Switcher Header */}
      <div className="flex items-center gap-2 p-3 bg-[#0A0E27]/80 border-b border-[#00D9FF]/20 overflow-x-auto scrollbar-thin scrollbar-thumb-[#00D9FF]/20">
        <div className="text-xs font-mono text-[#7A8391] mr-2">PANELS:</div>
        <div className="flex gap-2">
          {MAP_PANELS.map((panel) => (
            <button
              key={panel.id}
              onClick={() => setActiveTab(panel.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === panel.id
                  ? 'bg-[#00D9FF]/20 text-[#00D9FF] border border-[#00D9FF]/40 shadow-lg shadow-[#00D9FF]/10'
                  : 'bg-[#1A1F3A]/50 text-[#7A8391] border border-[#00D9FF]/10 hover:bg-[#1A1F3A]/80 hover:text-[#00D9FF]'
              }`}
            >
              {panel.label}
            </button>
          ))}
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">
        {currentPanel.component}
      </div>
    </div>
  );
}
