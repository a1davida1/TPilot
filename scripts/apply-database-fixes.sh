#!/bin/bash

echo "🔧 Database Schema Fix Script"
echo "============================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL is not set!"
    echo ""
    echo "Please set your database connection string:"
    echo "  export DATABASE_URL=\"postgresql://user:password@localhost:5432/dbname\""
    echo ""
    echo "Or for a quick local test:"
    echo "  export DATABASE_URL=\"postgresql://postgres:postgres@localhost:5432/tpilot\""
    exit 1
fi

echo "📊 Database URL found!"
echo ""

# Method 1: Using Drizzle migration (recommended)
echo "Method 1: Using Drizzle Migration (Recommended)"
echo "-----------------------------------------------"
echo "Run: npm run db:migrate"
echo ""

# Method 2: Using TypeScript script
echo "Method 2: Using TypeScript Script"
echo "---------------------------------"
echo "Run: npx tsx scripts/run-database-fixes.ts"
echo ""

# Method 3: Direct SQL (if you have psql)
echo "Method 3: Direct SQL with psql"
echo "-------------------------------"
echo "Run: psql \$DATABASE_URL < scripts/fix-database-columns.sql"
echo ""

# Ask user which method to use
read -p "Which method would you like to use? (1/2/3): " choice

case $choice in
    1)
        echo "Running Drizzle migration..."
        npm run db:migrate
        ;;
    2)
        echo "Running TypeScript script..."
        npx tsx scripts/run-database-fixes.ts
        ;;
    3)
        echo "Running SQL directly..."
        psql $DATABASE_URL < scripts/fix-database-columns.sql
        ;;
    *)
        echo "Invalid choice. Please run the script again and choose 1, 2, or 3."
        exit 1
        ;;
esac

echo ""
echo "✅ Database fix complete!"
