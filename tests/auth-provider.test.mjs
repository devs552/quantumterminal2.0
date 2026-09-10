import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('auth provider should use a MongoDB connection helper and keep the login route contract intact', () => {
  const authSource = fs.readFileSync(path.join(process.cwd(), 'lib/auth.ts'), 'utf8');
  assert.match(authSource, /MongoClient|MONGODB_URI|mongodb/);
  assert.doesNotMatch(authSource, /better-sqlite3|auth\.sqlite|CREATE TABLE IF NOT EXISTS users/);
});

test('default admin seeding should be present in the auth helper', () => {
  const authSource = fs.readFileSync(path.join(process.cwd(), 'lib/auth.ts'), 'utf8');
  assert.match(authSource, /ensureDefaultAdmin|ADMIN_EMAIL|ADMIN_PASSWORD|ADMIN_NAME|role: 'admin'/);
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
