'use client';

import React, { useEffect, useState } from 'react';
import { Menu, Bell, Settings, Radio, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAlertStore } from '@/store/alertStore';
import { useDashboardStore } from '@/store/dashboardStore';

interface TopBarProps {
  onToggleSidebar: () => void;
  onLogout?: () => void;
}

export function TopBar({ onToggleSidebar, onLogout }: TopBarProps) {
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const tick = () =>
      setUtcTime(
        new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' })
      );
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const { getCriticalCount } = useAlertStore();
  const criticalCount = getCriticalCount();
  const { setActiveTab } = useDashboardStore();

  const handleLogout = () => {
    sessionStorage.removeItem('qt_auth');
    onLogout?.();
    // Hard reload so all state is fully cleared
    window.location.reload();
  };

  return (
    <div className="terminal-header px-6 py-4 flex items-center justify-between h-16">

      {/* ── Left: Toggle + Branding ── */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="text-primary hover:bg-primary/10"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-3">
          <div className="text-xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            ⚡ MALIK&apos;S QUANTUM TERMINAL
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span>v1.0.0</span>
            <span className="text-primary/40">|</span>
            <span className="flex items-center gap-1 text-[#0FFF50]">
              <Radio className="h-3 w-3 animate-pulse" />
              LIVE
            </span>
            <span className="text-primary/40">|</span>
            <span>UTC {utcTime}</span>
          </div>
        </div>
      </div>

      {/* ── Right: Status + Actions ── */}
      <div className="flex items-center gap-2">

        {/* Operational status */}
        <div className="hidden sm:flex items-center gap-2 mr-3 text-sm">
          <span className="text-muted-foreground font-mono text-xs">Status:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-500 font-mono text-xs font-semibold">
              OPERATIONAL
            </span>
          </span>
        </div>

        {/* Bell */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveTab('risk')}
          className="relative text-muted-foreground hover:text-primary hover:bg-primary/10"
          title={criticalCount > 0 ? `${criticalCount} critical alerts` : 'No alerts'}
        >
          <Bell className="h-5 w-5" />
          {criticalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {criticalCount > 9 ? '9+' : criticalCount}
            </span>
          )}
        </Button>

        {/* Settings */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveTab('settings')}
          className="text-muted-foreground hover:text-primary hover:bg-primary/10"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </Button>

        {/* Divider */}
        <div className="w-px h-6 bg-primary/20 mx-1" />

        {/* Logout */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Log out"
        >
          <LogOut className="h-5 w-5" />
        </Button>

      </div>
    </div>
  );
}