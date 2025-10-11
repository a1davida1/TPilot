#!/bin/bash
# Local PostgreSQL Setup Script for ThottoPilot

echo "🚀 Setting up local PostgreSQL for ThottoPilot..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "📦 Installing PostgreSQL..."
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib
    
    # Start PostgreSQL service
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
else
    echo "✅ PostgreSQL already installed"
fi

# Create database
echo "🗄️ Creating thottopilot database..."
sudo -u postgres createdb thottopilot 2>/dev/null || echo "Database might already exist"

# Create .env file
echo "📝 Creating .env file..."
cat > .env << EOF
DATABASE_URL=postgresql://postgres@localhost/thottopilot
NODE_ENV=development
VITE_BACKEND_URL=http://localhost:3005
JWT_SECRET=local_dev_secret_change_in_production
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
REDIS_URL=redis://localhost:6379
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
GROK_API_KEY=your_grok_key
OPENROUTER_API_KEY=your_openrouter_key
STRIPE_PRICE_ID_PRO=price_placeholder_pro
STRIPE_PRICE_ID_PREMIUM=price_placeholder_premium
EOF

echo "✅ .env file created with local DATABASE_URL"

# Run migrations
echo "🔄 Running database migrations..."
npm run db:migrate

echo "
✨ Setup Complete! 

Your local database is ready at:
postgresql://postgres@localhost/thottopilot

Next steps:
1. Update any API keys in .env as needed
2. Run 'npm run dev' to start the application
3. The database will be empty but with all tables created

To access the database directly:
sudo -u postgres psql thottopilot

To view your database in a GUI:
npm run db:studio
"
