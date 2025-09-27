import fs from 'fs';
import process from 'node:process';

// List the secrets you need for testing
const secrets = [
  'DATABASE_URL',
  'APP_BASE_URL',
  'JWT_SECRET',
  'SESSION_SECRET',
  'REDDIT_CLIENT_ID',
  'REDDIT_CLIENT_SECRET',
  'REDDIT_REFRESH_TOKEN',
  'REDDIT_USERNAME',
  'REDDIT_PASSWORD',
  'REDDIT_USER_AGENT',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_API_VERSION',
  'COINBASE_API_KEY',
  'PAXUM_MERCHANT_EMAIL',
  'FROM_EMAIL'
];

// Build .env content
let envContent = '';
for (const key of secrets) {
  const value = process.env[key];
  if (value) {
    envContent += `${key}=${value}\n`;
  } else {
    console.warn(`Warning: ${key} is not set in Replit Secrets`);
  }
}

// Write to .env file
fs.writeFileSync('.env', envContent);
console.error(
  '.env file created with',
  envContent.split('\n').filter(line => line).length,
  'variables'
);
