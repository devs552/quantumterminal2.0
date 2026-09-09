import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export type UserRole = 'analyst' | 'trader' | 'risk' | 'admin';
export type AuthUser = { id: string; name: string | null; email: string; role: UserRole };

const databaseUrl = String(process.env.DATABASE_URL || '');
const isRemotePostgres = Boolean(databaseUrl && databaseUrl.startsWith('postgres') && !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1'));
const prisma = isRemotePostgres ? new PrismaClient() : null;

let database: any = null;
if (!isRemotePostgres) {
  const Database = require('better-sqlite3');
  const dataDirectory = path.join(process.cwd(), 'data');
  mkdirSync(dataDirectory, { recursive: true });
  database = new Database(path.join(dataDirectory, 'auth.sqlite'));
  database.pragma('journal_mode = WAL');
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      role TEXT NOT NULL CHECK (role IN ('analyst', 'trader', 'risk', 'admin')),
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
  `);
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function publicUser(row: { id: string; name: string | null; email: string; role: UserRole }): AuthUser {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export async function countUsers() {
  if (prisma) return await prisma.user.count();
  return (database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
}

export async function createUser(input: { name: string; email: string; password: string; role: UserRole }) {
  if (prisma) {
    const created = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        role: input.role,
        password: hashPassword(input.password),
      },
    });
    return { id: created.id, name: created.name, email: created.email, role: created.role as UserRole };
  }

  const user = { id: randomUUID(), name: input.name.trim(), email: input.email.trim().toLowerCase(), role: input.role };
  database.prepare('INSERT INTO users (id, name, email, role, password_hash) VALUES (?, ?, ?, ?, ?)')
    .run(user.id, user.name, user.email, user.role, hashPassword(input.password));
  return publicUser(user);
}

export async function authenticate(email: string, password: string) {
  if (prisma) {
    const row = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!row || !row.password || !verifyPassword(password, row.password)) return null;
    return { id: row.id, name: row.name, email: row.email, role: row.role as UserRole };
  }

  const row = database.prepare('SELECT id, name, email, role, password_hash FROM users WHERE email = ? COLLATE NOCASE')
    .get(email.trim()) as ({ id: string; name: string | null; email: string; role: UserRole; password_hash: string } | undefined);
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return publicUser(row);
}

export async function createSession(userId: string) {
  if (prisma) {
    const token = randomBytes(32).toString('base64url');
    const tokenSessionHash = tokenHash(token);
    await prisma.session.create({
      data: {
        tokenHash: tokenSessionHash,
        userId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });
    return token;
  }

  const token = randomBytes(32).toString('base64url');
  database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash(token), userId, Date.now() + 1000 * 60 * 60 * 24 * 7);
  return token;
}

export async function getUserBySession(token: string | undefined) {
  if (!token) return null;
  if (prisma) {
    const session = await prisma.session.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    return { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role as UserRole };
  }

  const row = database.prepare(`
    SELECT u.id, u.name, u.email, u.role
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash(token), Date.now()) as ({ id: string; name: string | null; email: string; role: UserRole } | undefined);
  return row ? publicUser(row) : null;
}

export async function deleteSession(token: string | undefined) {
  if (!token) return;
  if (prisma) {
    await prisma.session.delete({ where: { tokenHash: tokenHash(token) } }).catch(() => undefined);
    return;
  }
  database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
}

export function adminBypassEnabled() {
  return process.env.ADMIN_BYPASS === 'true' || process.env.DEV_ADMIN_BYPASS === 'true';
}

export async function listUsers() {
  if (prisma) {
    const rows = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ({ id: row.id, name: row.name, email: row.email, role: row.role as UserRole, createdAt: row.createdAt.toISOString() }));
  }
  return (database.prepare('SELECT id, name, email, role, created_at as createdAt FROM users ORDER BY created_at DESC').all() as Array<AuthUser & { createdAt: string }>);
}

if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && !prisma) {
  if (process.env.ADMIN_PASSWORD.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  if (countUsers() === 0) {
    createUser({
      name: process.env.ADMIN_NAME || 'Administrator',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin',
    });
  }
}