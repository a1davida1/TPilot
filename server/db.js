import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '../shared/schema.js';

neonConfig.webSocketConstructor = ws;

const preferTestConnection = process.env.NODE_ENV === 'test';
const preferredConnectionString = preferTestConnection
  ? process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
  : process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;

if (!preferredConnectionString) {
  throw new Error(
    'DATABASE_URL must be set. Did you forget to provision a database?',
  );
}

const connectionString = preferredConnectionString;
const neonPool = new NeonPool({ connectionString });
const poolInstance = neonPool;
const dbInstance = drizzleNeon({ client: neonPool, schema });

export const pool = poolInstance;
export const db = dbInstance;

export async function closeDatabaseConnections() {
  await poolInstance.end();
}