import { it } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
it('connects to development PostgreSQL and round-trips Burmese UTF-8', async () => {
  assert.ok(process.env.DATABASE_URL, 'Run npm run setup first');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 2000,
  });
  try {
    const sample = 'မင်္ဂလာပါ';
    const result = await pool.query<{ sample: string }>('SELECT $1::text AS sample', [sample]);
    assert.equal(result.rows[0]?.sample, sample);
  } finally {
    await pool.end();
  }
});
