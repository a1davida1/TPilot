-- Migration: Create session table for express-session with connect-pg-simple
-- This table is required for PostgreSQL session storage when using express-session

CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

-- Add primary key and index for performance
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

-- Create index on expire column for cleanup efficiency
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Grant necessary permissions (adjust for your database user)
-- GRANT ALL PRIVILEGES ON TABLE "session" TO your_db_user;