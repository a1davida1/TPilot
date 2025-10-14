import { config } from 'dotenv';
import pg from 'pg';
import { readFileSync } from 'fs';

// Load environment variables
config();

const { Pool } = pg;

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const migrationSQL = readFileSync('./migrations/0014_recurring_commissions.sql', 'utf-8');

    console.log('Running migration...');
    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
