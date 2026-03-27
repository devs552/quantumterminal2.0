'use client';

import React, { useState } from 'react';
import {
  Monitor, Bell, Shield, Database, Globe, Palette,
  ToggleLeft, ToggleRight, ChevronRight, Save, RotateCcw,
  Wifi, Clock, Eye, Lock, Zap, Volume2, VolumeX
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SettingToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  accent?: string;
}

interface SettingSelectProps {
  label: string;
  description?: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}

interface SettingSliderProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SettingToggle({ label, description, value, onChange, accent = '#00D9FF' }: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#1A2040]/60 last:border-0">
      <div className="flex-1 mr-4">
        <div className="text-sm font-mono text-[#B0B9C1]">{label}</div>
        {description && <div className="text-[10px] text-[#4A5470] mt-0.5">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative shrink-0 transition-all duration-300"
        style={{ outline: 'none' }}
      >
        <div
          className="w-10 h-5 rounded-full transition-all duration-300 relative"
          style={{
            background: value ? `${accent}30` : '#1A2040',
            border: `1px solid ${value ? accent : '#2A3050'}`,
            boxShadow: value ? `0 0 10px ${accent}40` : 'none',
          }}
        >
          <div
            className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300"
            style={{
              left: value ? 'calc(100% - 18px)' : '2px',
              background: value ? accent : '#3A4060',
              boxShadow: value ? `0 0 6px ${accent}` : 'none',
            }}
          />
        </div>
      </button>
    </div>
  );
}

function SettingSelect({ label, description, value, options, onChange }: SettingSelectProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#1A2040]/60 last:border-0">
      <div className="flex-1 mr-4">
        <div className="text-sm font-mono text-[#B0B9C1]">{label}</div>
        {description && <div className="text-[10px] text-[#4A5470] mt-0.5">{description}</div>}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs font-mono bg-[#0A0E27] border border-[#2A3050] text-[#00D9FF] px-2 py-1 rounded focus:outline-none focus:border-[#00D9FF]"
        style={{ minWidth: 120 }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function SettingSlider({ label, description, value, min, max, step = 1, unit = '', onChange }: SettingSliderProps) {
  return (
    <div className="py-3 border-b border-[#1A2040]/60 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-mono text-[#B0B9C1]">{label}</div>
          {description && <div className="text-[10px] text-[#4A5470] mt-0.5">{description}</div>}
        </div>
        <span className="text-xs font-mono text-[#00D9FF] ml-4">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #00D9FF ${((value - min) / (max - min)) * 100}%, #1A2040 0%)`,
          outline: 'none',
        }}
      />
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#0F1432]/60 border border-[#1A2040] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1A2040] bg-[#0A0E27]/40">
        <span className="text-[#00D9FF]">{icon}</span>
        <span className="text-xs font-mono font-bold text-[#00D9FF] tracking-widest uppercase">{title}</span>
      </div>
      <div className="px-4">{children}</div>
    </div>
  );
}

// ── Main Settings Tab ─────────────────────────────────────────────────────────

export function SettingsTab() {
  const [saved, setSaved] = useState(false);

  // Display
  const [theme, setTheme] = useState('dark-cyber');
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [glowEffects, setGlowEffects] = useState(true);
  const [gridLines, setGridLines] = useState(true);
  const [fontSize, setFontSize] = useState(12);

  // Alerts
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(3);
  const [alertSources, setAlertSources] = useState({
    gdelt: true,
    markets: true,
    crypto: true,
    weather: false,
  });
  const [alertCooldown, setAlertCooldown] = useState(60);

  // Data
  const [refreshInterval, setRefreshInterval] = useState(15);
  const [dataRegion, setDataRegion] = useState('global');
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [liveMode, setLiveMode] = useState(true);
  const [dataQuality, setDataQuality] = useState('balanced');

  // Map
  const [mapStyle, setMapStyle] = useState('dark');
  const [clusterMarkers, setClusterMarkers] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [pulseAnimation, setPulseAnimation] = useState(true);

  // Privacy
  const [analytics, setAnalytics] = useState(false);
  const [sessionLogging, setSessionLogging] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setTheme('dark-cyber');
    setAnimationsEnabled(true);
    setCompactMode(false);
    setGlowEffects(true);
    setGridLines(true);
    setFontSize(12);
    setAlertsEnabled(true);
    setSoundAlerts(false);
    setAlertThreshold(3);
    setAlertCooldown(60);
    setRefreshInterval(15);
    setDataRegion('global');
    setCacheEnabled(true);
    setLiveMode(true);
    setDataQuality('balanced');
    setMapStyle('dark');
    setClusterMarkers(false);
    setShowLabels(true);
    setPulseAnimation(true);
    setAnalytics(false);
    setSessionLogging(false);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0A0E27]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A0E27]/95 backdrop-blur-md border-b border-[#1A2040] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-mono font-bold text-[#00D9FF] tracking-wider">TERMINAL SETTINGS</h1>
          <p className="text-[10px] font-mono text-[#4A5470] mt-0.5">Configure your Quantum Terminal experience</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono text-[#7A8391] border border-[#2A3050] hover:border-[#3A4060] hover:text-[#B0B9C1] transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-mono font-bold transition-all"
            style={{
              background: saved ? '#0FFF5020' : '#00D9FF20',
              border: `1px solid ${saved ? '#0FFF50' : '#00D9FF'}`,
              color: saved ? '#0FFF50' : '#00D9FF',
              boxShadow: saved ? '0 0 12px #0FFF5040' : '0 0 12px #00D9FF30',
            }}
          >
            <Save className="w-3 h-3" />
            {saved ? 'SAVED ✓' : 'SAVE'}
          </button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl mx-auto">

        {/* Display */}
        <Section title="Display" icon={<Monitor className="w-4 h-4" />}>
          <SettingSelect
            label="Theme"
            description="Terminal color scheme"
            value={theme}
            options={[
              { label: 'Dark Cyber', value: 'dark-cyber' },
              { label: 'Midnight Blue', value: 'midnight' },
              { label: 'Hacker Green', value: 'hacker' },
              { label: 'Amber Classic', value: 'amber' },
            ]}
            onChange={setTheme}
          />
          <SettingToggle label="Animations" description="Enable UI transitions & effects" value={animationsEnabled} onChange={setAnimationsEnabled} />
          <SettingToggle label="Glow Effects" description="Neon glow on panels and text" value={glowEffects} onChange={setGlowEffects} accent="#C084FC" />
          <SettingToggle label="Grid Lines" description="Background grid overlay" value={gridLines} onChange={setGridLines} />
          <SettingToggle label="Compact Mode" description="Reduce padding for more data density" value={compactMode} onChange={setCompactMode} accent="#FFD700" />
          <SettingSlider label="Font Size" value={fontSize} min={10} max={16} unit="px" onChange={setFontSize} />
        </Section>

        {/* Alerts */}
        <Section title="Live Alerts" icon={<Bell className="w-4 h-4" />}>
          <SettingToggle label="Enable Alerts" description="Show live alert modal for critical events" value={alertsEnabled} onChange={setAlertsEnabled} />
          <SettingToggle label="Sound Alerts" description="Play audio on high-severity events" value={soundAlerts} onChange={setSoundAlerts} accent="#FF1744" />
          <SettingSlider
            label="Severity Threshold"
            description="Minimum severity to trigger an alert (1–5)"
            value={alertThreshold}
            min={1}
            max={5}
            onChange={setAlertThreshold}
          />
          <SettingSlider
            label="Alert Cooldown"
            description="Seconds between repeated alerts for same source"
            value={alertCooldown}
            min={15}
            max={300}
            step={15}
            unit="s"
            onChange={setAlertCooldown}
          />
          <div className="py-3">
            <div className="text-sm font-mono text-[#B0B9C1] mb-2">Alert Sources</div>
            {Object.entries(alertSources).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between py-1">
                <span className="text-xs font-mono text-[#7A8391] uppercase">{key}</span>
                <button
                  onClick={() => setAlertSources(prev => ({ ...prev, [key]: !val }))}
                  className="text-[10px] font-mono px-2 py-0.5 rounded transition-all"
                  style={{
                    background: val ? '#00D9FF15' : '#1A2040',
                    border: `1px solid ${val ? '#00D9FF50' : '#2A3050'}`,
                    color: val ? '#00D9FF' : '#4A5470',
                  }}
                >
                  {val ? 'ON' : 'OFF'}
                </button>
              </div>
            ))}
          </div>
        </Section>

        {/* Data */}
        <Section title="Data & Feed" icon={<Database className="w-4 h-4" />}>
          <SettingToggle label="Live Mode" description="Stream real-time data (vs cached snapshots)" value={liveMode} onChange={setLiveMode} accent="#0FFF50" />
          <SettingToggle label="Client Cache" description="Cache API responses locally" value={cacheEnabled} onChange={setCacheEnabled} />
          <SettingSlider
            label="Refresh Interval"
            description="How often to poll data sources"
            value={refreshInterval}
            min={5}
            max={120}
            step={5}
            unit="s"
            onChange={setRefreshInterval}
          />
          <SettingSelect
            label="Data Region"
            description="Primary geographic data focus"
            value={dataRegion}
            options={[
              { label: 'Global', value: 'global' },
              { label: 'Americas', value: 'americas' },
              { label: 'Europe / Africa', value: 'emea' },
              { label: 'Asia Pacific', value: 'apac' },
            ]}
            onChange={setDataRegion}
          />
          <SettingSelect
            label="Data Quality"
            description="Balance between speed and completeness"
            value={dataQuality}
            options={[
              { label: 'Fast (less detail)', value: 'fast' },
              { label: 'Balanced', value: 'balanced' },
              { label: 'Complete (slower)', value: 'complete' },
            ]}
            onChange={setDataQuality}
          />
        </Section>

        {/* Map */}
        <Section title="Map" icon={<Globe className="w-4 h-4" />}>
          <SettingSelect
            label="Base Map Style"
            description="Underlying map tile theme"
            value={mapStyle}
            options={[
              { label: 'Dark (OSM)', value: 'dark' },
              { label: 'Satellite', value: 'satellite' },
              { label: 'Minimal', value: 'minimal' },
            ]}
            onChange={setMapStyle}
          />
          <SettingToggle label="Pulse Animation" description="Animate marker rings on the map" value={pulseAnimation} onChange={setPulseAnimation} accent="#C084FC" />
          <SettingToggle label="Show Labels" description="Display location labels on markers" value={showLabels} onChange={setShowLabels} />
          <SettingToggle label="Cluster Markers" description="Group nearby markers at low zoom" value={clusterMarkers} onChange={setClusterMarkers} accent="#FFD700" />
        </Section>

        {/* Privacy */}
        <Section title="Privacy & Security" icon={<Shield className="w-4 h-4" />}>
          <SettingToggle label="Usage Analytics" description="Send anonymous usage data to improve the terminal" value={analytics} onChange={setAnalytics} accent="#FF1744" />
          <SettingToggle label="Session Logging" description="Log queries and interactions locally" value={sessionLogging} onChange={setSessionLogging} accent="#FF1744" />
          <div className="py-3">
            <div className="text-xs font-mono text-[#4A5470]">
              All data is processed locally. No personal information is stored on external servers.
            </div>
          </div>
        </Section>

        {/* System Info */}
        <Section title="System" icon={<Zap className="w-4 h-4" />}>
          {[
            { label: 'Version', value: '2.4.1-beta' },
            { label: 'Build', value: 'quantum-2025.02' },
            { label: 'Data Engine', value: 'GDELT GEO 2.0' },
            { label: 'Map Engine', value: 'MapLibre GL 4.x' },
            { label: 'Environment', value: process.env.NODE_ENV || 'production' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-2.5 border-b border-[#1A2040]/60 last:border-0">
              <span className="text-xs font-mono text-[#4A5470]">{label}</span>
              <span className="text-xs font-mono text-[#00D9FF]">{value}</span>
            </div>
          ))}
        </Section>

      </div>
    </div>
  );
}