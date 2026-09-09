import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { adminBypassEnabled, createUser, getUserBySession, listUsers, type AuthUser, type UserRole } from '@/lib/auth';

async function currentAdmin() {
  const cookieStore = await cookies();
  const user = await getUserBySession(cookieStore.get('qt_session')?.value);
  if (user?.role === 'admin') return user;
  if (adminBypassEnabled()) {
    return {
      id: 'dev-admin-bypass',
      name: 'Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@local.dev',
      role: 'admin' as UserRole,
    } satisfies AuthUser;
  }
  return null;
}

export async function GET() {
  try {
    if (!await currentAdmin()) return NextResponse.json({ error: 'Administrator access required' }, { status: 401 });
    return NextResponse.json({ users: await listUsers() });
  } catch (error) {
    console.error('Admin users GET failed:', error);
    return NextResponse.json({ error: 'Administrator user listing unavailable' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!await currentAdmin()) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
    const { name, email, password, role } = body;
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !['analyst', 'trader', 'risk', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Name, email, password, and a valid role are required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    try {
      return NextResponse.json({ user: await createUser({ name, email, password, role: role as UserRole }) }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
      return NextResponse.json({ error: 'Could not create account' }, { status: 500 });
    }
  } catch (error) {
    console.error('Admin users POST failed:', error);
    return NextResponse.json({ error: 'Administrator account creation unavailable' }, { status: 500 });
  }
}