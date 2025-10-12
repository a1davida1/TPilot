#!/bin/bash

# Fix Replit Database Migration Issues
# Run this on Replit console

echo "=== Replit Database Migration Fix ==="
echo ""
echo "This script will help fix migration issues on Replit"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set. Please set it in your .env file"
    exit 1
fi

echo "1. Checking current database status..."
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;" 2>/dev/null | head -20

echo ""
echo "2. Checking migrations table..."
psql $DATABASE_URL -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;" 2>/dev/null || echo "No migrations table found"

echo ""
echo "Choose an option:"
echo "  1) Safe sync (db:push) - Syncs schema without recreating tables"
echo "  2) Force push - Drops constraints and pushes schema"
echo "  3) Reset migrations table only (keeps data)"
echo "  4) Full reset (WARNING: DELETES ALL DATA)"
echo ""
read -p "Enter option (1-4): " option

case $option in
    1)
        echo "Running safe sync with db:push..."
        npm run db:push
        ;;
    2)
        echo "Force pushing schema..."
        npx drizzle-kit push --force
        ;;
    3)
        echo "Resetting migrations table..."
        psql $DATABASE_URL <<EOF
-- Create migrations table if not exists
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at timestamp DEFAULT now()
);

-- Clear existing migrations
TRUNCATE drizzle.__drizzle_migrations;

-- Mark current schema as migrated
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES (md5('initial-schema'), now());
EOF
        echo "Migrations table reset. Try running migrations again."
        ;;
    4)
        echo "⚠️  WARNING: This will DELETE ALL DATA!"
        read -p "Type 'DELETE EVERYTHING' to confirm: " confirm
        if [ "$confirm" = "DELETE EVERYTHING" ]; then
            echo "Dropping all tables..."
            psql $DATABASE_URL <<EOF
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
EOF
            echo "Database reset. Running fresh migrations..."
            npm run db:migrate
        else
            echo "Cancelled."
        fi
        ;;
    *)
        echo "Invalid option"
        ;;
esac

echo ""
echo "Done! Check the output above for any errors."
