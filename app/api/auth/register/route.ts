import { NextResponse } from 'next/server';
import { createUser, type UserRole } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json();
  const { name, email, password, role } = body;
  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || typeof role !== 'string') {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }
  if (!['analyst', 'trader', 'risk'].includes(role) || password.length < 8) {
    return NextResponse.json({ error: 'Choose a valid role and a password of at least 8 characters' }, { status: 400 });
  }
  try {
    const user = await createUser({ name, email, password, role: role as UserRole });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    return NextResponse.json({ error: 'Could not create account' }, { status: 500 });
  }
}