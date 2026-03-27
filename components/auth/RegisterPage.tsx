'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Terminal, Shield, CheckCircle, AlertTriangle } from 'lucide-react';

interface RegisterPageProps {
  onGoToLogin: () => void;
}

function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[#04070F]" />
      <div className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 40%, #0A1628 0%, transparent 70%)' }} />
      <div className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #00D9FF 1px, transparent 1px),
            linear-gradient(to bottom, #00D9FF 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }} />
      <div className="absolute inset-x-0 h-[2px] opacity-20 animate-scanline"
        style={{ background: 'linear-gradient(to right, transparent, #00D9FF, transparent)' }} />
      {['top-6 left-6 border-t border-l', 'top-6 right-6 border-t border-r',
        'bottom-6 left-6 border-b border-l', 'bottom-6 right-6 border-b border-r'].map((cls, i) => (
        <div key={i} className={`absolute w-8 h-8 ${cls} border-[#00D9FF]/20`} />
      ))}
      <style>{`
        @keyframes scanline { 0% { top: -2px; } 100% { top: 100%; } }
        .animate-scanline { animation: scanline 4s linear infinite; }
      `}</style>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'Min 8 chars',       pass: password.length >= 8 },
    { label: 'Uppercase',         pass: /[A-Z]/.test(password) },
    { label: 'Number',            pass: /\d/.test(password) },
    { label: 'Special char',      pass: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter(c => c.pass).length;
  const colors = ['#FF1744', '#FF6B00', '#FFD700', '#0FFF50'];
  const labels = ['WEAK', 'FAIR', 'GOOD', 'STRONG'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full transition-all duration-300"
            style={{ background: i < score ? colors[score - 1] : '#1A2A3A' }} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          {checks.map(c => (
            <span key={c.label} className="text-[9px] font-mono flex items-center gap-0.5"
              style={{ color: c.pass ? '#0FFF50' : '#2A3A50' }}>
              {c.pass ? '✓' : '·'} {c.label}
            </span>
          ))}
        </div>
        {score > 0 && (
          <span className="text-[9px] font-mono font-bold" style={{ color: colors[score - 1] }}>
            {labels[score - 1]}
          </span>
        )}
      </div>
    </div>
  );
}

export function RegisterPage({ onGoToLogin }: RegisterPageProps) {
  const [form, setForm] = useState({ name: '', email: '', role: '', password: '', confirm: '' });
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState(false);
  const [loading, setLoading]         = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('ACCESS KEYS do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Access key must be at least 8 characters');
      return;
    }

    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    setSuccess(true);
  };

  const inputStyle = {
    background: '#060C1A',
    border: '1px solid #1A2A3A',
  };

  const focusStyle = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.currentTarget.style.borderColor = '#00D9FF50');
  const blurStyle = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.currentTarget.style.borderColor = '#1A2A3A');

  const inputClass = 'w-full px-3 py-2.5 rounded-lg font-mono text-sm text-white placeholder-[#2A3A50] outline-none transition-all';

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <GridBackground />
        <div className="relative z-10 w-full max-w-sm mx-4 text-center">
          <div className="absolute -inset-px rounded-2xl blur-sm opacity-30"
            style={{ background: 'linear-gradient(135deg, #0FFF50, #00D9FF)' }} />
          <div className="relative rounded-2xl p-10"
            style={{ background: '#060C1A', border: '1px solid #0FFF5025' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#0FFF5015', border: '1px solid #0FFF5040', boxShadow: '0 0 30px #0FFF5020' }}>
              <CheckCircle className="w-7 h-7 text-[#0FFF50]" />
            </div>
            <h2 className="text-lg font-mono font-bold text-white mb-2">ACCESS REQUESTED</h2>
            <p className="text-xs font-mono text-[#3A5470] mb-6 leading-relaxed">
              Your operator account has been created.<br />
              In production, an admin would approve your request.
            </p>
            <button onClick={onGoToLogin}
              className="w-full py-2.5 rounded-lg font-mono text-sm font-bold tracking-widest transition-all"
              style={{ background: '#00D9FF15', border: '1px solid #00D9FF40', color: '#00D9FF' }}>
              PROCEED TO LOGIN →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative py-8">
      <GridBackground />

      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="absolute -inset-px rounded-2xl blur-sm opacity-30"
          style={{ background: 'linear-gradient(135deg, #00D9FF, #0A4A6E)' }} />

        <div className="relative rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #0A1628 0%, #060C1A 100%)',
            border: '1px solid #00D9FF20',
            boxShadow: '0 0 60px #00D9FF08',
          }}>
          <div className="h-px w-full"
            style={{ background: 'linear-gradient(to right, transparent, #00D9FF60, transparent)' }} />

          <div className="p-8">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-lg blur-md bg-[#00D9FF] opacity-20" />
                <div className="relative w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: '#00D9FF10', border: '1px solid #00D9FF30' }}>
                  <Terminal className="w-5 h-5 text-[#00D9FF]" />
                </div>
              </div>
              <div>
                <div className="text-[11px] font-mono font-bold tracking-[0.25em] text-[#00D9FF]">QUANTUM</div>
                <div className="text-[9px] font-mono text-[#3A5470] tracking-[0.15em]">REQUEST ACCESS</div>
              </div>
            </div>

            <div className="mb-5">
              <h1 className="text-xl font-mono font-bold text-white tracking-tight">Register Operator</h1>
              <p className="text-[11px] font-mono text-[#3A5470] mt-1">Create your terminal account</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-3">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-mono text-[#4A6070] mb-1.5 tracking-wider">FULL NAME</label>
                <input type="text" value={form.name} onChange={set('name')}
                  placeholder="John Doe" required
                  className={inputClass} style={inputStyle}
                  onFocus={focusStyle} onBlur={blurStyle} />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] font-mono text-[#4A6070] mb-1.5 tracking-wider">EMAIL</label>
                <input type="email" value={form.email} onChange={set('email')}
                  placeholder="operator@org.io" required
                  className={inputClass} style={inputStyle}
                  onFocus={focusStyle} onBlur={blurStyle} />
              </div>

              {/* Role */}
              <div>
                <label className="block text-[10px] font-mono text-[#4A6070] mb-1.5 tracking-wider">ROLE</label>
                <select value={form.role} onChange={set('role')} required
                  className={inputClass + ' cursor-pointer'} style={inputStyle}
                  onFocus={focusStyle} onBlur={blurStyle}>
                  <option value="" disabled>Select clearance level</option>
                  <option value="analyst">Intel Analyst</option>
                  <option value="trader">Markets Operator</option>
                  <option value="risk">Risk Manager</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-mono text-[#4A6070] mb-1.5 tracking-wider">ACCESS KEY</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                    placeholder="••••••••" required
                    className={inputClass + ' pr-10'} style={inputStyle}
                    onFocus={focusStyle} onBlur={blurStyle} />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3A5470] hover:text-[#00D9FF] transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrength password={form.password} />
              </div>

              {/* Confirm */}
              <div>
                <label className="block text-[10px] font-mono text-[#4A6070] mb-1.5 tracking-wider">CONFIRM KEY</label>
                <div className="relative">
                  <input type={showConfirm ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')}
                    placeholder="••••••••" required
                    className={inputClass + ' pr-10'} style={{ ...inputStyle, borderColor: form.confirm && form.confirm !== form.password ? '#FF174440' : '#1A2A3A' }}
                    onFocus={focusStyle} onBlur={blurStyle} />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3A5470] hover:text-[#00D9FF] transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.confirm && form.confirm !== form.password && (
                  <p className="text-[9px] font-mono text-[#FF1744] mt-1">Keys do not match</p>
                )}
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
                  background: loading ? '#00D9FF10' : 'linear-gradient(135deg, #00D9FF15, #0A6A8E25)',
                  border: `1px solid ${loading ? '#00D9FF20' : '#00D9FF50'}`,
                  color: loading ? '#00D9FF60' : '#00D9FF',
                }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-[#00D9FF30] border-t-[#00D9FF] rounded-full animate-spin" />
                    CREATING ACCOUNT...
                  </span>
                ) : 'REQUEST ACCESS →'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <span className="text-[10px] font-mono text-[#3A5470]">Already have access? </span>
              <button onClick={onGoToLogin}
                className="text-[10px] font-mono text-[#00D9FF] hover:text-white transition-colors">
                LOGIN
              </button>
            </div>
          </div>

          <div className="h-px w-full"
            style={{ background: 'linear-gradient(to right, transparent, #00D9FF20, transparent)' }} />
          <div className="px-8 py-2 flex justify-between">
            <span className="text-[8px] font-mono text-[#1A2A3A]">QUANTUM TERMINAL © 2025</span>
            <span className="text-[8px] font-mono text-[#1A3A2A]">AES-256 · TLS 1.3</span>
          </div>
        </div>
      </div>
    </div>
  );
}