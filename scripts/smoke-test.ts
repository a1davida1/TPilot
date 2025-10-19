#!/usr/bin/env tsx
/**
 * Production Smoke Test Script
 *
 * Validates critical API endpoints and the single-page application bundle
 * before allowing traffic to a deployment.
 *
 * Usage:
 *   npm run smoke:test
 *   tsx scripts/smoke-test.ts
 *   npm run smoke:test -- --base-url=https://staging.example.com
 *   npm run smoke:spa -- --base-url=http://localhost:4173
 */

import { config } from 'dotenv';
import chalk from 'chalk';
import { JSDOM } from 'jsdom';
import * as process from 'node:process';

config();

type TestStatus = 'pass' | 'fail' | 'warn';

interface TestResult {
  readonly name: string;
  readonly status: TestStatus;
  readonly message?: string;
  readonly duration?: number;
}

interface CliOptions {
  readonly baseUrl?: string;
  readonly spaOnly: boolean;
  readonly apiOnly: boolean;
}

interface AssetCandidate {
  readonly url: string;
  readonly type: 'script' | 'style';
}

const results: TestResult[] = [];

function parseCliOptions(argv: readonly string[]): CliOptions {
  let baseUrl: string | undefined;
  let spaOnly = false;
  let apiOnly = false;

  for (const rawArg of argv) {
    const arg = rawArg.trim();
    if (arg.startsWith('--base-url=')) {
      baseUrl = arg.split('=', 2)[1];
    } else if (arg === '--base-url') {
      // Support space separated flag
      const index = argv.indexOf(rawArg);
      const value = argv[index + 1];
      if (value && !value.startsWith('--')) {
        baseUrl = value;
      }
    } else if (arg === '--spa-only') {
      spaOnly = true;
    } else if (arg === '--api-only') {
      apiOnly = true;
    }
  }

  return { baseUrl, spaOnly, apiOnly };
}

const cliOptions = parseCliOptions(process.argv.slice(2));
const baseUrl = cliOptions.baseUrl ?? process.env.APP_BASE_URL ?? 'http://localhost:3005';
const shouldRunApiSuite = cliOptions.apiOnly || !cliOptions.spaOnly;
const shouldRunSpaSuite = cliOptions.spaOnly || !cliOptions.apiOnly;

async function testEndpoint(
  name: string,
  url: string,
  options: RequestInit = {},
  validator?: (response: Response, payload: unknown) => boolean,
  critical = true,
): Promise<void> {
  const start = Date.now();
  try {
    const response = await fetch(`${baseUrl}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const duration = Date.now() - start;
    const payload = response.headers.get('content-type')?.includes('json')
      ? await response.json()
      : await response.text();

    const isValid = validator ? validator(response, payload) : response.ok;

    results.push({
      name,
      status: isValid ? 'pass' : critical ? 'fail' : 'warn',
      message: isValid ? `${response.status} OK` : `${response.status}: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`,
      duration,
    });
  } catch (error: unknown) {
    results.push({
      name,
      status: critical ? 'fail' : 'warn',
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start,
    });
  }
}

function collectSpaAssets(html: string): AssetCandidate[] {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const assets = new Map<string, AssetCandidate>();

  const scriptElements = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
  for (const element of scriptElements) {
    const src = element.getAttribute('src');
    if (!src) {
      continue;
    }
    if (src.startsWith('/src/')) {
      throw new Error(`SPA references development entry: ${src}`);
    }
    if (!src.includes('/assets/')) {
      continue;
    }
    const url = new URL(src, baseUrl).toString();
    assets.set(url, { url, type: 'script' });
  }

  const linkElements = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
  for (const element of linkElements) {
    const href = element.getAttribute('href');
    if (!href) {
      continue;
    }
    if (!href.includes('/assets/')) {
      continue;
    }
    const url = new URL(href, baseUrl).toString();
    assets.set(url, { url, type: 'style' });
  }

  if (assets.size === 0) {
    throw new Error('SPA entry does not reference compiled assets');
  }

  return Array.from(assets.values());
}

async function validateSpaAsset(asset: AssetCandidate): Promise<void> {
  const start = Date.now();
  try {
    const response = await fetch(asset.url, {
      headers: {
        'Cache-Control': 'no-cache',
        Accept: asset.type === 'script' ? 'text/javascript' : 'text/css',
      },
    });
    const duration = Date.now() - start;
    if (!response.ok) {
      results.push({
        name: `SPA asset: ${asset.url}`,
        status: 'fail',
        message: `${response.status} ${response.statusText}`,
        duration,
      });
      return;
    }

    const buffer = await response.arrayBuffer();
    const byteLength = buffer.byteLength;
    const contentType = response.headers.get('content-type') ?? '';
    const expected = asset.type === 'script' ? 'javascript' : 'css';

    if (byteLength === 0) {
      results.push({
        name: `SPA asset: ${asset.url}`,
        status: 'fail',
        message: 'Asset response is empty',
        duration,
      });
      return;
    }

    if (!contentType.toLowerCase().includes(expected)) {
      results.push({
        name: `SPA asset: ${asset.url}`,
        status: 'fail',
        message: `Unexpected content-type ${contentType || 'unknown'}`,
        duration,
      });
      return;
    }

    results.push({
      name: `SPA asset: ${asset.url}`,
      status: 'pass',
      message: `${response.status} OK (${byteLength} bytes)`,
      duration,
    });
  } catch (error: unknown) {
    results.push({
      name: `SPA asset: ${asset.url}`,
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start,
    });
  }
}

async function runSpaSuite(): Promise<void> {
  const start = Date.now();
  try {
    const response = await fetch(baseUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Cache-Control': 'no-cache',
      },
    });
    const duration = Date.now() - start;
    const html = await response.text();
    if (!response.ok) {
      results.push({
        name: 'SPA entrypoint',
        status: 'fail',
        message: `${response.status} ${response.statusText}`,
        duration,
      });
      return;
    }

    results.push({
      name: 'SPA entrypoint',
      status: 'pass',
      message: `${response.status} OK`,
      duration,
    });

    const hasRoot = html.includes('id="root"');
    results.push({
      name: 'SPA root mount',
      status: hasRoot ? 'pass' : 'fail',
      message: hasRoot ? 'Root mount detected' : 'Missing #root container',
    });

    try {
      const assets = collectSpaAssets(html);
      const scriptCount = assets.filter((asset) => asset.type === 'script').length;
      const styleCount = assets.filter((asset) => asset.type === 'style').length;
      results.push({
        name: 'SPA asset manifest',
        status: scriptCount > 0 && styleCount > 0 ? 'pass' : 'fail',
        message: `scripts=${scriptCount}, styles=${styleCount}`,
      });
      await Promise.all(assets.map(async (asset) => validateSpaAsset(asset)));
    } catch (assetError: unknown) {
      results.push({
        name: 'SPA assets',
        status: 'fail',
        message: assetError instanceof Error ? assetError.message : 'Failed to inspect SPA assets',
      });
    }
  } catch (error: unknown) {
    results.push({
      name: 'SPA entrypoint',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start,
    });
  }
}

async function runApiSuite(): Promise<void> {
  // 1. Health Checks
  await testEndpoint('Basic Health', '/health');
  await testEndpoint('Liveness Probe', '/health/live');
  await testEndpoint('Readiness Probe', '/health/ready');
  await testEndpoint('Detailed Health', '/health/detailed', {}, (
    response,
    payload,
  ) => response.ok && typeof payload === 'object' && payload !== null && (payload as { status?: string }).status !== 'unhealthy');
  await testEndpoint('Metrics Endpoint', '/metrics', {}, (response) => {
    const contentType = response.headers.get('content-type') ?? '';
    return response.ok && contentType.includes('text/plain');
  });

  // 2. Public Endpoints
  await testEndpoint('Landing Page Analytics', '/api/analytics/landing/summary');
  await testEndpoint('Pricing Info', '/api/pricing');

  // 3. Authentication Flow
  let authToken: string | null = null;
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@thottopilot.com';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminPassword) {
    try {
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });

      if (loginResponse.ok) {
        const loginData = (await loginResponse.json()) as { token?: string };
        if (loginData.token) {
          authToken = loginData.token;
          results.push({
            name: 'Admin Login',
            status: 'pass',
            message: 'Authentication successful',
          });
        } else {
          results.push({
            name: 'Admin Login',
            status: 'fail',
            message: 'Authentication response missing token',
          });
        }
      } else {
        results.push({
          name: 'Admin Login',
          status: 'fail',
          message: `${loginResponse.status}: Unable to authenticate admin`,
        });
      }
    } catch (error: unknown) {
      results.push({
        name: 'Admin Login',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown authentication error',
      });
    }
  } else {
    results.push({
      name: 'Admin Login',
      status: 'warn',
      message: 'Set ADMIN_PASSWORD to exercise authenticated flows',
    });
  }

  // 4. Authenticated Endpoints (if we have a token)
  if (authToken) {
    const authHeaders = { Authorization: `Bearer ${authToken}` };

    await testEndpoint('User Profile', '/api/user/profile', { headers: authHeaders });
    await testEndpoint('Scheduled Posts List', '/api/scheduled-posts', { headers: authHeaders });
    await testEndpoint('Feedback History', '/api/feedback/my-feedback', { headers: authHeaders });
    await testEndpoint(
      'Analytics (Pro)',
      '/api/analytics?tier=pro',
      { headers: authHeaders },
      (response) => response.ok || response.status === 403,
      false,
    );
  }

  // 5. Critical Integrations
  const integrationTests: ReadonlyArray<{ name: string; envVar: string; optional?: boolean }> = [
    { name: 'Database Connection', envVar: 'DATABASE_URL' },
    { name: 'Redis Connection', envVar: 'REDIS_URL', optional: true },
    { name: 'Sentry Integration', envVar: 'SENTRY_DSN', optional: true },
    { name: 'Imgur API', envVar: 'IMGUR_CLIENT_ID' },
    { name: 'Reddit OAuth', envVar: 'REDDIT_CLIENT_ID' },
    { name: 'OpenRouter AI', envVar: 'OPENROUTER_API_KEY' },
    { name: 'Stripe Payments', envVar: 'STRIPE_SECRET_KEY' },
  ];

  for (const test of integrationTests) {
    const configured = Boolean(process.env[test.envVar]);
    results.push({
      name: test.name,
      status: configured ? 'pass' : test.optional ? 'warn' : 'fail',
      message: configured ? 'Configured' : `Missing ${test.envVar}`,
    });
  }

  // 6. Worker & Cron Status
  await testEndpoint(
    'Cron Status',
    '/api/admin/cron-status',
    { headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined },
    (response) => response.ok || response.status === 401,
    false,
  );
}

async function runSmokeTests(): Promise<void> {
  console.log(chalk.cyan.bold('\n🔥 Running Smoke Tests...\n'));
  console.log(chalk.gray(`Target: ${baseUrl}\n`));

  if (shouldRunSpaSuite) {
    await runSpaSuite();
  }

  if (shouldRunApiSuite) {
    await runApiSuite();
  }

  // Print Results
  console.log(chalk.cyan.bold('\n📊 Test Results:\n'));

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const warned = results.filter((r) => r.status === 'warn').length;

  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
    const color = result.status === 'pass' ? chalk.green : result.status === 'warn' ? chalk.yellow : chalk.red;

    console.log(
      `${icon} ${color(result.name.padEnd(35))} ${
        typeof result.duration === 'number' ? chalk.gray(`(${result.duration}ms)`) : ''
      } ${result.message ?? ''}`,
    );
  }

  console.log(chalk.cyan.bold('\n📈 Summary:\n'));
  console.log(chalk.green(`  ✅ Passed: ${passed}`));
  console.log(chalk.yellow(`  ⚠️ Warnings: ${warned}`));
  console.log(chalk.red(`  ❌ Failed: ${failed}`));

  const criticalFailures = results.filter((r) => r.status === 'fail' && !r.name.includes('optional') && !r.name.includes('Analytics (Pro)'));

  if (criticalFailures.length > 0) {
    console.log(chalk.red.bold('\n🚨 CRITICAL FAILURES DETECTED!\n'));
    console.log(chalk.red('The following critical tests failed:'));
    for (const failure of criticalFailures) {
      console.log(chalk.red(`  - ${failure.name}: ${failure.message ?? ''}`));
    }
    process.exit(1);
  }

  if (failed > 0) {
    console.log(chalk.yellow.bold('\n⚠️ Non-critical failures detected.\n'));
    console.log(chalk.yellow('Review failed tests above before going to production.'));
    process.exit(0);
  }

  console.log(chalk.green.bold('\n✨ All tests passed! Ready for deployment.\n'));
  process.exit(0);
}

// Run tests
runSmokeTests().catch((error: unknown) => {
  console.error(chalk.red.bold('\n💥 Smoke test failed with error:'), error);
  process.exit(1);
});
