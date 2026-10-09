import { Inject, Injectable, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { ENV } from '../config';
import type { Environment } from '../config';
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool: Pool;
  constructor(@Inject(ENV) env: Environment) {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 2000,
      query_timeout: 2000,
      statement_timeout: 2000,
    });
    // An idle connection failure must not crash the API or leak connection details.
    this.pool.on('error', () => undefined);
  }
  async isReady(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
