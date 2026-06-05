'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  shortLabel: string;
  icon: string;
  accent: string;
  component: React.ReactNode;
}

// ─── Panels Configuration ─────────────────────────────────────────────────────

const MAP_PANELS: MapPanel[] = [
  {
    id: 'map',
    label: 'Global Overview',
    shortLabel: 'MAP',
    icon: '◉',
    accent: '#00D9FF',
    component: <GlobalMap />,
  },
  {
    id: 'transport',
    label: 'Transport Intel',
    shortLabel: 'TRNSP',
    icon: '⬡',
    accent: '#0FFF50',
    component: <TransportTab />,
  },
  {
    id: 'cabels',
    label: 'Cables & Networks',
    shortLabel: 'CABLE',
    icon: '⬢',
    accent: '#FFB300',
    component: <CablesTab />,
  },
  {
    id: 'sattelite',
    label: 'Satellite & Geospatial',
    shortLabel: 'SAT',
    icon: '◈',
    accent: '#C084FC',
    component: <SatelliteTab />,
  },
  {
    id: 'warzones',
    label: 'Warzones',
    shortLabel: 'WAR',
    icon: '◆',
    accent: '#FF1744',
    component: <WarzonesTab />,
  },
  {
    id: 'sattelite-imagery',
    label: 'Satellite Imagery',
    shortLabel: 'IMGRY',
    icon: '◩',
    accent: '#00E5FF',
    component: <SatelliteImageryTab />,
  },
];

// ─── Animated Ticker ──────────────────────────────────────────────────────────

const TICKER_ITEMS = [
  'GEOINT FEED ACTIVE',
  'SIGINT NOMINAL',
  'AIS TRACKING: 2,847 VESSELS',
  'ORBITAL ASSETS: 12 PLATFORMS',
  'THREAT INDEX: ELEVATED',
  'DATA LATENCY: <15MIN',
  'GDELT GEO 2.0 · LIVE',
  'CLASSIF: UNCLASSIFIED // FOUO',
];

function Ticker() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % TICKER_ITEMS.length);
        setVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(cycle);
  }, []);

  return (
    <div className="flex items-center gap-2 overflow-hidden">
      <span
        className="text-[9px] font-mono tracking-[0.2em] transition-all duration-300"
        style={{
          color: '#00D9FF',
          opacity: visible ? 0.7 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(-4px)',
        }}
      >
        {TICKER_ITEMS[index]}
      </span>
    </div>
  );
}

// ─── Live Clock ───────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div className="text-[11px] font-mono font-bold leading-none" style={{ color: '#00D9FF', letterSpacing: '0.12em' }}>
          {time} <span style={{ color: '#3A4870', fontSize: 9 }}>UTC</span>
        </div>
        <div className="text-[8px] font-mono mt-0.5" style={{ color: '#3A4870', letterSpacing: '0.15em' }}>{date}</div>
      </div>
    </div>
  );
}

// ─── Signal strength bars ─────────────────────────────────────────────────────

function SignalBars({ color = '#00D9FF', strength = 4 }: { color?: string; strength?: number }) {
  return (
    <div className="flex items-end gap-0.5">
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          style={{
            width: 3,
            height: 3 + i * 3,
            borderRadius: 1,
            background: i <= strength ? color : '#1A2040',
            transition: 'background 0.3s',
          }}
        />
      ))}
    </div>
  );
}

// ─── Corner decoration ────────────────────────────────────────────────────────

function CornerBracket({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const size = 10;
  const thickness = 1.5;
  const color = 'rgba(0,217,255,0.3)';

  const styles: Record<string, React.CSSProperties> = {
    tl: { top: 0, left: 0,  borderTop: `${thickness}px solid ${color}`, borderLeft:  `${thickness}px solid ${color}` },
    tr: { top: 0, right: 0, borderTop: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}` },
    bl: { bottom: 0, left: 0,  borderBottom: `${thickness}px solid ${color}`, borderLeft:  `${thickness}px solid ${color}` },
    br: { bottom: 0, right: 0, borderBottom: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}` },
  };

  return (
    <div
      style={{
        position: 'absolute',
        width: size,
        height: size,
        ...styles[position],
        zIndex: 1,
      }}
    />
  );
}

// ─── Panel Tab Button ─────────────────────────────────────────────────────────

function PanelTab({
  panel,
  isActive,
  onClick,
}: {
  panel: MapPanel;
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: isActive
          ? `linear-gradient(135deg, ${panel.accent}18 0%, ${panel.accent}08 100%)`
          : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        border: `1px solid ${isActive ? panel.accent + '50' : hovered ? panel.accent + '25' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 4,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        outline: 'none',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Active glow bar at top */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 1.5,
            background: `linear-gradient(90deg, transparent, ${panel.accent}, transparent)`,
          }}
        />
      )}

      {/* Icon */}
      <span
        style={{
          fontSize: 12,
          color: isActive ? panel.accent : hovered ? panel.accent + 'AA' : '#3A4870',
          transition: 'color 0.2s',
          lineHeight: 1,
        }}
      >
        {panel.icon}
      </span>

      {/* Label */}
      <div style={{ textAlign: 'left' }}>
        <div
          style={{
            fontSize: 9,
            fontFamily: "'DM Mono', 'Fira Code', monospace",
            fontWeight: 600,
            letterSpacing: '0.18em',
            color: isActive ? panel.accent : hovered ? '#7A8391' : '#3A4870',
            transition: 'color 0.2s',
            lineHeight: 1,
          }}
        >
          {panel.shortLabel}
        </div>
        {isActive && (
          <div
            style={{
              fontSize: 8,
              fontFamily: 'monospace',
              color: panel.accent + '80',
              letterSpacing: '0.05em',
              marginTop: 2,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 90,
            }}
          >
            {panel.label}
          </div>
        )}
      </div>

      {/* Active indicator dot */}
      {isActive && (
        <div
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: panel.accent,
            boxShadow: `0 0 6px ${panel.accent}`,
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      )}
    </button>
  );
}

// ─── Scan line overlay ────────────────────────────────────────────────────────

function ScanlineOverlay() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
      }}
    />
  );
}

// ─── Global Map Container ─────────────────────────────────────────────────────

export function GlobalMapContainer() {
  const { activeTab, setActiveTab } = useDashboardStore();
  const [prevTab, setPrevTab] = useState(activeTab);
  const [transitioning, setTransitioning] = useState(false);
  const activePanel = MAP_PANELS.find(p => p.id === activeTab) ?? MAP_PANELS[0];

  const handleTabChange = (id: any) => {
    if (id === activeTab) return;
    setTransitioning(true);
    setTimeout(() => {
      setActiveTab(id);
      setTransitioning(false);
    }, 150);
  };

  return (
    <>
      {/* Inject keyframes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Orbitron:wght@400;600;700&display=swap');

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanDown {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes borderFlicker {
          0%, 95%, 100% { opacity: 1; }
          96%           { opacity: 0.6; }
          97%           { opacity: 1; }
          98%           { opacity: 0.7; }
          99%           { opacity: 1; }
        }
      `}</style>

      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#070B1A',
          fontFamily: "'DM Mono', monospace",
          animation: 'borderFlicker 8s ease-in-out infinite',
        }}
      >
        {/* ── TOP HEADER BAR ─────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            height: 44,
            background: 'linear-gradient(180deg, #0A0E27 0%, #080C1F 100%)',
            borderBottom: '1px solid rgba(0,217,255,0.12)',
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle gradient sweep */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(0,217,255,0.03) 50%, transparent 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* Left: System ID */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Logo mark */}
            <div style={{ position: 'relative', width: 20, height: 20, flexShrink: 0 }}>
              <div style={{
                position: 'absolute', inset: 0,
                border: '1.5px solid #00D9FF',
                borderRadius: 2,
                opacity: 0.8,
                transform: 'rotate(45deg)',
              }} />
              <div style={{
                position: 'absolute', inset: 4,
                background: '#00D9FF',
                borderRadius: 1,
                transform: 'rotate(45deg)',
              }} />
            </div>

            <div>
              <div style={{
                fontSize: 10,
                fontFamily: "'Orbitron', monospace",
                fontWeight: 700,
                color: '#00D9FF',
                letterSpacing: '0.25em',
                lineHeight: 1,
              }}>
                GEOINT
              </div>
              <div style={{ fontSize: 7, color: '#2A3860', letterSpacing: '0.2em', marginTop: 2 }}>
                GLOBAL SITUATIONAL AWARENESS
              </div>
            </div>

            <div style={{ width: 1, height: 24, background: 'rgba(0,217,255,0.12)', margin: '0 4px' }} />

            {/* Signal indicators */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {[
                { label: 'SAT', strength: 4, color: '#00D9FF' },
                { label: 'GEO', strength: 3, color: '#0FFF50' },
                { label: 'NET', strength: 4, color: '#C084FC' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <SignalBars color={s.color} strength={s.strength} />
                  <span style={{ fontSize: 7, color: '#3A4870', letterSpacing: '0.1em' }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Center: Ticker */}
          <div style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00D9FF', boxShadow: '0 0 8px #00D9FF', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <Ticker />
          </div>

          {/* Right: Clock + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Classification badge */}
            <div style={{
              fontSize: 7,
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '0.15em',
              color: '#FF1744',
              border: '1px solid rgba(255,23,68,0.3)',
              padding: '2px 6px',
              borderRadius: 2,
              background: 'rgba(255,23,68,0.08)',
            }}>
              UNCLASSIFIED
            </div>

            <div style={{ width: 1, height: 24, background: 'rgba(0,217,255,0.1)' }} />
            <LiveClock />
          </div>
        </div>

        {/* ── PANEL SWITCHER ─────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 12px',
            background: '#080C1F',
            borderBottom: `1px solid ${activePanel.accent}20`,
            gap: 4,
            overflowX: 'auto',
            flexShrink: 0,
            position: 'relative',
            scrollbarWidth: 'none',
          }}
        >
          {/* Active panel accent line on the bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              height: 1,
              background: `linear-gradient(90deg, transparent 0%, ${activePanel.accent}40 30%, ${activePanel.accent}40 70%, transparent 100%)`,
              transition: 'all 0.4s ease',
            }}
          />

          {/* "VIEW:" label */}
          <div style={{
            fontSize: 8,
            fontFamily: 'monospace',
            color: '#2A3860',
            letterSpacing: '0.2em',
            paddingRight: 8,
            borderRight: '1px solid rgba(0,217,255,0.08)',
            marginRight: 4,
            flexShrink: 0,
          }}>
            VIEW
          </div>

          {MAP_PANELS.map(panel => (
            <PanelTab
              key={panel.id}
              panel={panel}
              isActive={activeTab === panel.id}
              onClick={() => handleTabChange(panel.id)}
            />
          ))}

          {/* Right side: panel count */}
          <div style={{ marginLeft: 'auto', paddingLeft: 12, flexShrink: 0 }}>
            <div style={{
              fontSize: 8,
              fontFamily: 'monospace',
              color: '#2A3860',
              letterSpacing: '0.1em',
            }}>
              {MAP_PANELS.findIndex(p => p.id === activeTab) + 1}/{MAP_PANELS.length}
            </div>
          </div>
        </div>

        {/* ── ACTIVE PANEL LABEL STRIP ───────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 16px',
            background: `linear-gradient(90deg, ${activePanel.accent}06 0%, transparent 60%)`,
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            flexShrink: 0,
          }}
        >
          <div style={{
            width: 6, height: 6,
            border: `1px solid ${activePanel.accent}`,
            borderRadius: 1,
            transform: 'rotate(45deg)',
          }} />
          <span style={{
            fontSize: 9,
            fontFamily: "'Orbitron', monospace",
            fontWeight: 600,
            color: activePanel.accent,
            letterSpacing: '0.25em',
            opacity: 0.9,
          }}>
            {activePanel.label.toUpperCase()}
          </span>
          <div style={{
            flex: 1,
            height: 1,
            background: `linear-gradient(90deg, ${activePanel.accent}30, transparent)`,
            marginLeft: 4,
          }} />
          {/* Breadcrumb coords decoration */}
          <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#2A3860', letterSpacing: '0.1em' }}>
            MODULE · {(MAP_PANELS.findIndex(p => p.id === activeTab) + 1).toString().padStart(2, '0')}
          </span>
        </div>

        {/* ── MAP / PANEL CONTENT ────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Scanline overlay */}
          <ScanlineOverlay />

          {/* Corner brackets on the content area */}
          <CornerBracket position="tl" />
          <CornerBracket position="tr" />
          <CornerBracket position="bl" />
          <CornerBracket position="br" />

          {/* Content with fade transition */}
          <div
            style={{
              width: '100%',
              height: '100%',
              opacity: transitioning ? 0 : 1,
              transform: transitioning ? 'scale(0.995)' : 'scale(1)',
              transition: 'opacity 0.15s ease, transform 0.15s ease',
            }}
          >
            {MAP_PANELS.find(p => p.id === activeTab)?.component}
          </div>
        </div>

        {/* ── FOOTER STATUS BAR ──────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 16px',
            background: '#050819',
            borderTop: '1px solid rgba(0,217,255,0.08)',
            flexShrink: 0,
            height: 26,
          }}
        >
          {/* Left: Connection status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {[
              { label: 'GDELT', ok: true },
              { label: 'AIS',   ok: true },
              { label: 'SIGINT', ok: false },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: s.ok ? '#0FFF50' : '#FF1744',
                  boxShadow: s.ok ? '0 0 4px #0FFF50' : '0 0 4px #FF1744',
                  animation: s.ok ? 'pulse 2s ease-in-out infinite' : 'none',
                }} />
                <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#2A3860', letterSpacing: '0.1em' }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Center: Data freshness */}
          <div style={{ fontSize: 8, fontFamily: 'monospace', color: '#2A3860', letterSpacing: '0.1em' }}>
            LAST SYNC · 15MIN CADENCE · ALL FEEDS NOMINAL
          </div>

          {/* Right: Build info */}
          <div style={{ fontSize: 7, fontFamily: 'monospace', color: '#1A2240', letterSpacing: '0.1em' }}>
            SYS v2.4.1 · UNCLASSIFIED // FOUO
          </div>
        </div>
      </div>
    </>
  );
}