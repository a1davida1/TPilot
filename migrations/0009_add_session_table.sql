
-- Add session table for express-session with connect-pg-simple
-- This table is required for PostgreSQL session storage

CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar PRIMARY KEY NOT NULL,
  "sess" jsonb NOT NULL,
  "expire" timestamp NOT NULL
);

-- Create index on expire column for cleanup efficiency
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
