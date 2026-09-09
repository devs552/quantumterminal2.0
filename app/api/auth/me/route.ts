import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getUserBySession } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const user = await getUserBySession(cookieStore.get('qt_session')?.value);
  return NextResponse.json({ user }, { status: user ? 200 : 401 });
}