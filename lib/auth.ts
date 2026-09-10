import { MongoClient, type Db, type Collection } from 'mongodb';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

export type UserRole = 'analyst' | 'trader' | 'risk' | 'admin';
export type AuthUser = { id: string; name: string | null; email: string; role: UserRole };

type UserDocument = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
};

type SessionDocument = {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
};

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quantumterminal';
const mongoDbName = process.env.MONGO_DB_NAME || process.env.MONGODB_DB_NAME || 'quantumterminal';

let client: MongoClient | null = null;
let db: Db | null = null;

async function getDb(): Promise<Db> {
  if (!db || !client) {
    client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db(mongoDbName);

    const users = db.collection<UserDocument>('users');
    const sessions = db.collection<SessionDocument>('sessions');

    await users.createIndex({ email: 1 }, { unique: true, name: 'unique_user_email' });
    await sessions.createIndex({ tokenHash: 1 }, { unique: true, name: 'unique_session_token_hash' });
    await sessions.createIndex({ expiresAt: 1 }, { name: 'session_expires_at', expireAfterSeconds: 0 });

    await ensureDefaultAdmin();
  }

  return db;
}

function getUsersCollection(): Promise<Collection<UserDocument>> {
  return getDb().then((database) => database.collection<UserDocument>('users'));
}

function getSessionsCollection(): Promise<Collection<SessionDocument>> {
  return getDb().then((database) => database.collection<SessionDocument>('sessions'));
}

async function ensureDefaultAdmin(): Promise<void> {
  const database = await getDb();
  const users = database.collection<UserDocument>('users');

  const exists = await users.findOne({ role: 'admin' });
  if (exists) return;

  const adminName = process.env.ADMIN_NAME || 'Administrator';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@quantumterminal.local').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  await users.insertOne({
    id: randomUUID(),
    name: adminName,
    email: adminEmail,
    role: 'admin',
    passwordHash: hashPassword(adminPassword),
    createdAt: new Date().toISOString(),
  });
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

export function adminBypassEnabled() {
  return process.env.ADMIN_BYPASS === 'true' || process.env.DEV_ADMIN_BYPASS === 'true';
}

export async function listUsers(): Promise<Array<AuthUser & { createdAt: string }>> {
  const users = await getUsersCollection();
  const rows = await users.find({}, { projection: { _id: 0, passwordHash: 0 } }).sort({ createdAt: -1 }).toArray();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.createdAt,
  }));
}

// --- used by /api/auth/login -----------------------------------------
export async function authenticate(email: string, password: string): Promise<AuthUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const users = await getUsersCollection();
  const row = await users.findOne({ email: normalizedEmail });

  if (!row || !verifyPassword(password, row.passwordHash)) return null;
  return publicUser(row);
}

// --- used by /api/auth/login (to set the cookie) ----------------------
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const sessions = await getSessionsCollection();
  await sessions.insertOne({
    tokenHash: tokenHash(token),
    userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  });
  return token;
}

// --- used by /api/auth/logout ------------------------------------------
export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return;
  const sessions = await getSessionsCollection();
  await sessions.deleteOne({ tokenHash: tokenHash(token) });
}

// --- used by /api/auth/me ------------------------------------------------
export async function getUserBySession(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const sessions = await getSessionsCollection();
  const session = await sessions.findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;

  const users = await getUsersCollection();
  const row = await users.findOne({ id: session.userId });
  if (!row) return null;

  return publicUser(row);
}

// --- used by /api/auth/signup --------------------------------------------
export async function createUser(input: { name: string; email: string; password: string; role: UserRole }): Promise<AuthUser> {
  const users = await getUsersCollection();
  const user = {
    id: randomUUID(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    passwordHash: hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };
  await users.insertOne(user);
  return publicUser(user);
}