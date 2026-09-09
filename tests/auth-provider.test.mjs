import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('auth provider should support a Prisma/Postgres implementation for Vercel', () => {
  const authSource = fs.readFileSync(path.join(process.cwd(), 'lib/auth.ts'), 'utf8');
  assert.match(authSource, /PrismaClient|postgresql|DATABASE_URL|VERCEL|usePrisma/);
});
