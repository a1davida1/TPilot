export interface E2EEnvironment {
  baseURL: string;
  adminEmail: string;
  adminPassword: string;
  billingPlan: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required for the E2E suite`);
  }
  return value;
}

export function getE2EEnvironment(): E2EEnvironment {
  return {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5000',
    adminEmail: requireEnv('E2E_ADMIN_EMAIL'),
    adminPassword: requireEnv('E2E_ADMIN_PASSWORD'),
    billingPlan: process.env.E2E_BILLING_PLAN ?? 'pro',
  };
}