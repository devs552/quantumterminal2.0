'use client';

import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number; // ms before auto-completing
}

export function SplashScreen({ onComplete, duration = 3200 }: SplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('hold'), 400);
    const exitTimer = setTimeout(() => setPhase('exit'), duration - 600);
    const doneTimer = setTimeout(onComplete, duration);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [duration, onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Courier New", Courier, monospace',
        overflow: 'hidden',
        opacity: phase === 'exit' ? 0 : 1,
        transition: phase === 'exit' ? 'opacity 0.6s ease-in' : 'none',
      }}
    >
      {/* Scanline overlay */}
      <div style={scanlineStyle} />

      {/* Grid background */}
      <div style={gridStyle} />

      {/* Corner brackets */}
      <CornerBrackets />

      {/* Main content */}
      <div style={{ position: 'relative', textAlign: 'center' }}>
        {/* MALIK'S */}
        <div
          style={{
            fontSize: 'clamp(12px, 3vw, 18px)',
            letterSpacing: '0.6em',
            color: '#00ff88',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
            opacity: phase === 'enter' ? 0 : 1,
            transform: phase === 'enter' ? 'translateY(-8px)' : 'translateY(0)',
            transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
          }}
        >
          MALIK&apos;S
        </div>

        {/* TERMINAL — big glitch text */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              fontSize: 'clamp(56px, 12vw, 120px)',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: '#fff',
              lineHeight: 1,
              opacity: phase === 'enter' ? 0 : 1,
              transform: phase === 'enter' ? 'scaleX(1.08)' : 'scaleX(1)',
              transition: 'opacity 0.4s ease 0.25s, transform 0.5s cubic-bezier(0.16,1,0.3,1) 0.25s',
              position: 'relative',
              zIndex: 2,
            }}
          >
            TERMINAL
          </div>

          {/* Glitch layers */}
          <GlitchLayer color="#00ff88" offset={[-3, 0]} delay="0s" />
          <GlitchLayer color="#ff003c" offset={[3, 0]} delay="0.07s" />
        </div>

        {/* "on your way" */}
        <div
          style={{
            marginTop: '1.5rem',
            fontSize: 'clamp(10px, 2vw, 14px)',
            letterSpacing: '0.35em',
            color: '#555',
            textTransform: 'uppercase',
            opacity: phase === 'enter' ? 0 : 1,
            transition: 'opacity 0.6s ease 0.55s',
          }}
        >
          on your way
          <BlinkingCursor />
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'clamp(160px, 30vw, 320px)',
        }}
      >
        <div
          style={{
            height: '1px',
            background: '#111',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent, #00ff88, transparent)',
              animation: `progressSweep ${duration - 800}ms linear ${400}ms forwards`,
              transform: 'translateX(-100%)',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '8px',
            fontSize: '9px',
            letterSpacing: '0.2em',
            color: '#333',
          }}
        >
          <span>INITIALIZING</span>
          <span>QNT-OS v4.1</span>
        </div>
      </div>

      <style>{`
        @keyframes progressSweep {
          from { transform: translateX(-100%); }
          to   { transform: translateX(100%); }
        }
        @keyframes glitch {
          0%, 90%, 100% { opacity: 0; clip-path: inset(100% 0 0 0); }
          91% { opacity: 0.6; clip-path: inset(20% 0 60% 0); transform: translateX(-3px); }
          93% { opacity: 0.4; clip-path: inset(60% 0 10% 0); transform: translateX(3px); }
          95% { opacity: 0.6; clip-path: inset(40% 0 40% 0); transform: translateX(-2px); }
          97% { opacity: 0; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes scanMove {
          from { transform: translateY(-100%); }
          to   { transform: translateY(100vh); }
        }
      `}</style>
    </div>
  );
}

function GlitchLayer({ color, offset, delay }: { color: string; offset: [number, number]; delay: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        fontSize: 'clamp(56px, 12vw, 120px)',
        fontWeight: 900,
        letterSpacing: '-0.02em',
        color,
        lineHeight: 1,
        mixBlendMode: 'screen',
        transform: `translate(${offset[0]}px, ${offset[1]}px)`,
        animation: `glitch 3s ${delay} infinite`,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      TERMINAL
    </div>
  );
}

function BlinkingCursor() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '8px',
        height: '1em',
        background: '#00ff88',
        marginLeft: '6px',
        verticalAlign: 'middle',
        animation: 'blink 1s step-end infinite',
      }}
    />
  );
}

function CornerBrackets() {
  const bracketStyle = (pos: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute',
    width: 40,
    height: 40,
    ...pos,
  });
  const lineColor = '#1a1a1a';
  return (
    <>
      {/* TL */}
      <div style={bracketStyle({ top: 24, left: 24 })}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 40, height: 1, background: lineColor }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 40, background: lineColor }} />
      </div>
      {/* TR */}
      <div style={bracketStyle({ top: 24, right: 24 })}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 40, height: 1, background: lineColor }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 1, height: 40, background: lineColor }} />
      </div>
      {/* BL */}
      <div style={bracketStyle({ bottom: 24, left: 24 })}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 40, height: 1, background: lineColor }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 1, height: 40, background: lineColor }} />
      </div>
      {/* BR */}
      <div style={bracketStyle({ bottom: 24, right: 24 })}>
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 40, height: 1, background: lineColor }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 1, height: 40, background: lineColor }} />
      </div>
    </>
  );
}

const scanlineStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
  pointerEvents: 'none',
  zIndex: 10,
};

const gridStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: `
    linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)
  `,
  backgroundSize: '60px 60px',
  pointerEvents: 'none',
};