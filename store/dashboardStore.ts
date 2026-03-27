'use client';

import { create } from 'zustand';
import { DashboardFilters } from '@/lib/types';

// ✅ Added 'settings' and all child tab IDs
export type TabType =
  | 'map'
  | 'markets'
  | 'markets-summary'
  | 'markets-sectors'
  | 'markets-heatmap'
  | 'markets-screener'
  | 'markets-correlation'
  | 'crypto'
  | 'crypto-pro'
  | 'crypto-orderflow'
  | 'macro'
  | 'intelligence'
  | 'risk'
  | 'ai'
  | 'transport'
  | 'modules'
  | 'sattelite'  
  | 'cabels'
  | 'warzones'
  | 'settings';

export type MarketSubTab = 'summary' | 'sectors' | 'heatmap' | 'screener' | 'correlation' | 'grid';
export type CryptoSubTab = 'pro' | 'flow';
export type MacroSubTab = 'summary' | 'fred' | 'yields' | 'centralbanks';

interface DashboardState {
  activeTab: TabType;
  activeMarketSubTab: MarketSubTab;
  activeCryptoSubTab: CryptoSubTab;
  activeMacroSubTab: MacroSubTab;
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  leftSidebarWidth: number;
  rightPanelWidth: number;
  filters: DashboardFilters;
  isLoading: boolean;
  lastUpdate: Date | null;
  refreshInterval: number;
 

  setActiveTab: (tab: TabType) => void;
  setActiveMarketSubTab: (tab: MarketSubTab) => void;
  setActiveCryptoSubTab: (tab: CryptoSubTab) => void;
  setActiveMacroSubTab: (tab: MacroSubTab) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setLeftSidebarWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setFilters: (filters: Partial<DashboardFilters>) => void;
  setIsLoading: (loading: boolean) => void;
  setLastUpdate: () => void;
  setRefreshInterval: (interval: number) => void;
   onLogout: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  activeTab: 'map',
  activeMarketSubTab: 'summary',
  activeCryptoSubTab: 'pro',
  activeMacroSubTab: 'summary',
  sidebarOpen: true,
  rightPanelOpen: true,
  leftSidebarWidth: 280,
  rightPanelWidth: 350,
  filters: { timeRange: '1d' },
  isLoading: false,
  lastUpdate: null,
  refreshInterval: 5000,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveMarketSubTab: (tab) => set({ activeMarketSubTab: tab }),
  setActiveCryptoSubTab: (tab) => set({ activeCryptoSubTab: tab }),
  setActiveMacroSubTab: (tab) => set({ activeMacroSubTab: tab }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setLeftSidebarWidth: (width) => set({ leftSidebarWidth: width }),
  setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setLastUpdate: () => set({ lastUpdate: new Date() }),
  setRefreshInterval: (interval) => set({ refreshInterval: interval }),
   onLogout: () => set({ activeTab: 'map', sidebarOpen: false, rightPanelOpen: false }),
}));