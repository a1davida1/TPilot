
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import { Pool as PostgresPool } from 'pg';
import ws from 'ws';
import * as schema from '../shared/schema.js';

neonConfig.webSocketConstructor = ws;

// Allow tests to use TEST_DATABASE_URL while still failing fast in production.
const preferTestConnection = process.env.NODE_ENV === 'test';
const preferredConnectionString = preferTestConnection
  ? process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
  : process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;

if (!preferredConnectionString) {
  throw new Error(
    'DATABASE_URL must be set. Did you forget to provision a database?',
  );
}

let poolInstance: NeonPool | PostgresPool;
let dbInstance: ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzlePostgres>;

// Use Neon pool for serverless environment
const connectionString = preferredConnectionString as string;
const neonPool = new NeonPool({ connectionString });
poolInstance = neonPool;
dbInstance = drizzleNeon({ client: neonPool, schema });

export const pool = poolInstance;
export const db = dbInstance;

export async function closeDatabaseConnections(): Promise<void> {
  await (poolInstance as NeonPool).end();
}
