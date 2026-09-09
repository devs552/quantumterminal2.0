import { NextResponse } from 'next/server';
import { authenticate, createSession } from '@/lib/auth';

export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (typeof email !== 'string' || typeof password !== 'string') return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  const user = await authenticate(email, password);
  if (!user) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  const token = await createSession(user.id);
  const response = NextResponse.json({ user });
  response.cookies.set('qt_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return response;
}