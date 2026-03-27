'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Terminal, Shield, AlertTriangle } from 'lucide-react';

// ── Demo credentials ──────────────────────────────────────────────────────────
export const DEMO_USER = { email: 'analyst@quantum.io', password: 'Demo@2025' };

interface LoginPageProps {
  onLogin: () => void;
  onGoToRegister: () => void;
}

// ── Animated scanline grid background ────────────────────────────────────────
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Dark base */}
      <div className="absolute inset-0 bg-[#04070F]" />

      {/* Radial glow center */}
      <div className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 40%, #0A1628 0%, transparent 70%)' }} />

      {/* Grid lines */}
      <div className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #00D9FF 1px, transparent 1px),
            linear-gradient(to bottom, #00D9FF 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }} />

      {/* Diagonal accent lines */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #00D9FF 0px, #00D9FF 1px, transparent 1px, transparent 60px)',
        }} />

      {/* Scanline sweep */}
      <div className="absolute inset-x-0 h-[2px] opacity-20 animate-scanline"
        style={{ background: 'linear-gradient(to right, transparent, #00D9FF, transparent)' }} />

      {/* Corner brackets */}
      {[
        'top-6 left-6 border-t border-l',
        'top-6 right-6 border-t border-r',
        'bottom-6 left-6 border-b border-l',
        'bottom-6 right-6 border-b border-r',
      ].map((cls, i) => (
        <div key={i} className={`absolute w-8 h-8 ${cls} border-[#00D9FF]/30`} />
      ))}

      {/* Floating data particles */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i}
          className="absolute text-[9px] font-mono text-[#00D9FF]/15 animate-float-data"
          style={{
            left: `${10 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
            animationDelay: `${i * 1.2}s`,
            animationDuration: `${8 + i}s`,
          }}>
          {['SYS::INIT', 'AUTH_GATE', 'ENCRYPT', 'TUNNEL_OK', 'NODE_42', 'VPN::OK'][i]}
        </div>
      ))}

      <style>{`
        @keyframes scanline {
          0% { top: -2px; }
          100% { top: 100%; }
        }
        .animate-scanline { animation: scanline 4s linear infinite; }

        @keyframes float-data {
          0%, 100% { opacity: 0.15; transform: translateY(0px); }
          50% { opacity: 0.05; transform: translateY(-20px); }
        }
        .animate-float-data { animation: float-data 8s ease-in-out infinite; }

        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .blink { animation: blink-cursor 1s step-end infinite; }

        @keyframes reveal-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .reveal-up { animation: reveal-up 0.5s ease forwards; }

        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 8px #00D9FF30; }
          50% { box-shadow: 0 0 20px #00D9FF60, 0 0 40px #00D9FF20; }
        }
        .glow-input:focus { animation: glow-pulse 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

// ── Terminal typing effect ────────────────────────────────────────────────────
function TerminalBoot() {
  const lines = [
    '> QUANTUM TERMINAL v2.4.1',
    '> Initializing secure channel...',
    '> AES-256 encryption: ACTIVE',
    '> GDELT feed: CONNECTED',
    '> Awaiting authentication...',
  ];
  const [shown, setShown] = useState<string[]>([]);

  useEffect(() => {
    lines.forEach((line, i) => {
      setTimeout(() => setShown(prev => [...prev, line]), i * 400 + 300);
    });
  }, []);

  return (
    <div className="font-mono text-[10px] text-[#00D9FF]/50 space-y-0.5 mb-6 h-[72px]">
      {shown.map((line, i) => (
        <div key={i} className="reveal-up" style={{ animationDelay: '0ms' }}>
          <span style={{ color: i === shown.length - 1 ? '#00D9FF' : '#00D9FF70' }}>{line}</span>
          {i === shown.length - 1 && <span className="blink ml-0.5 text-[#00D9FF]">█</span>}
        </div>
      ))}
    </div>
  );
}

// ── Main Login Page ───────────────────────────────────────────────────────────
export function LoginPage({ onLogin, onGoToRegister }: LoginPageProps) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [shake, setShake]       = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate auth delay
    await new Promise(r => setTimeout(r, 900));

    if (email === DEMO_USER.email && password === DEMO_USER.password) {
      // Store session
      sessionStorage.setItem('qt_auth', 'true');
      onLogin();
    } else {
      setLoading(false);
      setError('ACCESS DENIED — Invalid credentials');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  };

  const fillDemo = () => {
    setEmail(DEMO_USER.email);
    setPassword(DEMO_USER.password);
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <GridBackground />

      {/* Card */}
      <div
        className={`relative z-10 w-full max-w-sm mx-4 transition-transform ${shake ? 'animate-shake' : ''}`}
        style={{ animation: shake ? 'shake 0.5s ease' : undefined }}
      >
        {/* Outer glow */}
        <div className="absolute -inset-px rounded-2xl blur-sm opacity-40"
          style={{ background: 'linear-gradient(135deg, #00D9FF, #0A4A6E)' }} />

        <div className="relative rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #0A1628 0%, #060C1A 100%)',
            border: '1px solid #00D9FF25',
            boxShadow: '0 0 60px #00D9FF10, inset 0 1px 0 #00D9FF15',
          }}>

          {/* Top stripe */}
          <div className="h-px w-full"
            style={{ background: 'linear-gradient(to right, transparent, #00D9FF80, transparent)' }} />

          <div className="p-8">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <div className="absolute inset-0 rounded-lg blur-md bg-[#00D9FF] opacity-30" />
                <div className="relative w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: '#00D9FF15', border: '1px solid #00D9FF40' }}>
                  <Terminal className="w-5 h-5 text-[#00D9FF]" />
                </div>
              </div>
              <div>
                <div className="text-[11px] font-mono font-bold tracking-[0.25em] text-[#00D9FF]">QUANTUM</div>
                <div className="text-[9px] font-mono text-[#3A5470] tracking-[0.15em]">TERMINAL · INTEL SYSTEM</div>
              </div>
            </div>

            {/* Boot sequence */}
            <TerminalBoot />

            {/* Title */}
            <div className="mb-6">
              <h1 className="text-xl font-mono font-bold text-white tracking-tight">Operator Login</h1>
              <p className="text-[11px] font-mono text-[#3A5470] mt-1">Authenticate to access the terminal</p>
            </div>

            {/* Demo badge */}
            <button onClick={fillDemo}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg mb-5 text-left transition-all hover:brightness-110"
              style={{ background: '#00D9FF08', border: '1px dashed #00D9FF30' }}>
              <Shield className="w-3.5 h-3.5 text-[#00D9FF] shrink-0" />
              <div>
                <div className="text-[10px] font-mono font-bold text-[#00D9FF]">DEMO ACCESS</div>
                <div className="text-[9px] font-mono text-[#3A5470]">analyst@quantum.io · Demo@2025</div>
              </div>
              <div className="ml-auto text-[9px] font-mono text-[#00D9FF]/60">FILL ↗</div>
            </button>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-3">
              {/* Email */}
              <div>
                <label className="block text-[10px] font-mono text-[#4A6070] mb-1.5 tracking-wider">
                  OPERATOR ID / EMAIL
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="analyst@quantum.io"
                  required
                  className="glow-input w-full px-3 py-2.5 rounded-lg font-mono text-sm text-white placeholder-[#2A3A50] outline-none transition-all"
                  style={{
                    background: '#060C1A',
                    border: '1px solid #1A2A3A',
                    boxShadow: '0 0 0 0px #00D9FF',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#00D9FF50'}
                  onBlur={e => e.currentTarget.style.borderColor = '#1A2A3A'}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-mono text-[#4A6070] mb-1.5 tracking-wider">
                  ACCESS KEY
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="glow-input w-full px-3 py-2.5 pr-10 rounded-lg font-mono text-sm text-white placeholder-[#2A3A50] outline-none transition-all"
                    style={{
                      background: '#060C1A',
                      border: '1px solid #1A2A3A',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = '#00D9FF50'}
                    onBlur={e => e.currentTarget.style.borderColor = '#1A2A3A'}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3A5470] hover:text-[#00D9FF] transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: '#FF174408', border: '1px solid #FF174430' }}>
                  <AlertTriangle className="w-3.5 h-3.5 text-[#FF1744] shrink-0" />
                  <span className="text-[10px] font-mono text-[#FF1744]">{error}</span>
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-lg font-mono text-sm font-bold tracking-widest transition-all mt-1"
                style={{
                  background: loading ? '#00D9FF15' : 'linear-gradient(135deg, #00D9FF20, #0A6A8E30)',
                  border: `1px solid ${loading ? '#00D9FF30' : '#00D9FF60'}`,
                  color: loading ? '#00D9FF80' : '#00D9FF',
                  boxShadow: loading ? 'none' : '0 0 20px #00D9FF15',
                }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-[#00D9FF40] border-t-[#00D9FF] rounded-full animate-spin" />
                    AUTHENTICATING...
                  </span>
                ) : 'AUTHENTICATE →'}
              </button>
            </form>

            {/* Register link */}
            <div className="mt-5 text-center">
              <span className="text-[10px] font-mono text-[#3A5470]">No account? </span>
              <button onClick={onGoToRegister}
                className="text-[10px] font-mono text-[#00D9FF] hover:text-white transition-colors">
                REQUEST ACCESS
              </button>
            </div>
          </div>

          {/* Bottom stripe */}
          <div className="h-px w-full"
            style={{ background: 'linear-gradient(to right, transparent, #00D9FF30, transparent)' }} />
          <div className="px-8 py-2 flex justify-between items-center">
            <span className="text-[8px] font-mono text-[#1A2A3A]">QUANTUM TERMINAL © 2025</span>
            <span className="text-[8px] font-mono text-[#1A3A2A]">AES-256 · TLS 1.3</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}