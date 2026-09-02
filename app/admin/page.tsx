'use client';

import { FormEvent, useState } from 'react';

type User = { id: string; name: string | null; email: string; role: string; createdAt?: string };

export default function AdminPage() {
  const [adminLogin, setAdminLogin] = useState({ email: '', password: '' });
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [users, setUsers] = useState<User[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    const response = await fetch('/api/admin/users');
    if (response.ok) { setUsers((await response.json()).users); setAuthenticated(true); }
  };

  const login = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(adminLogin) });
    const body = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setError(body.error || 'Sign-in failed'); return; }
    if (body.user?.role !== 'admin') {
      await fetch('/api/auth/logout', { method: 'POST' });
      setError('Administrator account required');
      return;
    }
    await loadUsers();
  };

  const create = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage(''); setLoading(true);
    const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const body = await response.json(); setLoading(false);
    if (!response.ok) { setError(body.error || 'Could not create account'); return; }
    setForm({ name: '', email: '', password: '', role: 'analyst' }); setMessage('Account created'); await loadUsers();
  };

  const inputClass = 'w-full border border-cyan-950 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400';
  return <main className="min-h-screen bg-[#020810] px-6 py-12 font-mono text-slate-200">
    <section className="mx-auto max-w-3xl">
      <p className="text-xs tracking-[0.3em] text-cyan-400">QUANTUM INTELLIGENCE HUB</p>
      <h1 className="mt-3 text-3xl font-bold text-white">Administrator Console</h1>
      <p className="mt-2 text-sm text-slate-500">Direct access at /admin. Manage operator accounts securely.</p>
      {!authenticated ? <form onSubmit={login} className="mt-10 max-w-md space-y-4 border border-cyan-950 p-6">
        <h2 className="text-lg text-white">Administrator sign in</h2>
        <input className={inputClass} type="email" placeholder="Admin email" value={adminLogin.email} onChange={e => setAdminLogin({ ...adminLogin, email: e.target.value })} required />
        <input className={inputClass} type="password" placeholder="Password" value={adminLogin.password} onChange={e => setAdminLogin({ ...adminLogin, password: e.target.value })} required />
        <button className="w-full bg-cyan-400 px-3 py-2 font-bold text-slate-950" disabled={loading}>SIGN IN</button>
      </form> : <div className="mt-10 grid gap-8 md:grid-cols-[1fr_1.2fr]">
        <form onSubmit={create} className="space-y-4 border border-cyan-950 p-6">
          <h2 className="text-lg text-white">Create account</h2>
          <input className={inputClass} placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <input className={inputClass} type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          <input className={inputClass} type="password" placeholder="Password (8+ characters)" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} />
          <select className={inputClass} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="analyst">Analyst</option><option value="trader">Trader</option><option value="risk">Risk manager</option><option value="admin">Administrator</option></select>
          <button className="w-full bg-cyan-400 px-3 py-2 font-bold text-slate-950" disabled={loading}>CREATE ACCOUNT</button>
          {message && <p className="text-sm text-emerald-400">{message}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
        <div className="border border-cyan-950 p-6"><h2 className="text-lg text-white">Operator accounts</h2><div className="mt-4 space-y-3">{users.map(user => <div key={user.id} className="border-b border-slate-800 pb-3 text-sm"><div className="text-white">{user.name || 'Unnamed operator'}</div><div className="text-slate-500">{user.email} · {user.role}</div></div>)}</div></div>
      </div>}
      {error && !authenticated && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </section>
  </main>;
}