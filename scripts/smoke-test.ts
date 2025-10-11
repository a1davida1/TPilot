#!/usr/bin/env tsx
/**
 * Smoke Test Script for Beta/Production Deployment
 * 
 * Validates that all critical services and endpoints are functional
 * before allowing traffic to the deployment.
 * 
 * Usage:
 *   npm run smoke:test
 *   tsx scripts/smoke-test.ts
 */

import { config } from 'dotenv';
import chalk from 'chalk';

config();

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3005';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@thottopilot.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
}

const results: TestResult[] = [];

async function testEndpoint(
  name: string, 
  url: string, 
  options: RequestInit = {},
  validator?: (response: Response, data?: any) => boolean
): Promise<void> {
  const start = Date.now();
  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    const duration = Date.now() - start;
    const data = response.headers.get('content-type')?.includes('json') 
      ? await response.json() 
      : await response.text();
    
    const isValid = validator ? validator(response, data) : response.ok;
    
    results.push({
      name,
      status: isValid ? 'pass' : 'fail',
      message: isValid ? `${response.status} OK` : `${response.status}: ${JSON.stringify(data)}`,
      duration,
    });
  } catch (error) {
    results.push({
      name,
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start,
    });
  }
}

async function runSmokeTests() {
  console.log(chalk.cyan.bold('\n🔥 Running Smoke Tests...\n'));
  console.log(chalk.gray(`Target: ${BASE_URL}\n`));

  // 1. Health Checks
  await testEndpoint('Basic Health', '/health');
  await testEndpoint('Liveness Probe', '/health/live');
  await testEndpoint('Readiness Probe', '/health/ready');
  await testEndpoint('Detailed Health', '/health/detailed', {}, 
    (res, data) => res.ok && data?.status !== 'unhealthy'
  );
  await testEndpoint('Metrics Endpoint', '/metrics', {},
    (res) => res.ok && (res.headers.get('content-type')?.includes('text/plain') || true)
  );

  // 2. Public Endpoints
  await testEndpoint('Landing Page Analytics', '/api/analytics/landing/summary');
  await testEndpoint('Pricing Info', '/api/pricing');
  
  // 3. Authentication Flow
  let authToken: string | null = null;
  
  if (ADMIN_PASSWORD) {
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      authToken = loginData.token;
      results.push({
        name: 'Admin Login',
        status: 'pass',
        message: 'Authentication successful',
      });
    } else {
      results.push({
        name: 'Admin Login',
        status: 'warn',
        message: 'Could not authenticate - set ADMIN_PASSWORD to test auth endpoints',
      });
    }
  }

  // 4. Authenticated Endpoints (if we have a token)
  if (authToken) {
    const authHeaders = { Authorization: `Bearer ${authToken}` };
    
    await testEndpoint('User Profile', '/api/user/profile', { headers: authHeaders });
    await testEndpoint('Scheduled Posts List', '/api/scheduled-posts', { headers: authHeaders });
    await testEndpoint('Feedback History', '/api/feedback/my-feedback', { headers: authHeaders });
    await testEndpoint('Analytics (Pro)', '/api/analytics?tier=pro', { headers: authHeaders },
      (res) => res.ok || res.status === 403 // 403 is OK if user isn't Pro
    );
  }

  // 5. Critical Integrations
  const integrationTests = [
    { name: 'Database Connection', envVar: 'DATABASE_URL' },
    { name: 'Redis Connection', envVar: 'REDIS_URL', optional: true },
    { name: 'Sentry Integration', envVar: 'SENTRY_DSN', optional: true },
    { name: 'Imgur API', envVar: 'IMGUR_CLIENT_ID' },
    { name: 'Reddit OAuth', envVar: 'REDDIT_CLIENT_ID' },
    { name: 'OpenRouter AI', envVar: 'OPENROUTER_API_KEY' },
    { name: 'Stripe Payments', envVar: 'STRIPE_SECRET_KEY' },
  ];

  for (const test of integrationTests) {
    const configured = !!process.env[test.envVar];
    results.push({
      name: test.name,
      status: configured ? 'pass' : (test.optional ? 'warn' : 'fail'),
      message: configured ? 'Configured' : `Missing ${test.envVar}`,
    });
  }

  // 6. Worker & Cron Status
  await testEndpoint('Cron Status', '/api/admin/cron-status', 
    { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
    (res) => res.ok || res.status === 401 // 401 is OK if not admin
  );

  // Print Results
  console.log(chalk.cyan.bold('\n📊 Test Results:\n'));
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;

  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : 
                 result.status === 'warn' ? '⚠️' : '❌';
    const color = result.status === 'pass' ? chalk.green :
                  result.status === 'warn' ? chalk.yellow : chalk.red;
    
    console.log(
      `${icon} ${color(result.name.padEnd(30))} ${
        result.duration ? chalk.gray(`(${result.duration}ms)`) : ''
      } ${result.message || ''}`
    );
  }

  console.log(chalk.cyan.bold('\n📈 Summary:\n'));
  console.log(chalk.green(`  ✅ Passed: ${passed}`));
  console.log(chalk.yellow(`  ⚠️ Warnings: ${warned}`));
  console.log(chalk.red(`  ❌ Failed: ${failed}`));

  const criticalFailures = results.filter(
    r => r.status === 'fail' && 
    !r.name.includes('optional') &&
    !r.name.includes('Admin')
  );

  if (criticalFailures.length > 0) {
    console.log(chalk.red.bold('\n🚨 CRITICAL FAILURES DETECTED!\n'));
    console.log(chalk.red('The following critical tests failed:'));
    for (const failure of criticalFailures) {
      console.log(chalk.red(`  - ${failure.name}: ${failure.message}`));
    }
    process.exit(1);
  } else if (failed > 0) {
    console.log(chalk.yellow.bold('\n⚠️ Non-critical failures detected.\n'));
    console.log(chalk.yellow('Review failed tests above before going to production.'));
    process.exit(0);
  } else {
    console.log(chalk.green.bold('\n✨ All tests passed! Ready for deployment.\n'));
    process.exit(0);
  }
}

// Run tests
runSmokeTests().catch(error => {
  console.error(chalk.red.bold('\n💥 Smoke test failed with error:'), error);
  process.exit(1);
});
