'use client';

import React, { useState, useEffect, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface LoginPageProps {
  onLogin?: () => void;
  onGoToRegister?: () => void;
}

interface FeedItem {
  dot: 'green' | 'amber' | 'red';
  text: string;
  highlight: string;
  time: string;
}

interface StatCard {
  label: string;
  value: string;
  badge: string;
  accent: string;
  valueColor: string;
  badgeColor: string;
}

// ── Demo credentials ──────────────────────────────────────────────────────────
export const DEMO_CREDENTIALS = {
  email: 'analyst@qih.io',
  password: 'Demo@2025',
};

// ── Keyframe CSS ─────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Syne:wght@400;500;600;700;800&display=swap');

  @keyframes qih-scan {
    0%   { top: -2px; }
    100% { top: 100%; }
  }
  @keyframes qih-float {
    0%, 100% { opacity: 0.12; transform: translateY(0px); }
    50%       { opacity: 0.04; transform: translateY(-16px); }
  }
  @keyframes qih-blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
  @keyframes qih-reveal {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes qih-shake {
    0%,100% { transform: translateX(0); }
    18%     { transform: translateX(-8px); }
    36%     { transform: translateX(8px); }
    54%     { transform: translateX(-5px); }
    72%     { transform: translateX(5px); }
  }
  @keyframes qih-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes qih-bar-grow {
    from { height: 0px; }
  }
  @keyframes qih-fade-in {
    from { opacity: 0; transform: translateX(-6px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes qih-pulse-dot {
    0%, 100% { box-shadow: 0 0 4px currentColor; }
    50%       { box-shadow: 0 0 12px currentColor; }
  }
  @keyframes qih-number-flash {
    0%   { opacity: 1; }
    50%  { opacity: 0.4; }
    100% { opacity: 1; }
  }
  @keyframes qih-border-flow {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .qih-root *,
  .qih-root *::before,
  .qih-root *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .qih-root {
    font-family: 'JetBrains Mono', monospace;
    background: #020810;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .qih-card {
    display: flex;
    width: 100%;
    max-width: 980px;
    min-height: 620px;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid #0d2035;
    position: relative;
  }

  /* ── LEFT PANEL ─────────────────────────────────────────────────────────── */
  .qih-left {
    width: 52%;
    background: #02060f;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 44px 48px;
  }

  .qih-grid-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .qih-grid-svg {
    width: 100%;
    height: 100%;
    opacity: 0.065;
  }

  .qih-scanline {
    position: absolute;
    left: 0;
    right: 0;
    height: 1.5px;
    background: linear-gradient(90deg, transparent, #00d4f5, transparent);
    animation: qih-scan 3.8s linear infinite;
    top: 0;
    pointer-events: none;
  }

  .qih-corner {
    position: absolute;
    width: 20px;
    height: 20px;
    border-color: #00d4f520;
    pointer-events: none;
  }
  .qih-corner-tl { top: 16px; left: 16px; border-top: 1px solid; border-left: 1px solid; }
  .qih-corner-tr { top: 16px; right: 16px; border-top: 1px solid; border-right: 1px solid; }
  .qih-corner-bl { bottom: 16px; left: 16px; border-bottom: 1px solid; border-left: 1px solid; }
  .qih-corner-br { bottom: 16px; right: 16px; border-bottom: 1px solid; border-right: 1px solid; }

  .qih-particle {
    position: absolute;
    font-size: 8px;
    color: #00d4f515;
    font-family: 'JetBrains Mono', monospace;
    pointer-events: none;
    letter-spacing: .1em;
  }

  /* Logo */
  .qih-logo-row {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 26px;
    position: relative;
    z-index: 2;
  }

  .qih-logo-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: #00d4f510;
    border: 1px solid #00d4f830;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    flex-shrink: 0;
  }

  .qih-logo-icon svg {
    width: 22px;
    height: 22px;
    color: #00d4f5;
  }

  .qih-logo-text .brand {
    font-family: 'Syne', sans-serif;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: .22em;
    color: #00d4f5;
    line-height: 1;
  }

  .qih-logo-text .sub {
    font-size: 7.5px;
    letter-spacing: .18em;
    color: #1a3a52;
    margin-top: 4px;
  }

  /* Boot */
  .qih-boot {
    font-size: 9px;
    color: #00d4f550;
    line-height: 1.9;
    margin-bottom: 24px;
    min-height: 86px;
    position: relative;
    z-index: 2;
  }

  .qih-boot-line {
    display: block;
    animation: qih-reveal 0.3s ease forwards;
    opacity: 0;
  }

  .qih-boot-line.active-line { color: #00d4f5; }

  .qih-cursor {
    display: inline-block;
    animation: qih-blink 1s step-end infinite;
    color: #00d4f5;
    margin-left: 2px;
  }

  /* Headline */
  .qih-headline {
    font-family: 'Syne', sans-serif;
    font-size: 26px;
    font-weight: 800;
    color: #e2f4ff;
    letter-spacing: -.4px;
    margin-bottom: 5px;
    position: relative;
    z-index: 2;
    line-height: 1.15;
  }

  .qih-subline {
    font-size: 9px;
    color: #1e3a52;
    margin-bottom: 26px;
    letter-spacing: .14em;
    position: relative;
    z-index: 2;
  }

  /* Demo button */
  .qih-demo-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #00d4f508;
    border: 1px dashed #00d4f825;
    border-radius: 10px;
    padding: 10px 14px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
    margin-bottom: 22px;
    width: 100%;
    text-align: left;
    position: relative;
    z-index: 2;
  }

  .qih-demo-btn:hover {
    background: #00d4f812;
    border-color: #00d4f840;
  }

  .qih-demo-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .qih-demo-icon svg {
    width: 16px;
    height: 16px;
    color: #00d4f5;
  }

  .qih-demo-label { font-size: 9px; font-weight: 700; color: #00d4f5; letter-spacing: .14em; }
  .qih-demo-creds { font-size: 8px; color: #1e3a52; margin-top: 3px; }
  .qih-demo-arrow { margin-left: auto; font-size: 8.5px; color: #00d4f540; }

  /* Form */
  .qih-form { position: relative; z-index: 2; }

  .qih-field { margin-bottom: 14px; }

  .qih-label {
    display: block;
    font-size: 8.5px;
    color: #2a4a60;
    letter-spacing: .16em;
    margin-bottom: 7px;
  }

  .qih-input-wrap { position: relative; }

  .qih-input {
    width: 100%;
    background: #050d1a;
    border: 1px solid #0c1e30;
    border-radius: 9px;
    padding: 11px 14px;
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    color: #b8daf0;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .qih-input:focus {
    border-color: #00d4f540;
    box-shadow: 0 0 0 3px #00d4f510;
  }

  .qih-input::placeholder { color: #0c2030; }

  .qih-eye-btn {
    position: absolute;
    right: 11px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: #1a3545;
    padding: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .qih-eye-btn:hover { color: #00d4f5; }

  .qih-eye-btn svg { width: 16px; height: 16px; }

  /* Error */
  .qih-error {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #ff174408;
    border: 1px solid #ff174428;
    border-radius: 8px;
    padding: 9px 12px;
    margin-bottom: 12px;
    font-size: 9px;
    color: #ff5252;
  }

  .qih-error svg { width: 14px; height: 14px; flex-shrink: 0; }

  /* Submit */
  .qih-submit {
    width: 100%;
    padding: 12px;
    border-radius: 10px;
    background: #00d4f510;
    border: 1px solid #00d4f840;
    color: #00d4f5;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: .2em;
    font-family: 'JetBrains Mono', monospace;
    cursor: pointer;
    transition: background 0.2s, box-shadow 0.2s, opacity 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .qih-submit:hover:not(:disabled) {
    background: #00d4f818;
    box-shadow: 0 0 24px #00d4f814;
  }

  .qih-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .qih-submit.success {
    background: #00d4f818;
    border-color: #00d4f860;
    color: #00d4f5;
  }

  .qih-spinner {
    width: 13px;
    height: 13px;
    border: 2px solid #00d4f830;
    border-top-color: #00d4f5;
    border-radius: 50%;
    animation: qih-spin 0.7s linear infinite;
  }

  /* Register */
  .qih-register {
    text-align: center;
    margin-top: 18px;
    font-size: 9px;
    color: #1a3040;
    position: relative;
    z-index: 2;
  }

  .qih-register-link {
    color: #00d4f5;
    cursor: pointer;
    background: none;
    border: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    padding: 0;
    transition: color 0.2s;
  }

  .qih-register-link:hover { color: #c0f0ff; }

  /* Divider */
  .qih-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, #00d4f815, transparent);
    margin: 18px 0;
    position: relative;
    z-index: 2;
  }

  /* Footer */
  .qih-footer {
    display: flex;
    justify-content: space-between;
    font-size: 7px;
    color: #0c1e2e;
    position: relative;
    z-index: 2;
  }

  /* ── RIGHT PANEL ────────────────────────────────────────────────────────── */
  .qih-right {
    width: 48%;
    background: #01030a;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    border-left: 1px solid #0a1825;
  }

  .qih-right-glow {
    position: absolute;
    top: -80px;
    right: -100px;
    width: 340px;
    height: 340px;
    border-radius: 50%;
    background: #00d4f505;
    filter: blur(50px);
    pointer-events: none;
  }

  .qih-right-glow2 {
    position: absolute;
    bottom: -60px;
    left: -80px;
    width: 260px;
    height: 260px;
    border-radius: 50%;
    background: #0060a008;
    filter: blur(40px);
    pointer-events: none;
  }

  /* Stats */
  .qih-stats {
    padding: 32px 32px 22px;
    position: relative;
    z-index: 2;
  }

  .qih-section-label {
    font-size: 8px;
    letter-spacing: .24em;
    color: #00d4f550;
    margin-bottom: 16px;
  }

  .qih-stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .qih-stat {
    background: #050d1a;
    border: 1px solid #0a1825;
    border-radius: 11px;
    padding: 14px 15px 12px;
    position: relative;
    overflow: hidden;
  }

  .qih-stat-accent {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    border-radius: 2px 2px 0 0;
  }

  .qih-stat-label { font-size: 7.5px; color: #1a3445; letter-spacing: .1em; margin-bottom: 8px; }
  .qih-stat-value { font-size: 20px; font-weight: 700; font-family: 'Syne', sans-serif; line-height: 1; }
  .qih-stat-badge {
    display: inline-block;
    font-size: 7.5px;
    padding: 2px 8px;
    border-radius: 20px;
    margin-top: 7px;
  }

  /* Feed */
  .qih-feed {
    padding: 0 32px 18px;
    position: relative;
    z-index: 2;
    flex: 1;
  }

  .qih-feed-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 9px;
    opacity: 0;
  }

  .qih-feed-item.visible {
    animation: qih-fade-in 0.4s ease forwards;
  }

  .qih-feed-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-top: 5px;
    flex-shrink: 0;
    animation: qih-pulse-dot 2.5s ease-in-out infinite;
  }

  .qih-feed-text {
    font-size: 8.5px;
    color: #1a3445;
    line-height: 1.65;
    flex: 1;
  }

  .qih-feed-highlight { color: #00d4f570; }
  .qih-feed-time { font-size: 7.5px; color: #0c1e2e; flex-shrink: 0; }

  /* Chart */
  .qih-chart {
    padding: 0 32px 26px;
    position: relative;
    z-index: 2;
  }

  .qih-bars {
    display: flex;
    align-items: flex-end;
    gap: 5px;
    height: 54px;
  }

  .qih-bar {
    flex: 1;
    border-radius: 3px 3px 0 0;
    position: relative;
    cursor: default;
    transition: opacity 0.2s;
  }

  .qih-bar:hover { opacity: 0.65; }

  .qih-bar-label {
    position: absolute;
    bottom: -15px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 6.5px;
    color: #0c1e2e;
    white-space: nowrap;
    font-family: 'JetBrains Mono', monospace;
  }

  /* Shake animation for card */
  .qih-shake { animation: qih-shake 0.45s ease; }
`;

// ── Inline SVG Icons ──────────────────────────────────────────────────────────
const TerminalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ── Boot sequence lines ───────────────────────────────────────────────────────
const BOOT_LINES = [
  '> QUANTUM INTELLIGENCE HUB v3.1.0',
  '> Initializing secure channel...',
  '> AES-256-GCM encryption: ACTIVE',
  '> OSINT feed: CONNECTED [18,932 events]',
  '> Zero-trust gateway: ONLINE',
  '> Awaiting operator authentication...',
];

// ── Feed data ─────────────────────────────────────────────────────────────────
const FEED_ITEMS: FeedItem[] = [
  { dot: 'green', text: 'NODE_08 authenticated successfully', highlight: 'NODE_08', time: '00:12s' },
  { dot: 'amber', text: 'Threat index elevated — APAC region', highlight: 'APAC region', time: '00:08s' },
  { dot: 'red',   text: '7 anomalies flagged for immediate review', highlight: '7 anomalies', time: '00:05s' },
  { dot: 'green', text: 'GDELT feed synced — 18,932 intel events', highlight: '18,932 intel events', time: '00:02s' },
  { dot: 'amber', text: 'Firewall rule updated: RULE_042', highlight: 'RULE_042', time: '00:01s' },
];

// ── Stat cards ────────────────────────────────────────────────────────────────
const STAT_CARDS: StatCard[] = [
  {
    label: 'ACTIVE NODES',
    value: '2,847',
    badge: '▲ 2.1%',
    accent: '#00d4f840',
    valueColor: '#00d4f5',
    badgeColor: 'background:#00d4f812;color:#00d4f5',
  },
  {
    label: 'THREAT SCORE',
    value: '64.2',
    badge: 'ELEVATED',
    accent: '#f59e0b40',
    valueColor: '#f59e0b',
    badgeColor: 'background:#f59e0b12;color:#f59e0b',
  },
  {
    label: 'INTEL EVENTS',
    value: '18,932',
    badge: 'LIVE',
    accent: '#60a5fa40',
    valueColor: '#60a5fa',
    badgeColor: 'background:#60a5fa12;color:#60a5fa',
  },
  {
    label: 'ANOMALIES',
    value: '7',
    badge: 'CRITICAL',
    accent: '#ef444440',
    valueColor: '#f87171',
    badgeColor: 'background:#f8717112;color:#f87171',
  },
];

// ── Chart data ────────────────────────────────────────────────────────────────
const CHART_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const CHART_VALS = [62, 78, 55, 90, 71, 83, 95];

// ── Particles ─────────────────────────────────────────────────────────────────
const PARTICLES = [
  { text: 'SYS::INIT',   left: '8%',  top: '15%', delay: '0s',   dur: '9s'  },
  { text: 'AUTH_GATE',   left: '68%', top: '10%', delay: '1.4s', dur: '11s' },
  { text: 'ENCRYPT',     left: '22%', top: '70%', delay: '2.8s', dur: '8s'  },
  { text: 'VPN::OK',     left: '76%', top: '66%', delay: '0.7s', dur: '10s' },
  { text: 'TLS 1.3',     left: '50%', top: '83%', delay: '3.5s', dur: '9s'  },
  { text: 'ZERO_TRUST',  left: '38%', top: '5%',  delay: '1.8s', dur: '12s' },
];

// ── TerminalBoot component ────────────────────────────────────────────────────
function TerminalBoot() {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    BOOT_LINES.forEach((_, i) => {
      setTimeout(() => setVisibleCount(i + 1), 380 + i * 360);
    });
  }, []);

  return (
    <div className="qih-boot">
      {BOOT_LINES.slice(0, visibleCount).map((line, i) => (
        <span
          key={i}
          className={`qih-boot-line${i === visibleCount - 1 ? ' active-line' : ''}`}
        >
          {line}
          {i === visibleCount - 1 && <span className="qih-cursor">█</span>}
        </span>
      ))}
    </div>
  );
}

// ── LiveFeed component ────────────────────────────────────────────────────────
function LiveFeed() {
  const [visibleItems, setVisibleItems] = useState<number[]>([]);

  useEffect(() => {
    FEED_ITEMS.forEach((_, i) => {
      setTimeout(() => setVisibleItems(prev => [...prev, i]), 700 + i * 300);
    });
  }, []);

  const dotColors: Record<FeedItem['dot'], string> = {
    green: '#00d4f5',
    amber: '#f59e0b',
    red:   '#ef4444',
  };

  return (
    <div className="qih-feed">
      <div className="qih-section-label">── SYSTEM LOG ──</div>
      {FEED_ITEMS.map((item, i) => (
        <div
          key={i}
          className={`qih-feed-item${visibleItems.includes(i) ? ' visible' : ''}`}
          style={{ animationDelay: '0ms' }}
        >
          <div
            className="qih-feed-dot"
            style={{ background: dotColors[item.dot], color: dotColors[item.dot] }}
          />
          <div className="qih-feed-text">
            {item.text.replace(item.highlight, '').split('').length > 0
              ? item.text
                  .split(item.highlight)
                  .map((part, j, arr) => (
                    <React.Fragment key={j}>
                      {part}
                      {j < arr.length - 1 && (
                        <span className="qih-feed-highlight">{item.highlight}</span>
                      )}
                    </React.Fragment>
                  ))
              : item.text}
          </div>
          <div className="qih-feed-time">{item.time}</div>
        </div>
      ))}
    </div>
  );
}

// ── BarChart component ────────────────────────────────────────────────────────
function BarChart() {
  const [animated, setAnimated] = useState(false);
  const maxVal = Math.max(...CHART_VALS);
  const barColors = [
    '#00d4f840', '#00d4f850', '#00d4f838',
    '#00d4f868', '#00d4f850', '#00d4f860', '#00d4f878',
  ];

  useEffect(() => {
    setTimeout(() => setAnimated(true), 800);
  }, []);

  return (
    <div className="qih-chart">
      <div className="qih-section-label">── SIGNAL ACTIVITY (7-DAY) ──</div>
      <div className="qih-bars">
        {CHART_DAYS.map((day, i) => (
          <div
            key={day}
            className="qih-bar"
            style={{
              height: animated ? `${(CHART_VALS[i] / maxVal) * 54}px` : '0px',
              background: barColors[i],
              transition: `height 0.6s cubic-bezier(.22,1,.36,1) ${i * 70}ms`,
            }}
            title={`${day}: ${CHART_VALS[i]}`}
          >
            <span className="qih-bar-label">{day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── LiveStats component ───────────────────────────────────────────────────────
function LiveStats() {
  const [values, setValues] = useState(STAT_CARDS.map(c => c.value));

  useEffect(() => {
    const bases = [2847, 64.2, 18932, 7];
    const ranges = [15, 2, 40, 1];
    const decimals = [0, 1, 0, 0];

    const interval = setInterval(() => {
      setValues(bases.map((base, i) => {
        const jitter = base + (Math.random() * ranges[i] * 2 - ranges[i]);
        return decimals[i] > 0
          ? jitter.toFixed(decimals[i])
          : Math.round(jitter).toLocaleString();
      }));
    }, 3500 + Math.random() * 1200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="qih-stats">
      <div className="qih-section-label">── LIVE THREAT INTELLIGENCE ──</div>
      <div className="qih-stat-grid">
        {STAT_CARDS.map((card, i) => (
          <div key={card.label} className="qih-stat">
            <div className="qih-stat-accent" style={{ background: card.accent }} />
            <div className="qih-stat-label">{card.label}</div>
            <div className="qih-stat-value" style={{ color: card.valueColor }}>
              {values[i]}
            </div>
            <div className="qih-stat-badge" style={{ cssText: card.badgeColor } as React.CSSProperties}>
              {card.badge}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main LoginPage component ──────────────────────────────────────────────────
export function LoginPage({ onLogin, onGoToRegister }: LoginPageProps) {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [shake, setShake]         = useState(false);
  const cardRef                   = useRef<HTMLDivElement>(null);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const fillDemo = () => {
    setEmail(DEMO_CREDENTIALS.email);
    setPassword(DEMO_CREDENTIALS.password);
    setError('');
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSuccess(false);

    await new Promise(r => setTimeout(r, 980));

    if (email === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) {
      setLoading(false);
      setSuccess(true);
      sessionStorage.setItem('qih_auth', 'true');
      setTimeout(() => {
        setSuccess(false);
        onLogin?.();
      }, 2000);
    } else {
      setLoading(false);
      setError('ACCESS DENIED — Invalid operator credentials');
      triggerShake();
    }
  };

  return (
    <div className="qih-root">
      <style>{GLOBAL_CSS}</style>

      <div
        ref={cardRef}
        className={`qih-card${shake ? ' qih-shake' : ''}`}
      >
        {/* ── LEFT PANEL ────────────────────────────────────────────── */}
        <div className="qih-left">
          {/* Grid background */}
          <div className="qih-grid-bg">
            <svg className="qih-grid-svg" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="qih-grid" width="44" height="44" patternUnits="userSpaceOnUse">
                  <path d="M 44 0 L 0 0 0 44" fill="none" stroke="#00d4f5" strokeWidth="0.8" />
                </pattern>
                <pattern id="qih-diag" width="60" height="60" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="60" x2="60" y2="0" stroke="#00d4f5" strokeWidth="0.6" opacity="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#qih-grid)" />
              <rect width="100%" height="100%" fill="url(#qih-diag)" opacity="0.3" />
            </svg>
            <div className="qih-scanline" />
          </div>

          {/* Corners */}
          <div className="qih-corner qih-corner-tl" />
          <div className="qih-corner qih-corner-tr" />
          <div className="qih-corner qih-corner-bl" />
          <div className="qih-corner qih-corner-br" />

          {/* Particles */}
          {PARTICLES.map((p, i) => (
            <div
              key={i}
              className="qih-particle"
              style={{
                left: p.left,
                top: p.top,
                animationDelay: p.delay,
                animationDuration: p.dur,
                animation: `qih-float ${p.dur} ease-in-out ${p.delay} infinite`,
              }}
            >
              {p.text}
            </div>
          ))}

          {/* Logo */}
          <div className="qih-logo-row">
            <div className="qih-logo-icon">
              <TerminalIcon />
            </div>
            <div className="qih-logo-text">
              <div className="brand">QUANTUM INTELLIGENCE HUB</div>
              <div className="sub">SECURE OPERATOR TERMINAL · v3.1</div>
            </div>
          </div>

          {/* Boot sequence */}
          <TerminalBoot />

          {/* Headline */}
          <div className="qih-headline">Operator Login</div>
          <div className="qih-subline">AUTHENTICATE TO ACCESS THE INTELLIGENCE HUB</div>

          {/* Demo badge */}
          <button className="qih-demo-btn" onClick={fillDemo} type="button" aria-label="Fill demo credentials">
            <div className="qih-demo-icon"><ShieldIcon /></div>
            <div>
              <div className="qih-demo-label">DEMO ACCESS</div>
              <div className="qih-demo-creds">analyst@qih.io · Demo@2025</div>
            </div>
            <div className="qih-demo-arrow">FILL ↗</div>
          </button>

          {/* Form */}
          <form className="qih-form" onSubmit={handleSubmit} noValidate>
            <div className="qih-field">
              <label className="qih-label" htmlFor="qih-email">OPERATOR ID / EMAIL</label>
              <div className="qih-input-wrap">
                <input
                  id="qih-email"
                  className="qih-input"
                  type="email"
                  placeholder="analyst@qih.io"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="qih-field">
              <label className="qih-label" htmlFor="qih-pass">ACCESS KEY</label>
              <div className="qih-input-wrap">
                <input
                  id="qih-pass"
                  className="qih-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: '38px' }}
                />
                <button
                  type="button"
                  className="qih-eye-btn"
                  onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {error && (
              <div className="qih-error" role="alert">
                <AlertIcon />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className={`qih-submit${success ? ' success' : ''}`}
              disabled={loading || success}
            >
              {loading && <span className="qih-spinner" />}
              {loading && 'AUTHENTICATING...'}
              {success && <><CheckIcon />ACCESS GRANTED</>}
              {!loading && !success && 'AUTHENTICATE →'}
            </button>
          </form>

          <div className="qih-divider" />

          <div className="qih-register">
            No account?{' '}
            <button
              className="qih-register-link"
              onClick={onGoToRegister}
              type="button"
            >
              REQUEST ACCESS
            </button>
          </div>

          <div className="qih-footer">
            <span>QUANTUM INTELLIGENCE HUB © 2025</span>
            <span>AES-256-GCM · TLS 1.3</span>
          </div>
        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────────── */}
        <div className="qih-right">
          <div className="qih-right-glow" />
          <div className="qih-right-glow2" />

          <LiveStats />
          <LiveFeed />
          <BarChart />
        </div>
      </div>
    </div>
  );
}

export default LoginPage;