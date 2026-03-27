'use client';

import React, { useEffect } from 'react';
import { LeftSidebar } from './LeftSidebar';
import { TopBar } from './TopBar';
import { RightPanel } from './RightPanel';
import { useDashboardStore } from '@/store/dashboardStore';

interface TerminalLayoutProps {
  children: React.ReactNode;
}

export function TerminalLayout({ children }: TerminalLayoutProps) {
  const {
    sidebarOpen,
    rightPanelOpen,
    toggleSidebar,
    toggleRightPanel,
    leftSidebarWidth,
    rightPanelWidth,
    isLoading,
  onLogout,
  } = useDashboardStore();

  useEffect(() => {
    // Initialization logic here
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#0A0E27] text-white overflow-hidden">

      {/* ── Top Bar ── */}
      <TopBar onToggleSidebar={toggleSidebar} onLogout={onLogout} />

      {/* ── Main 3-column layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Sidebar */}
        <div
          className="overflow-y-auto border-r border-[#00D9FF]/10 bg-[#0F1432] transition-all duration-300 flex-shrink-0"
          style={{ width: sidebarOpen ? `${leftSidebarWidth}px` : '0px' }}
        >
          {sidebarOpen && <LeftSidebar />}
        </div>

        {/* Center Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#0A0E27] relative">
          {isLoading && (
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-[#00D9FF]/10">
                  <div className="h-8 w-8 border-2 border-[#00D9FF] border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-sm font-mono text-[#00D9FF]">Loading...</p>
              </div>
            </div>
          )}
          {children}
        </div>

        {/* Right Panel */}
        <div
          className="overflow-y-auto border-l border-[#00D9FF]/10 bg-[#0F1432]/50 backdrop-blur-md transition-all duration-300 flex-shrink-0"
          style={{ width: rightPanelOpen ? `${rightPanelWidth}px` : '0px' }}
        >
          {rightPanelOpen && <RightPanel onClose={toggleRightPanel} />}
        </div>
      </div>
    </div>
  );
}