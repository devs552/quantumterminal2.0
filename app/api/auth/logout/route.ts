import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth';

export async function POST() {
  const cookieStore = await cookies();
  await deleteSession(cookieStore.get('qt_session')?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('qt_session');
  return response;
}