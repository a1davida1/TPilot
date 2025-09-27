import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Turnstile verification hardening', () => {
  const originalEnv = { ...process.env };
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);

    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  });

  it('bypasses verification when the secret is missing in development', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.TURNSTILE_SECRET_KEY;

    const { verifyTurnstileToken } = await import('../../server/lib/turnstile.js');
    const result = await verifyTurnstileToken('test-token');

    expect(result).toBe(true);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '⚠️ Turnstile not configured - bypassing verification in development'
    );
  });

  it('rejects verification when the secret is missing outside development', async () => {
    process.env.NODE_ENV = 'test';

    const { verifyTurnstileToken } = await import('../../server/lib/turnstile.js');

    process.env.NODE_ENV = 'production';
    delete process.env.TURNSTILE_SECRET_KEY;

    const result = await verifyTurnstileToken('test-token');

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Turnstile secret key is not configured. Rejecting verification request.'
    );
  });

  it('fails environment validation for missing Turnstile secrets in production', async () => {
    process.env.NODE_ENV = 'test';
    const { envSchema } = await import('../../server/lib/config.js');

    process.env.NODE_ENV = 'production';
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.TURNSTILE_SITE_KEY;

    const validation = envSchema.safeParse(process.env);

    expect(validation.success).toBe(false);
    if (validation.success) {
      throw new Error('Expected validation to fail when Turnstile secrets are missing in production');
    }

    const errorPaths = validation.error.issues.map(issue => issue.path.join('.'));
    expect(errorPaths).toContain('TURNSTILE_SECRET_KEY');
    expect(errorPaths).toContain('TURNSTILE_SITE_KEY');
  });
});