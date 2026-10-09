import 'reflect-metadata';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { ENV, loadEnvironment } from '../src/config';
import type { Environment } from '../src/config';
import { DatabaseService } from '../src/database/database.module';
import { AuthService, SESSION_TTL_MS } from '../src/auth/auth.service';
import type { Session } from '@support/contracts';

const password = randomBytes(24).toString('hex');
const salt = randomBytes(16).toString('hex');
const env: Environment = {
  NODE_ENV: 'test',
  API_PORT: 3000,
  WEB_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://localhost:5432/test',
  DEV_ADMIN_EMAIL: 'admin@example.test',
  DEV_ADMIN_PASSWORD_HASH: `${salt}:${scryptSync(password, salt, 64).toString('hex')}`,
};
describe('Milestone 1 API integration', () => {
  let app: INestApplication;
  let ready: boolean;
  beforeEach(async () => {
    ready = true;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(env)
      .overrideProvider(DatabaseService)
      .useValue({ isReady: async () => ready })
      .compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApp(app, env);
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  async function login(): Promise<Session> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: env.DEV_ADMIN_EMAIL, password })
      .expect(200);
    return response.body as Session;
  }
  it('serves public liveness independently of the database with security headers', async () => {
    ready = false;
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    assert.equal(response.body.status, 'ok');
    assert.equal(response.body.service, 'support-api');
    assert.ok(Number.isFinite(Date.parse(response.body.timestamp as string)));
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
  });
  it('requires authentication on private endpoints', async () => {
    for (const path of ['/api/dashboard', '/api/auth/me', '/api/health/ready'])
      await request(app.getHttpServer()).get(path).expect(401);
  });
  it('authenticates an admin and serves a consistent synthetic dashboard', async () => {
    const session = await login();
    assert.equal(session.user.role, 'admin');
    assert.ok(new Date(session.expiresAt).getTime() > Date.now());
    const response = await request(app.getHttpServer())
      .get('/api/dashboard')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(200);
    assert.equal(response.body.synthetic, true);
    const volume = response.body.volume as { received: number; resolved: number }[];
    assert.equal(
      volume.reduce((sum, day) => sum + day.received, 0),
      response.body.metrics.conversations,
    );
    assert.equal(
      volume.reduce((sum, day) => sum + day.resolved, 0),
      response.body.metrics.resolved,
    );
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(200)
      .expect(session.user);
  });
  it('rejects invalid passwords without exposing credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: env.DEV_ADMIN_EMAIL, password: randomBytes(24).toString('hex') })
      .expect(401);
    assert.equal(response.body.message, 'Invalid email or password');
    assert.ok(!JSON.stringify(response.body).includes(env.DEV_ADMIN_PASSWORD_HASH));
  });
  it('validates input and rejects role injection, invalid email and oversized password', async () => {
    for (const body of [
      { email: 'invalid', password },
      { email: env.DEV_ADMIN_EMAIL, password, role: 'admin' },
      { email: env.DEV_ADMIN_EMAIL, password: 'x'.repeat(129) },
      { email: env.DEV_ADMIN_EMAIL },
    ]) {
      await request(app.getHttpServer()).post('/api/auth/login').send(body).expect(400);
    }
  });
  it('limits login attempts', async () => {
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer()).post('/api/auth/login').send({}).expect(400);
    await request(app.getHttpServer()).post('/api/auth/login').send({}).expect(429);
  });
  it('rejects oversized JSON requests', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'x'.repeat(20_000) })
      .expect(413);
  });
  it('rejects malformed JSON without reflecting its contents', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"password":"sensitive')
      .expect(400);
    assert.equal(response.body.message, 'Invalid JSON');
    assert.ok(!JSON.stringify(response.body).includes('sensitive'));
  });
  it('revokes sessions on logout', async () => {
    const session = await login();
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(204);
    await request(app.getHttpServer())
      .get('/api/dashboard')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(401);
  });
  it('rejects tampered tokens', async () => {
    await request(app.getHttpServer())
      .get('/api/dashboard')
      .auth(randomBytes(32).toString('base64url'), { type: 'bearer' })
      .expect(401);
  });
  it('expires sessions', async (context) => {
    const session = await login();
    const now = Date.now();
    context.mock.method(Date, 'now', () => now + SESSION_TTL_MS + 1);
    await request(app.getHttpServer())
      .get('/api/dashboard')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(401);
  });
  it('denies the admin dashboard to an agent role', async (context) => {
    const session = await login();
    context.mock.method(app.get(AuthService), 'authenticate', () => ({
      ...session.user,
      role: 'agent',
    }));
    await request(app.getHttpServer())
      .get('/api/dashboard')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(403);
  });
  it('reports database readiness and failure without leaking connection details', async () => {
    const session = await login();
    await request(app.getHttpServer())
      .get('/api/health/ready')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(200)
      .expect({ status: 'ok', database: 'connected' });
    ready = false;
    const response = await request(app.getHttpServer())
      .get('/api/health/ready')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(503);
    assert.equal(response.body.message, 'Database unavailable');
    assert.ok(!JSON.stringify(response.body).includes(env.DATABASE_URL));
  });
  it('only allows the configured browser origin', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', env.WEB_ORIGIN)
      .expect(200);
    assert.equal(allowed.headers['access-control-allow-origin'], env.WEB_ORIGIN);
    const other = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'https://untrusted.example')
      .expect(200);
    assert.notEqual(other.headers['access-control-allow-origin'], 'https://untrusted.example');
  });
});
describe('Environment validation', () => {
  it('rejects missing credentials and production mode', () => {
    assert.throws(() => loadEnvironment({}), /Invalid configuration/);
    assert.throws(
      () => loadEnvironment({ ...env, API_PORT: '3000', NODE_ENV: 'production' }),
      /NODE_ENV/,
    );
  });
  it('never echoes invalid secret values in validation errors', () => {
    const secret = randomBytes(20).toString('hex');
    try {
      loadEnvironment({ DEV_ADMIN_PASSWORD_HASH: secret });
      assert.fail('Should reject');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes(secret));
    }
  });
});
