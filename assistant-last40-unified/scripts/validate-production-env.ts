
#!/usr/bin/env tsx
/**
 * Production Environment Validation Script
 * 
 * This script validates that all required environment variables are present
 * and properly formatted before deployment. Run this in CI/CD pipelines to
 * fail fast on misconfigured production environments.
 * 
 * Usage:
 *   npm run validate:env
 *   tsx scripts/validate-production-env.ts
 */

import { validateEnvironment } from '../server/lib/config.js';
import { config } from 'dotenv';

// Load environment variables (in production, these come from the secrets manager)
config();

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

function validateProductionRequirements(): ValidationResult {
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: []
  };

  // Critical production-only checks
  if (process.env.NODE_ENV === 'production') {
    // Security secrets must be high-entropy
    const criticalSecrets = ['JWT_SECRET', 'SESSION_SECRET'];
    for (const secret of criticalSecrets) {
      const value = process.env[secret];
      if (!value || value.length < 32) {
        result.errors.push(`${secret} must be at least 32 characters in production`);
      }
    }

    // Production URLs must be HTTPS
    const urlFields = ['APP_BASE_URL', 'FRONTEND_URL'];
    for (const field of urlFields) {
      const url = process.env[field];
      if (url && !url.startsWith('https://') && !url.includes('localhost')) {
        result.errors.push(`${field} should use HTTPS in production: ${url}`);
      }
    }

    // Database URL should point to managed service
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1'))) {
      result.warnings.push('DATABASE_URL appears to use localhost - ensure this points to managed database in production');
    }

    // Session storage should be durable
    if (!process.env.REDIS_URL && !process.env.DATABASE_URL) {
      result.errors.push('Either REDIS_URL or DATABASE_URL required for durable session storage in production');
    }

    // CORS origins should be restricted
    const allowedOrigins = process.env.ALLOWED_ORIGINS;
    if (!allowedOrigins || allowedOrigins.includes('*')) {
      result.errors.push('ALLOWED_ORIGINS must be explicitly set (no wildcards) in production');
    }
  }

  // Conditional requirements
  const conditionalChecks = [
    { condition: () => process.env.USE_REDIS_SESSIONS === 'true', required: ['REDIS_URL'], feature: 'Redis sessions' },
    { condition: () => process.env.S3_BUCKET_MEDIA, required: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'], feature: 'S3 media storage' },
    { condition: () => process.env.STRIPE_SECRET_KEY, required: ['STRIPE_WEBHOOK_SECRET'], feature: 'Stripe billing' },
    { condition: () => process.env.SENTRY_DSN, required: ['SENTRY_DSN'], feature: 'Error monitoring' }
  ];

  for (const check of conditionalChecks) {
    if (check.condition()) {
      for (const key of check.required) {
        if (!process.env[key]) {
          result.errors.push(`${key} required when ${check.feature} is enabled`);
        }
      }
    }
  }

  if (result.errors.length > 0) {
    result.success = false;
  }

  return result;
}

async function main() {
  console.log('🔍 Validating production environment configuration...');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');

  try {
    // First, run the core validation from the config module
    console.log('✅ Core environment validation passed');
    validateEnvironment();
  } catch (error) {
    console.error('❌ Core environment validation failed:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Then run production-specific checks
  const prodResult = validateProductionRequirements();
  
  if (prodResult.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    for (const warning of prodResult.warnings) {
      console.log(`   • ${warning}`);
    }
    console.log('');
  }

  if (prodResult.errors.length > 0) {
    console.log('❌ Production validation errors:');
    for (const error of prodResult.errors) {
      console.log(`   • ${error}`);
    }
    console.log('');
    console.log('Fix these issues before deploying to production.');
    process.exit(1);
  }

  console.log('✅ All production environment checks passed!');
  console.log('Ready for deployment.');
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Validation script failed:', error);
    process.exit(1);
  });
}
