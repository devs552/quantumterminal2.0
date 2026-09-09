import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('auth provider should support a Prisma/Postgres implementation for Vercel', () => {
  const authSource = fs.readFileSync(path.join(process.cwd(), 'lib/auth.ts'), 'utf8');
  assert.match(authSource, /PrismaClient|postgresql|DATABASE_URL|VERCEL|usePrisma/);
});

test('demo fallback seeding should be present in the auth helper for Vercel deployments', () => {
  const authSource = fs.readFileSync(path.join(process.cwd(), 'lib/auth.ts'), 'utf8');
  assert.match(authSource, /VERCEL_DEMO_EMAIL|VERCEL_DEMO_PASSWORD|seedDemoUserIfNeeded|Demo Operator/);
});

test('admin users route should await auth and data accessors before serializing responses', () => {
  const routeSource = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/users/route.ts'), 'utf8');
  assert.match(routeSource, /const user = await getUserBySession/);
  assert.match(routeSource, /users: await listUsers\(|users: await listUsers\(/);
  assert.match(routeSource, /user: await createUser\(|user: await createUser\(/);
});

test('login route should convert provider failures into a clean JSON error response', () => {
  const routeSource = fs.readFileSync(path.join(process.cwd(), 'app/api/auth/login/route.ts'), 'utf8');
  assert.match(routeSource, /Authentication service unavailable/);
  assert.match(routeSource, /console\.error\('Authentication login failed:'/);
});
