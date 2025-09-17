import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import { Pool as PostgresPool } from 'pg';
import ws from 'ws';
import * as schema from '../shared/schema.js';

neonConfig.webSocketConstructor = ws;

// Allow tests to use TEST_DATABASE_URL while still failing fast in production.
const connectionString =
  process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool, schema });