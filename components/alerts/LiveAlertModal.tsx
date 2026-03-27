'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, AlertTriangle, Zap, Shield, Globe, TrendingDown, Radio, ExternalLink, Wifi, WifiOff } from 'lucide-react';

export type AlertSource   = 'gdelt' | 'markets' | 'crypto' | 'weather' | 'cyber' | 'military' | 'system';
export type AlertSeverity = 1 | 2 | 3 | 4 | 5;

export interface LiveAlert {
  id:        string;
  title:     string;
  body:      string;
  source:    AlertSource;
  severity:  AlertSeverity;
  timestamp: string | Date;   // accept both — SSE sends string, we coerce in modal
  url?:      string;
  location?: string;
  metadata?: Record<string, string | number>;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface LiveAlertModalProps {
  alert:     LiveAlert | null;
  onClose:   () => void;
  onSnooze?: () => void;
}

const SOURCE_CONFIG: Record<AlertSource, { label: string; color: string; icon: React.ReactNode; bg: string }> = {
  gdelt:    { label: 'GDELT INTEL',    color: '#FF1744', icon: <Globe className="w-4 h-4" />,         bg: '#FF174410' },
  markets:  { label: 'MARKETS',        color: '#FFD700', icon: <TrendingDown className="w-4 h-4" />,  bg: '#FFD70010' },
  crypto:   { label: 'CRYPTO',         color: '#C084FC', icon: <Zap className="w-4 h-4" />,           bg: '#C084FC10' },
  weather:  { label: 'WEATHER',        color: '#00D9FF', icon: <Radio className="w-4 h-4" />,         bg: '#00D9FF10' },
  cyber:    { label: 'CYBER THREAT',   color: '#FF6B00', icon: <Shield className="w-4 h-4" />,        bg: '#FF6B0010' },
  military: { label: 'MILITARY INTEL', color: '#FF1744', icon: <AlertTriangle className="w-4 h-4" />, bg: '#FF174410' },
  system:   { label: 'SYSTEM',         color: '#0FFF50', icon: <Zap className="w-4 h-4" />,           bg: '#0FFF5010' },
};

function SeverityBar({ level, color }: { level: AlertSeverity; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-5 h-1.5 rounded-sm"
            style={{ background: i < level ? color : '#1A2040', boxShadow: i < level ? `0 0 4px ${color}` : 'none' }} />
        ))}
      </div>
      <span className="text-[10px] font-mono" style={{ color }}>
        {['', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'EXTREME'][level]}
      </span>
    </div>
  );
}

export function LiveAlertModal({ alert, onClose, onSnooze }: LiveAlertModalProps) {
  const [visible,    setVisible]    = useState(false);
  const prevId    = useRef<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate in whenever a new alert arrives
  useEffect(() => {
    if (!alert) { setVisible(false); return; }
    if (alert.id === prevId.current) return;
    prevId.current = alert.id;
    setVisible(false);
    // Double-rAF: guarantees browser paints opacity:0 before we flip to 1
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    return () => cancelAnimationFrame(r);
  }, [alert]);

  const handleClose = useCallback(() => {
    setVisible(false);
    closeTimer.current = setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // Auto-dismiss severity 1–2 after 8 s
  useEffect(() => {
    if (!alert || alert.severity > 2) return;
    const t = setTimeout(handleClose, 8_000);
    return () => clearTimeout(t);
  }, [alert, handleClose]);

  if (!alert) return null;

  const cfg = SOURCE_CONFIG[alert.source] ?? SOURCE_CONFIG.system;
  const ts  = alert.timestamp instanceof Date ? alert.timestamp : new Date(alert.timestamp as string);

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pointer-events-none" style={{ paddingTop: '5vh' }}>

      {alert.severity >= 4 && (
        <div className="absolute inset-0 pointer-events-auto transition-opacity duration-300"
          style={{ background: `radial-gradient(ellipse at top, ${cfg.color}15 0%, transparent 70%)`, opacity: visible ? 1 : 0 }}
          onClick={handleClose} />
      )}

      <div className="relative pointer-events-auto w-full max-w-md mx-4 transition-all duration-300"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0) scale(1)' : 'translateY(-20px) scale(0.97)' }}>

        {/* Glow */}
        <div className="absolute inset-0 rounded-2xl blur-lg opacity-25 pointer-events-none"
          style={{ background: cfg.color, transform: 'scale(1.03)' }} />

        <div className="relative rounded-2xl overflow-hidden"
          style={{ background: '#0A0E27F5', border: `1px solid ${cfg.color}55`, backdropFilter: 'blur(20px)' }}>

          {/* Top bar */}
          <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)` }} />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ background: `${cfg.color}08`, borderBottom: `1px solid ${cfg.color}20` }}>
            <div className="flex items-center gap-2">
              <span className="relative flex">
                <span className="absolute inline-flex h-3 w-3 rounded-full opacity-50 animate-ping" style={{ background: cfg.color }} />
                <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: cfg.color }} />
              </span>
              <span className="text-[10px] font-mono font-bold tracking-widest" style={{ color: cfg.color }}>
                ⚡ LIVE ALERT — {cfg.label}
              </span>
            </div>
            <button onClick={handleClose} className="text-[#4A5470] hover:text-white transition-colors p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            <div>
              <h2 className="text-base font-mono font-bold text-white leading-tight">{alert.title}</h2>
              {alert.location && (
                <div className="flex items-center gap-1 mt-1">
                  <Globe className="w-3 h-3 text-[#4A5470]" />
                  <span className="text-[10px] font-mono text-[#7A8391]">{alert.location}</span>
                </div>
              )}
            </div>

            <p className="text-sm text-[#B0B9C1] leading-relaxed font-mono">{alert.body}</p>

            <div className="flex items-center justify-between">
              <SeverityBar level={alert.severity} color={cfg.color} />
              <span className="text-[9px] font-mono text-[#4A5470]">
                UTC {ts.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' })}
              </span>
            </div>

            {alert.metadata && Object.keys(alert.metadata).length > 0 && (
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg"
                style={{ background: '#0F143280', border: '1px solid #1A2040' }}>
                {Object.entries(alert.metadata).map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[9px] font-mono text-[#4A5470] uppercase">{k}</div>
                    <div className="text-xs font-mono" style={{ color: cfg.color }}>{v}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded"
                style={{ background: cfg.bg, border: `1px solid ${cfg.color}30`, color: cfg.color }}>
                {cfg.icon} {alert.source.toUpperCase()}
              </span>
              <span className="text-[9px] font-mono text-[#4A5470]">
                {ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 px-5 pb-5">
            {alert.url && (
              <a href={alert.url} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-bold transition-all hover:brightness-125"
                style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.color}50`, color: cfg.color }}>
                <ExternalLink className="w-3 h-3" /> VIEW SOURCE
              </a>
            )}
            {onSnooze && (
              <button onClick={onSnooze}
                className="flex-1 py-2 rounded-lg text-xs font-mono text-[#7A8391] border border-[#2A3050] hover:text-[#B0B9C1] hover:border-[#3A4060] transition-all">
                SNOOZE 5m
              </button>
            )}
            <button onClick={handleClose}
              className="flex-1 py-2 rounded-lg text-xs font-mono text-[#4A5470] border border-[#2A3050] hover:text-[#B0B9C1] hover:border-[#3A4060] transition-all">
              DISMISS
            </button>
          </div>

          <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}40, transparent)` }} />
        </div>
      </div>
    </div>
  );
}

// ── SSE Status Indicator ──────────────────────────────────────────────────────

export type SSEStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

export function AlertStreamIndicator({ status }: { status: SSEStatus }) {
  const colors: Record<SSEStatus, string> = {
    connecting: '#FFD700', connected: '#0FFF50', reconnecting: '#FF6B00', error: '#FF1744',
  };
  const c = colors[status];
  return (
    <div className="flex items-center gap-1.5 text-[9px] font-mono" style={{ color: c }}>
      {status === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      <span className="uppercase tracking-wider">{status}</span>
      {status === 'connected' && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: c }} />}
    </div>
  );
}

// ── useLiveAlerts ─────────────────────────────────────────────────────────────
//
// KEY DESIGN: The EventSource is opened ONCE on mount and never recreated.
// Previous versions put `pushAlert` or `connect` in useCallback dep arrays,
// causing the closure to recreate on every render, which closed+reopened
// the EventSource in a tight loop — messages were received by dead closures.
//
// Solution: store the latest pushAlert in a ref so `onmessage` always calls
// the current version without needing to be in any dependency array.

interface UseLiveAlertsOptions {
  severityThreshold?: AlertSeverity;
  sources?: AlertSource[];
}

export function useLiveAlerts({ severityThreshold = 3, sources }: UseLiveAlertsOptions = {}) {
  const [currentAlert, setCurrentAlert] = useState<LiveAlert | null>(null);
  const [alertQueue,   setAlertQueue]   = useState<LiveAlert[]>([]);
  const [streamStatus, setStreamStatus] = useState<SSEStatus>('connecting');

  const snoozedRef  = useRef<Set<string>>(new Set());
  const esRef       = useRef<EventSource | null>(null);
  const retryRef    = useRef(0);
  const retryTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── pushAlert stored in a ref so onmessage closure never goes stale ────────
  const pushAlertRef = useRef<(raw: LiveAlert) => void>(() => {});

  pushAlertRef.current = (raw: LiveAlert) => {
    console.log('[useLiveAlerts] pushAlert called:', raw.title, 'sev:', raw.severity, 'threshold:', severityThreshold);

    if (raw.severity < severityThreshold) {
      console.log('[useLiveAlerts] filtered out — below threshold');
      return;
    }
    if (snoozedRef.current.has(raw.source)) {
      console.log('[useLiveAlerts] filtered out — snoozed source');
      return;
    }

    // Normalise timestamp to Date
    const alert: LiveAlert = {
      ...raw,
      timestamp: raw.timestamp instanceof Date ? raw.timestamp : new Date(raw.timestamp as string),
    };

    console.log('[useLiveAlerts] queuing alert:', alert.id);
    setAlertQueue(q => q.some(a => a.id === alert.id) ? q : [...q, alert]);
  };

  // ── Open EventSource exactly ONCE ──────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams({ minSeverity: String(severityThreshold) });
    if (sources?.length) params.set('sources', sources.join(','));

    function open() {
      console.log('[useLiveAlerts] opening EventSource');
      const es = new EventSource(`/api/alerts/live?${params}`);
      esRef.current = es;
      setStreamStatus('connecting');

      es.onopen = () => {
        console.log('[useLiveAlerts] SSE connected');
        retryRef.current = 0;
        setStreamStatus('connected');
      };

      es.onmessage = (event) => {
        console.log('[useLiveAlerts] SSE message raw:', event.data.slice(0, 120));
        try {
          const msg = JSON.parse(event.data) as { type: string; payload?: LiveAlert };
          console.log('[useLiveAlerts] parsed type:', msg.type);
          if (msg.type === 'alert' && msg.payload) {
            pushAlertRef.current(msg.payload);
          }
        } catch (err) {
          console.warn('[useLiveAlerts] parse error:', err);
        }
      };

      es.onerror = () => {
        console.warn('[useLiveAlerts] SSE error/close');
        es.close();
        esRef.current = null;
        const delay = Math.min(2_000 * 2 ** retryRef.current, 30_000);
        retryRef.current++;
        if (retryRef.current <= 10) {
          setStreamStatus('reconnecting');
          retryTimer.current = setTimeout(open, delay);
        } else {
          setStreamStatus('error');
        }
      };
    }

    open();

    return () => {
      console.log('[useLiveAlerts] cleanup — closing EventSource');
      esRef.current?.close();
      clearTimeout(retryTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← empty deps: open ONCE, never reconnect due to re-renders

  // ── Dequeue: promote next alert when slot is free ─────────────────────────
  useEffect(() => {
    console.log('[useLiveAlerts] dequeue check — currentAlert:', !!currentAlert, 'queue:', alertQueue.length);
    if (currentAlert !== null || alertQueue.length === 0) return;
    const [next, ...rest] = alertQueue;
    console.log('[useLiveAlerts] dequeuing:', next.id);
    setCurrentAlert(next);
    setAlertQueue(rest);
  }, [currentAlert, alertQueue]);

  const closeAlert = useCallback(() => {
    console.log('[useLiveAlerts] closeAlert');
    setCurrentAlert(null);
  }, []);

  const snoozeAlert = useCallback(() => {
    setCurrentAlert(cur => {
      if (!cur) return null;
      snoozedRef.current.add(cur.source);
      setTimeout(() => snoozedRef.current.delete(cur.source), 5 * 60_000);
      return null;
    });
  }, []);

  return { currentAlert, closeAlert, snoozeAlert, streamStatus, queueLength: alertQueue.length };
}