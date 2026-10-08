import type { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/teacher_assistant';

// ponytail: lazy-init, skip pool allocation when DB_TYPE=sqlite (the default)
let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    // Dynamically require pg so SQLite mode does not require pg to be installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool: PgPool } = require('pg');
    const pool = new PgPool({
      connectionString: DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }) as Pool;
    pool.on('error', (err: Error) => {
      console.error('[db] Unexpected error on idle client', err);
    });
    _pool = pool;
  }
  return _pool;
}

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

export async function pgTransaction<T>(callback: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
