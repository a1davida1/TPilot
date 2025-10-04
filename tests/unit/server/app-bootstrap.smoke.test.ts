
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockStartQueue = vi.fn();

vi.mock('../../../server/bootstrap/queue.ts', () => ({
  startQueue: mockStartQueue,
}));

vi.mock('../../../server/db.ts', () => ({
  db: {},
  pool: {},
  closeDatabaseConnections: vi.fn(),
}));

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../../../server/bootstrap/logger.ts', async () => {
  const actual = await vi.importActual<typeof import('../../../server/bootstrap/logger.ts')>(
    '../../../server/bootstrap/logger.ts'
  );

  return {
    ...actual,
    logger: mockLogger,
  };
});

describe('createExpressApp bootstrap fallback', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockStartQueue.mockReset();
    mockStartQueue.mockResolvedValue(undefined);
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  });

  afterEach(() => {
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  });

  it('resolves when queue prerequisites are absent', { timeout: 30000 }, async () => {
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    delete process.env.JWT_SECRET;
    delete process.env.SESSION_SECRET;
    process.env.NODE_ENV = 'development';

    const { createExpressApp } = await import('../../../server/index.ts');

    await expect(
      createExpressApp({ startQueue: false, configureStaticAssets: false, enableVite: false })
    ).resolves.toBeDefined();

    expect(mockStartQueue).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Queue startup disabled for current execution context.'
    );
  });
});
