import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createUser, getUserBySession, listUsers, type UserRole } from '@/lib/auth';

async function currentAdmin() {
  const cookieStore = await cookies();
  const user = getUserBySession(cookieStore.get('qt_session')?.value);
  return user?.role === 'admin' ? user : null;
}

export async function GET() {
  if (!await currentAdmin()) return NextResponse.json({ error: 'Administrator access required' }, { status: 401 });
  return NextResponse.json({ users: listUsers() });
}

export async function POST(request: Request) {
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
    return NextResponse.json({ user: createUser({ name, email, password, role: role as UserRole }) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    return NextResponse.json({ error: 'Could not create account' }, { status: 500 });
  }
}