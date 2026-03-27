'use client';

import React, { useState } from 'react';
import {
  Globe,
  TrendingUp,
  DollarSign,
  Zap,
  BookOpen,
  AlertTriangle,
  Settings,
  Cpu,
  Navigation,
  Layers,
  ChevronRight,
  ChevronDown,
  Cable,
  Satellite,
  PlaneTakeoffIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboardStore } from '@/store/dashboardStore';
import { useAlertStore } from '@/store/alertStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavChild {
  id: string;
  label: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  badge?: string | number;
  children?: NavChild[];
}

// ─── Nav Config ───────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  {
    id: 'map',
    label: 'Global Map',
    icon: <Globe className="h-4 w-4" />,
    description: 'Intelligence hotspots & events',
  },
  {
    id: 'markets',
    label: 'Markets & Equities',
    icon: <TrendingUp className="h-4 w-4" />,
    description: 'SPX, NASDAQ, sectors, assets',
   
  },
  {
    id: 'crypto',
    label: 'Digital Assets',
    icon: <Zap className="h-4 w-4" />,
    description: 'BTC, ETH, altcoins, whales',
   
  },
  {
    id: 'macro',
    label: 'Macro & Economics',
    icon: <DollarSign className="h-4 w-4" />,
    description: 'FRED data, central banks, yields',
  },
  {
    id: 'transport',
    label: 'Transport Intel',
    icon: <Navigation className="h-4 w-4" />,
    description: 'Flights &  Marines',
  },
   {
    id: 'cabels',
    label: 'Cabels & Networks',
    icon: <Cable className="h-4 w-4" />,
    description: 'Cable networks, infrastructure, connectivity',
  },
   {
    id: 'sattelite',
    label: 'Sattelite & Geospatial',
    icon: <Satellite className="h-4 w-4" />,
    description: 'Satellite imagery, geospatial data',
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    icon: <BookOpen className="h-4 w-4" />,
    description: 'News, UCDP, conflicts, displacement',
  },
  {
    id: 'risk',
    label: 'Risk Dashboard',
    icon: <AlertTriangle className="h-4 w-4" />,
    description: 'Cascading risk, instability index',
  },
  {
    id: 'warzones',
    label: 'WarZones',
    icon: <PlaneTakeoffIcon className="h-4 w-4" />,
    description: 'warzones, flashpoints, conflict zones',
  },
  {
    id: 'ai',
    label: 'AI Analysis',
    icon: <Cpu className="h-4 w-4" />,
    description: 'AI insights & predictions',
  },
];

// ─── Sub-nav item ─────────────────────────────────────────────────────────────

function ChildNavButton({
  child,
  isActive,
  onClick,
}: {
  child: NavChild;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-1.5 rounded text-xs text-left transition-all font-mono flex items-center gap-1.5 ${
        isActive
          ? 'text-[#00D9FF] bg-[#00D9FF]/10 border border-[#00D9FF]/30'
          : 'text-[#7A8391] hover:text-[#00D9FF] hover:bg-[#1A1F3A]/50 border border-transparent'
      }`}
    >
      <ChevronRight className="h-3 w-3 flex-shrink-0" />
      {child.label}
    </button>
  );
}

// ─── Main nav item ────────────────────────────────────────────────────────────

function NavButton({
  item,
  isActive,
  isExpanded,
  onNavigate,
  onToggleExpand,
}: {
  item: NavItem;
  isActive: boolean;
  isExpanded: boolean;
  onNavigate: (id: string) => void;
  onToggleExpand: (id: string) => void;
}) {
  const handleClick = () => {
    onNavigate(item.id);
    if (item.children) {
      onToggleExpand(item.id);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full px-3 py-2 rounded text-sm font-medium transition-all text-left group ${
        isActive
          ? 'bg-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/40 shadow-lg shadow-[#00D9FF]/10'
          : 'text-[#B0B9C1] hover:bg-[#1A1F3A]/50 border border-transparent hover:border-[#00D9FF]/20'
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Icon */}
        <div
          className={`flex-shrink-0 transition-colors ${
            isActive ? 'text-[#00D9FF]' : 'text-[#7A8391] group-hover:text-[#00D9FF]'
          }`}
        >
          {item.icon}
        </div>

        {/* Label + description */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{item.label}</div>
          <div className="text-xs text-[#7A8391] truncate">{item.description}</div>
        </div>

        {/* Badge */}
        {item.badge !== undefined && (
          <span className="flex-shrink-0 text-xs bg-[#FF1744]/20 text-[#FF1744] px-1.5 py-0.5 rounded font-mono">
            {item.badge}
          </span>
        )}

        {/* Expand indicator */}
        {item.children && (
          <span className="flex-shrink-0 text-[#7A8391]">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function LeftSidebar() {
  const [expandedItem, setExpandedItem] = useState<string | null>('map');
  const { activeTab, setActiveTab } = useDashboardStore();
  const { getCriticalCount } = useAlertStore();
  const criticalCount = getCriticalCount();

  const handleNavigate = (id: any) => {
    setActiveTab(id);
  };

  const handleToggleExpand = (id: string) => {
    setExpandedItem((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-full px-3 py-4 gap-3">

      {/* ── Terminal Header ── */}
      <div className="space-y-2 pb-4 border-b border-[#00D9FF]/20">
        <div className="text-xs font-mono tracking-wider text-[#00D9FF] font-bold">
          ⚡ MALIK TERMINAL
        </div>
        <div className="space-y-1 text-xs font-mono">
          {[
            { label: 'Markets', status: 'Active', color: '#0FFF50' },
            { label: 'Feeds', status: 'Live', color: '#0FFF50' },
            { label: 'AI', status: 'Ready', color: '#0FFF50' },
          ].map(({ label, status, color }) => (
            <div key={label} className="flex justify-between text-[#B0B9C1]">
              <span>{label}:</span>
              <span style={{ color }} className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#00D9FF]/20 scrollbar-track-transparent">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id ||
            item.children?.some((c) => c.id === activeTab);
          const isExpanded = expandedItem === item.id;

          return (
            <div key={item.id}>
              <NavButton
                item={item}
                isActive={!!isActive}
                isExpanded={isExpanded}
                onNavigate={handleNavigate}
                onToggleExpand={handleToggleExpand}
              />

              {/* Sub-nav */}
              {item.children && isExpanded && (
                <div className="ml-3 mt-1 mb-1 space-y-0.5 border-l border-[#00D9FF]/20 pl-2">
                  {item.children.map((child) => (
                    <ChildNavButton
                      key={child.id}
                      child={child}
                      isActive={activeTab === child.id}
                      onClick={() => handleNavigate(child.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Critical Alerts Badge ── */}
      {criticalCount > 0 && (
        <button
          onClick={() => handleNavigate('risk')}
          className="w-full bg-[#FF1744]/10 border border-[#FF1744]/30 rounded p-2 text-left transition-all hover:bg-[#FF1744]/20"
        >
          <div className="text-[#FF1744] font-mono font-bold text-xs flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" />
            {criticalCount} CRITICAL ALERT{criticalCount !== 1 ? 'S' : ''}
          </div>
          <div className="text-[#FFB74D] text-xs mt-0.5">
            Click to view risk dashboard
          </div>
        </button>
      )}

      {/* ── Footer ── */}
      <div className="border-t border-[#00D9FF]/20 pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleNavigate('settings')}
          className="w-full text-xs border-[#00D9FF]/20 text-[#00D9FF] hover:bg-[#00D9FF]/10 hover:text-[#00D9FF]"
        >
          <Settings className="h-3 w-3 mr-1.5" />
          Settings
        </Button>
      </div>
    </div>
  );
}