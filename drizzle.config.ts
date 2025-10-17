import type { Config } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Parse the database URL to handle SSL properly for Render
const dbUrl = process.env.DATABASE_URL || '';

// Clean the URL and add proper SSL for Render
// Remove any existing query parameters first
const baseUrl = dbUrl.split('?')[0];

// Always use SSL for Render databases (they require it)
const urlForDrizzle = baseUrl.includes('render.com') 
  ? `${baseUrl}?sslmode=require`
  : baseUrl;

export default {
  dialect: 'postgresql',
  schema: './shared/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: urlForDrizzle,
  },
} satisfies Config;
