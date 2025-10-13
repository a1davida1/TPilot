import type { Config } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Parse the database URL to handle SSL properly for Render
const dbUrl = process.env.DATABASE_URL || '';

// Remove any existing query parameters
const baseUrl = dbUrl.split('?')[0];

// Add correct SSL parameters for Render
const urlForDrizzle = `${baseUrl}?sslmode=no-verify`;

export default {
  dialect: 'postgresql',
  schema: './shared/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: urlForDrizzle,
  },
} satisfies Config;
