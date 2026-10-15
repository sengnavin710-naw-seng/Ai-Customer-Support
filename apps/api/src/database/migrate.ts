import { Pool } from 'pg';
import { loadEnvironment } from '../config';
import { runMigrations } from './migrations';
async function main(): Promise<void> {
  const env = loadEnvironment(process.env);
  const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 3000 });
  try {
    const applied = await runMigrations(pool);
    console.log(
      applied.length ? `Applied: ${applied.join(', ')}` : 'Database migrations are up to date.',
    );
  } finally {
    await pool.end();
  }
}
void main().catch(() => {
  console.error(
    'Migration failed. Check database availability and migration checksums. No partial migration was committed.',
  );
  process.exitCode = 1;
});
