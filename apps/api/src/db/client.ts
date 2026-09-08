import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema.js';

const DATABASE_URL = process.env.DATABASE_URL;

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Get it from neon.tech and add to apps/api/.env');
  }
  if (!_db) {
    _sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
      // Neon suspends an idle compute, so the first query after a quiet spell
      // pays for a cold start. The driver's 30s default connect timeout is
      // generous enough on paper, but the default idle_timeout keeps handing out
      // sockets the far end has already dropped — which is how a routine
      // ownership check turned into an ETIMEDOUT 500. Recycle connections well
      // before Neon does, and cap how long a single attempt can hang.
      idle_timeout: 20, // seconds — below Neon's suspend threshold
      max_lifetime: 60 * 30,
      connect_timeout: 15,
    });
    _db = drizzle(_sql, { schema });
  }
  return _db;
}

export function isDbAvailable(): boolean {
  return !!DATABASE_URL;
}

/**
 * Drain and close the connection pool.
 *
 * postgres-js keeps its sockets open, which holds the event loop: without this a
 * test run never exits, and SIGTERM used to `process.exit(0)` out from under
 * in-flight queries instead of letting them finish.
 */
export async function closeDb(): Promise<void> {
  if (!_sql) return;
  const sql = _sql;
  _sql = null;
  _db = null;
  await sql.end({ timeout: 5 });
}

export type Db = ReturnType<typeof getDb>;
