'use client';

import { create } from 'zustand';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertCategory =
  | 'market'
  | 'geopolitical'
  | 'climate'
  | 'cyber'
  | 'infrastructure'
  | 'intelligence';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  timestamp: number;
  source: string;
  read: boolean;
  actionUrl?: string;
}

interface AlertState {
  alerts: Alert[];
  activeAlerts: Alert[];
  notificationsEnabled: boolean;
  soundEnabled: boolean;

  addAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'read'>) => void;
  removeAlert: (id: string) => void;
  markAsRead: (id: string) => void;
  clearAlerts: () => void;
  getCriticalCount: () => number;
  getAlertsByCategory: (category: AlertCategory) => Alert[];
  setNotificationsEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
}

// ✅ Defined outside store so activeAlerts can be seeded from the same data
const SEED_ALERTS: Alert[] = [
  {
    id: '1',
    severity: 'critical',
    category: 'market',
    title: 'USD/CHF Divergence',
    description: 'Unusual correlation break detected between USD and CHF',
    timestamp: Date.now(),
    source: 'AI Analysis',
    read: false,
  },
  {
    id: '2',
    severity: 'warning',
    category: 'market',
    title: 'Liquidation Spike',
    description: '$2.3B BTC longs liquidated in 15 minutes',
    timestamp: Date.now() - 300000,
    source: 'Market Data',
    read: false,
  },
  {
    id: '3',
    severity: 'info',
    category: 'geopolitical',
    title: 'Regional Tensions Rise',
    description: 'Military activity detected in key region',
    timestamp: Date.now() - 600000,
    source: 'Intelligence',
    read: true,
  },
];

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: SEED_ALERTS,

  // ✅ Seeded from actual data — was always [] before, missing the critical alert
  activeAlerts: SEED_ALERTS.filter((a) => !a.read && a.severity === 'critical'),

  notificationsEnabled: true,
  soundEnabled: true,

  addAlert: (alert) =>
    set((state) => {
      const newAlert: Alert = {
        ...alert,
        // ✅ substring instead of deprecated substr
        id: Math.random().toString(36).substring(2, 11),
        timestamp: Date.now(),
        read: false,
      };

      const updatedAlerts = [newAlert, ...state.alerts].slice(0, 100);
      const updatedActive = updatedAlerts.filter(
        (a) => !a.read && a.severity === 'critical'
      );

      return {
        alerts: updatedAlerts,
        activeAlerts: updatedActive,
      };
    }),

  removeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
      activeAlerts: state.activeAlerts.filter((a) => a.id !== id),
    })),

  markAsRead: (id) =>
    set((state) => {
      const updatedAlerts = state.alerts.map((a) =>
        a.id === id ? { ...a, read: true } : a
      );
      return {
        alerts: updatedAlerts,
        // ✅ Recompute activeAlerts from full list, not just filter previous activeAlerts
        activeAlerts: updatedAlerts.filter(
          (a) => !a.read && a.severity === 'critical'
        ),
      };
    }),

  clearAlerts: () => set({ alerts: [], activeAlerts: [] }),

  // ✅ These derive from get() — correct Zustand pattern for selectors
  getCriticalCount: () =>
    get().alerts.filter((a) => a.severity === 'critical' && !a.read).length,

  getAlertsByCategory: (category) =>
    get().alerts.filter((a) => a.category === category),

  setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
}));