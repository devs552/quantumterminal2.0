'use client';

import React, { useState, useEffect } from 'react';
import { TerminalLayout } from '@/components/layout/TerminalLayout';
import { GlobalMap } from '@/components/map/GlobalMap';
import { MarketsTab } from '@/components/dashboards/MarketsTab';
import { CryptoTab } from '@/components/dashboards/CryptoTab';
import { MacroTab } from '@/components/dashboards/MacroTab';
import { AIAnalysisTab } from '@/components/dashboards/AIAnalysisTab';
import { RiskDashboard } from '@/components/dashboards/RiskDashboard';
import { IntelligenceTab } from '@/components/dashboards/IntelligenceTab';
import { SettingsTab } from '@/components/settings/SettingsTab';
import { LiveAlertModal, AlertStreamIndicator, useLiveAlerts } from '@/components/alerts/LiveAlertModal';
import { LoginPage } from '@/components/auth/LoginPage';
import { RegisterPage } from '@/components/auth/RegisterPage';
import { useDashboardStore } from '@/store/dashboardStore';
import { SplashScreen } from '@/components/SplashScreen/SplashScreen';
import TransportTab from '@/components/dashboards/Transporttab';
import SatelliteTab from '@/components/dashboards/Satellitetab ';
import CablesTab from '@/components/dashboards/Cablestab';
import WarzonesTab from '@/components/dashboards/Warzonestab';

// ── Authenticated shell ───────────────────────────────────────────────────────
// Separated into its own component so that useLiveAlerts (and ALL hooks) only
// ever mount AFTER the user is authenticated. Previously, the hook ran in the
// parent and the early return for !authed meant <LiveAlertModal> was never in
// the DOM — so currentAlert was set but nothing rendered it.

function AuthenticatedApp({ onLogout }: { onLogout: () => void }) {
  const activeTab = useDashboardStore((state) => state.activeTab);

  // Hook lives here — guaranteed to be mounted alongside <LiveAlertModal>
  const { currentAlert, closeAlert, snoozeAlert, streamStatus } = useLiveAlerts({
    severityThreshold: 3,
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case 'map':                  return <GlobalMap />;
      case 'markets':
      case 'markets-summary':
      case 'markets-sectors':
      case 'markets-heatmap':
      case 'markets-screener':
      case 'markets-correlation':  return <MarketsTab />;
      case 'crypto':
      case 'crypto-pro':
      case 'crypto-orderflow':     return <CryptoTab />;
      case 'macro':                return <MacroTab />;
      case 'intelligence':         return <IntelligenceTab />;
      case 'risk':                 return <RiskDashboard />;
      case 'ai':                   return <AIAnalysisTab />;
      case 'settings':             return <SettingsTab />;
      case 'transport':            return <TransportTab />;
   
      case 'sattelite':            return <SatelliteTab />;
 
      case 'cabels':               return <CablesTab />;
      case 'warzones':             return <WarzonesTab />;
      default:                     return <GlobalMap />;
    }
  };

  return (
    <>
      <TerminalLayout >
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
          <AlertStreamIndicator status={streamStatus} />
        </div>
        <div className="h-full w-full">
          {renderTabContent()}
        </div>
      </TerminalLayout>

      {/* Modal is always in the DOM when authenticated — currentAlert drives visibility */}
      <LiveAlertModal
        alert={currentAlert}
        onClose={closeAlert}
        onSnooze={snoozeAlert}
      />
    </>
  );
}

// ── Root page ─────────────────────────────────────────────────────────────────

type AuthView = 'login' | 'register';

export default function QuantumTerminalPage() {
  const [splashDone,  setSplashDone]  = useState(false);
  const [authed,      setAuthed]      = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authView,    setAuthView]    = useState<AuthView>('login');

  // Restore session
  useEffect(() => {
    const stored = sessionStorage.getItem('qt_auth');
    if (stored === 'true') setAuthed(true);
    setAuthChecked(true);
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('qt_auth', 'true');
    setAuthed(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('qt_auth');
    setAuthed(false);
  };

  // Wait for session check
  if (!authChecked) return null;

  // Auth gate — no hooks below this point in this component
  if (!authed) {
    return authView === 'login'
      ? <LoginPage
          onLogin={handleLogin}
          onGoToRegister={() => setAuthView('register')}
        />
      : <RegisterPage
          onGoToLogin={() => setAuthView('login')}
        />;
  }

  return (
    <>
      {!splashDone && (
        <SplashScreen onComplete={() => setSplashDone(true)} duration={3200} />
      )}
      {/* AuthenticatedApp mounts only after auth — hooks inside are safe */}
      <AuthenticatedApp onLogout={handleLogout} />
    </>
  );
}