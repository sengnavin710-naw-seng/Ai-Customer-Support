import 'reflect-metadata';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { Pool } from 'pg';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Article, Category, User } from '@support/contracts';
import { AppModule } from '../src/app.module';
import { ENV, loadEnvironment } from '../src/config';
import { configureApp } from '../src/bootstrap';
import { AuthService } from '../src/auth/auth.service';
import { runMigrations } from '../src/database/migrations';
import { KnowledgeService } from '../src/knowledge-base/knowledge.service';

const schema = `kb_test_${randomUUID().replaceAll('-', '')}`;
const password = randomBytes(24).toString('hex');
const salt = randomBytes(16).toString('hex');
const env = loadEnvironment({
  ...process.env,
  NODE_ENV: 'test',
  DEV_ADMIN_PASSWORD_HASH: `${salt}:${scryptSync(password, salt, 64).toString('hex')}`,
});
const connection = new URL(env.DATABASE_URL);
connection.searchParams.set('options', `-c search_path=${schema}`);
const testEnv = { ...env, DATABASE_URL: connection.toString() };
const owner = new Pool({ connectionString: env.DATABASE_URL });
const pool = new Pool({ connectionString: testEnv.DATABASE_URL });
let app: INestApplication;
let admin: string;
let agent: string;
let other: string;
let applied: string[];
const url = '/api/knowledge-base';
const agentUser: User = {
  id: 'synthetic-agent',
  email: 'agent@example.test',
  name: 'Test agent',
  role: 'agent',
};

before(async () => {
  // Only this generated schema is created/dropped; public and volume data stay intact.
  await owner.query(`CREATE SCHEMA "${schema}"`);
  applied = await runMigrations(pool);
});
after(async () => {
  await pool.end();
  if (!/^kb_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe test schema');
  await owner.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await owner.end();
});
beforeEach(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue(testEnv)
    .compile();
  app = module.createNestApplication({ bodyParser: false });
  configureApp(app, testEnv);
  await app.init();
  const auth = app.get(AuthService);
  admin = (await auth.login(env.DEV_ADMIN_EMAIL, password)).accessToken;
  agent = (await auth.login(env.DEV_ADMIN_EMAIL, password)).accessToken;
  other = (await auth.login(env.DEV_ADMIN_EMAIL, password)).accessToken;
  const authenticate = auth.authenticate.bind(auth);
  // Real sessions + explicit test principals; production bootstrap still has one admin.
  auth.authenticate = (token) => {
    const user = authenticate(token);
    return token === agent
      ? agentUser
      : token === other
        ? { ...agentUser, id: 'other-agent' }
        : user;
  };
});
afterEach(async () => {
  await app.close();
});
function call(method: 'get' | 'post' | 'patch' | 'delete', path: string, token = admin) {
  return request(app.getHttpServer())[method](`${url}${path}`).auth(token, { type: 'bearer' });
}
async function category(name = `Synthetic ${randomUUID()}`): Promise<Category> {
  return (
    await call('post', '/categories')
      .send({ name, description: 'Synthetic test category' })
      .expect(201)
  ).body as Category;
}
async function article(
  token = admin,
  title = `Synthetic article ${randomUUID()}`,
): Promise<Article> {
  const cat = await category();
  return (
    await call('post', '/articles', token)
      .send({
        categoryId: cat.id,
        title,
        body: 'မင်္ဂလာပါ။ Synthetic support knowledge only.',
        language: 'my',
      })
      .expect(201)
  ).body as Article;
}
async function submit(a: Article, token = admin): Promise<Article> {
  return (
    await call('post', `/articles/${a.id}/submit`, token)
      .send({ expectedRevision: a.revision })
      .expect(200)
  ).body as Article;
}
async function approve(a: Article): Promise<Article> {
  return (
    await call('post', `/articles/${a.id}/review`)
      .send({ expectedRevision: a.revision, decision: 'approve' })
      .expect(200)
  ).body as Article;
}
async function eligible(id: string): Promise<number> {
  return (await pool.query('SELECT id FROM kb_approved_articles WHERE id=$1', [id])).rowCount!;
}

describe('PostgreSQL migrations', () => {
  it('applies to an isolated schema and is repeatable under concurrent runners', async () => {
    assert.deepEqual(applied, ['001_knowledge_base.sql']);
    assert.deepEqual(await Promise.all([runMigrations(pool), runMigrations(pool)]), [[], []]);
    assert.equal((await pool.query('SELECT * FROM schema_migrations')).rowCount, 1);
  });
  it('rejects changed checksums without modifying knowledge data', async () => {
    const checksum = (
      await pool.query<{ checksum: string }>('SELECT checksum FROM schema_migrations')
    ).rows[0]!.checksum;
    await pool.query("UPDATE schema_migrations SET checksum='tampered'");
    try {
      await assert.rejects(runMigrations(pool), /checksum mismatch/);
    } finally {
      await pool.query('UPDATE schema_migrations SET checksum=$1', [checksum]);
    }
  });
});
describe('Knowledge Base REST + real PostgreSQL', () => {
  it('protects every resource without a bearer session', async () => {
    for (const path of ['/categories', '/articles', '/audit-records'])
      await request(app.getHttpServer()).get(`${url}${path}`).expect(401);
  });
  it('creates, reads, updates and deletes a category and retains its audit trail', async () => {
    const cat = await category();
    await call('get', `/categories/${cat.id}`).expect(200);
    const changed = (
      await call('patch', `/categories/${cat.id}`)
        .send({
          name: `Renamed ${randomUUID()}`,
          description: 'Updated synthetic description',
          expectedRevision: cat.revision,
        })
        .expect(200)
    ).body as Category;
    assert.equal(changed.revision, 2);
    await call('delete', `/categories/${cat.id}`).send({ expectedRevision: 2 }).expect(204);
    await call('get', `/categories/${cat.id}`).expect(404);
    const audit = await call('get', `/audit-records?entityId=${cat.id}`).expect(200);
    assert.deepEqual(
      new Set(audit.body.items.map((item: { action: string }) => item.action)),
      new Set(['category.created', 'category.updated', 'category.deleted']),
    );
  });
  it('rejects duplicate categories, stale category edits and deleting referenced categories', async () => {
    const a = await article();
    await call('post', '/categories').send({ name: a.categoryName.toUpperCase() }).expect(409);
    await call('patch', `/categories/${a.categoryId}`)
      .send({ name: 'Conflict', expectedRevision: 99 })
      .expect(409);
    await call('delete', `/categories/${a.categoryId}`).send({ expectedRevision: 1 }).expect(409);
  });
  it('validates UUIDs, blank content, nulls, unknown fields, query bounds, language and category references', async () => {
    const cat = await category();
    const body = { categoryId: cat.id, title: 'Synthetic', body: 'Synthetic body', language: 'my' };
    for (const extra of [
      { title: '  ' },
      { body: null },
      { status: 'approved' },
      { language: 'xx' },
      { body: 'a\u0000b' },
      { title: 'a'.repeat(201) },
    ])
      await call('post', '/articles')
        .send({ ...body, ...extra })
        .expect(400);
    await call('post', '/articles')
      .send({ ...body, categoryId: randomUUID() })
      .expect(409);
    await call('get', '/articles/not-a-uuid').expect(400);
    for (const query of [
      'page=0',
      'limit=51',
      'page=1.2',
      'status=published',
      'q=' + 'a'.repeat(101),
      'categoryId=null',
      'extra=1',
    ])
      await call('get', `/articles?${query}`).expect(400);
  });
  it('round-trips Burmese, paginates, filters and treats search wildcard/injection text literally', async () => {
    const prefix = `မင်္ဂလာပါ ${randomUUID()}`;
    const cat = await category(prefix);
    for (let i = 0; i < 3; i++)
      await call('post', '/articles')
        .send({
          categoryId: cat.id,
          title: `${prefix} ${i}`,
          body: 'မြန်မာဘာသာ စမ်းသပ်ချက်',
          language: 'my',
        })
        .expect(201);
    const first = await call('get', `/articles?q=${encodeURIComponent(prefix)}&limit=2`).expect(
      200,
    );
    const next = await call(
      'get',
      `/articles?q=${encodeURIComponent(prefix)}&limit=2&page=2`,
    ).expect(200);
    assert.equal(first.body.total, 3);
    assert.equal(first.body.items.length, 2);
    assert.equal(next.body.items.length, 1);
    assert.notEqual(first.body.items[0].id, next.body.items[0].id);
    assert.equal(next.body.items[0].body, 'မြန်မာဘာသာ စမ်းသပ်ချက်');
    const filtered = await call('get', `/articles?categoryId=${cat.id}&status=approved`).expect(
      200,
    );
    assert.equal(filtered.body.total, 0);
    const beyond = await call('get', `/articles?q=${encodeURIComponent(prefix)}&page=100`).expect(
      200,
    );
    assert.equal(beyond.body.total, 3);
    assert.deepEqual(beyond.body.items, []);
    for (const q of ['%', "' OR 1=1 --"]) {
      const result = await call('get', `/articles?q=${encodeURIComponent(q)}`).expect(200);
      assert.equal(result.body.total, 0);
    }
    const cats = await call('get', `/categories?q=${encodeURIComponent(prefix)}&limit=1`).expect(
      200,
    );
    assert.equal(cats.body.total, 1);
  });
  it('keeps drafts/pending/rejected versions unavailable and explicitly approves pending versions', async () => {
    const a = await article(agent);
    assert.equal(await eligible(a.id), 0);
    await call('post', `/articles/${a.id}/review`)
      .send({ expectedRevision: a.revision, decision: 'approve' })
      .expect(409);
    const pending = await submit(a, agent);
    assert.equal(pending.status, 'pending');
    assert.equal(await eligible(a.id), 0);
    await call('patch', `/articles/${a.id}`, agent)
      .send({ ...pick(pending), expectedRevision: pending.revision })
      .expect(409);
    await call('post', `/articles/${a.id}/review`)
      .send({ expectedRevision: pending.revision, decision: 'reject', note: '' })
      .expect(400);
    const rejected = (
      await call('post', `/articles/${a.id}/review`)
        .send({
          expectedRevision: pending.revision,
          decision: 'reject',
          note: 'Please clarify this synthetic answer.',
        })
        .expect(200)
    ).body as Article;
    assert.equal(rejected.status, 'rejected');
    assert.equal(await eligible(a.id), 0);
    await call('post', `/articles/${a.id}/submit`, agent)
      .send({ expectedRevision: rejected.revision })
      .expect(409);
    const revised = (
      await call('patch', `/articles/${a.id}`, agent)
        .send({ ...pick(a), body: 'ပြင်ဆင်ထားသော အဖြေ', expectedRevision: rejected.revision })
        .expect(200)
    ).body as Article;
    const approved = await approve(await submit(revised, agent));
    assert.equal(approved.version, 2);
    assert.equal(await eligible(a.id), 1);
  });
  it('creates immutable versions and removes previous approval on editing', async () => {
    const approved = await approve(await submit(await article()));
    assert.equal(await eligible(approved.id), 1);
    const revised = (
      await call('patch', `/articles/${approved.id}`)
        .send({
          ...pick(approved),
          body: 'New unapproved content',
          expectedRevision: approved.revision,
        })
        .expect(200)
    ).body as Article;
    assert.equal(revised.version, 2);
    assert.equal(revised.status, 'draft');
    assert.equal(await eligible(approved.id), 0);
    const versions = await call('get', `/articles/${approved.id}/versions?limit=1&page=2`).expect(
      200,
    );
    assert.equal(versions.body.total, 2);
    assert.equal(versions.body.items[0].body, approved.body);
    assert.equal(versions.body.items[0].status, 'approved');
    await assert.rejects(
      pool.query(
        "UPDATE kb_article_versions SET body='overwrite' WHERE article_id=$1 AND version=1",
        [approved.id],
      ),
      /immutable/,
    );
  });
  it('archives without deleting history and excludes archived approvals', async () => {
    const a = await approve(await submit(await article()));
    await call('delete', `/articles/${a.id}`).send({ expectedRevision: a.revision }).expect(204);
    assert.equal(await eligible(a.id), 0);
    const archived = await call('get', `/articles/${a.id}`).expect(200);
    assert.ok(archived.body.archivedAt);
    assert.equal(
      (await call('get', `/articles?q=${encodeURIComponent(a.title)}`).expect(200)).body.total,
      0,
    );
    assert.equal(
      (await call('get', `/articles?q=${encodeURIComponent(a.title)}&archive=archived`).expect(200))
        .body.total,
      1,
    );
    await call('patch', `/articles/${a.id}`)
      .send({ ...pick(a), expectedRevision: archived.body.revision })
      .expect(409);
    assert.equal((await call('get', `/articles/${a.id}/versions`).expect(200)).body.total, 1);
  });
  it('enforces roles and ownership in controllers and services', async () => {
    const a = await article(agent);
    await call('post', '/categories', agent).send({ name: 'Forbidden' }).expect(403);
    await call('get', '/audit-records', agent).expect(403);
    await call('delete', `/articles/${a.id}`, agent)
      .send({ expectedRevision: a.revision })
      .expect(403);
    await call('patch', `/articles/${a.id}`, other)
      .send({ ...pick(a), expectedRevision: a.revision })
      .expect(403);
    await call('post', `/articles/${a.id}/submit`, other)
      .send({ expectedRevision: a.revision })
      .expect(403);
    const pending = await submit(a, agent);
    await call('post', `/articles/${a.id}/review`, agent)
      .send({ expectedRevision: pending.revision, decision: 'approve' })
      .expect(403);
    assert.throws(
      () =>
        app.get(KnowledgeService).createCategory(agentUser, { name: 'Forbidden', description: '' }),
      /Insufficient permissions/,
    );
  });
  it('serializes concurrent edits and rejects stale approvals', async () => {
    const a = await article();
    const responses = await Promise.all(
      ['one', 'two'].map((body) =>
        call('patch', `/articles/${a.id}`).send({ ...pick(a), body, expectedRevision: a.revision }),
      ),
    );
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    const updated = responses.find((response) => response.status === 200)!.body as Article;
    const pending = await submit(updated);
    const approved = await approve(pending);
    await call('post', `/articles/${a.id}/review`)
      .send({ expectedRevision: pending.revision, decision: 'reject', note: 'stale' })
      .expect(409);
    assert.equal(
      (await call('get', `/articles/${a.id}`).expect(200)).body.revision,
      approved.revision,
    );
  });
  it('persists records across application restart and independent database connections', async () => {
    const a = await article();
    await app.close();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(testEnv)
      .compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApp(app, testEnv);
    await app.init();
    admin = (await app.get(AuthService).login(env.DEV_ADMIN_EMAIL, password)).accessToken;
    assert.equal((await call('get', `/articles/${a.id}`).expect(200)).body.body, a.body);
    assert.equal((await pool.query('SELECT id FROM kb_articles WHERE id=$1', [a.id])).rowCount, 1);
  });
  it('writes secret-free append-only audit records atomically', async () => {
    const a = await approve(await submit(await article()));
    const audit = await call('get', `/audit-records?entityId=${a.id}`).expect(200);
    assert.equal(audit.body.total, 3);
    for (const item of audit.body.items) {
      assert.equal(item.actorRole, 'admin');
      assert.ok(item.actorId);
      assert.ok(!('body' in item));
    }
    assert.ok(!JSON.stringify(audit.body).includes(password));
    await assert.rejects(
      pool.query('DELETE FROM kb_audit_records WHERE entity_id=$1', [a.id]),
      /append-only/,
    );
    await assert.rejects(
      pool.query("UPDATE kb_audit_records SET actor_id='tampered' WHERE entity_id=$1", [a.id]),
      /append-only/,
    );
    // Force the audit insert to fail in this isolated schema to prove rollback.
    await pool.query(
      "CREATE FUNCTION reject_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END; $$; CREATE TRIGGER reject_test_audit BEFORE INSERT ON kb_audit_records FOR EACH ROW EXECUTE FUNCTION reject_test_audit()",
    );
    const name = `Rollback ${randomUUID()}`;
    try {
      await call('post', '/categories').send({ name }).expect(500);
      assert.equal(
        (await pool.query('SELECT id FROM kb_categories WHERE name=$1', [name])).rowCount,
        0,
      );
    } finally {
      await pool.query(
        'DROP TRIGGER reject_test_audit ON kb_audit_records; DROP FUNCTION reject_test_audit()',
      );
    }
  });
});
function pick(a: Article) {
  return { categoryId: a.categoryId, title: a.title, body: a.body, language: a.language };
}
