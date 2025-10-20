import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { createOAuthState, consumeOAuthState, InvalidOAuthStateError } from '../../../server/lib/oauth-state-manager.js';

vi.mock('../../../server/services/state-store.js', () => ({
  stateStore: {
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn()
  }
}));

const { stateStore } = await import('../../../server/services/state-store.js');

function createMockRequest(overrides?: Partial<Request>): Request {
  return {
    ip: '127.0.0.1',
    get: (header: string) => header === 'user-agent' ? 'test-agent' : undefined,
    user: undefined,
    query: {},
    ...overrides
  } as Request;
}

describe('oauth-state-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and consumes OAuth state with metadata', async () => {
    const req = createMockRequest({ user: { id: 42 } });

    // Mock successful store operations
    const stateData = {
      provider: 'google',
      intent: 'link',
      userId: 42,
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      timestamp: Date.now(),
      meta: { returnTo: '/dashboard' }
    };

    (stateStore.set as any).mockResolvedValue(undefined);
    (stateStore.get as any).mockResolvedValueOnce(JSON.stringify(stateData));
    (stateStore.get as any).mockResolvedValueOnce(null); // Second call returns null
    (stateStore.delete as any).mockResolvedValue(undefined);

    const { state, data } = await createOAuthState('google', req, {
      meta: { returnTo: '/dashboard' },
      ttlSeconds: 120,
    });

    expect(state).toMatch(/^tpilot\.google\./);
    expect(data.intent).toBe('link');
    expect(data.userId).toBe(42);

    const consumed = await consumeOAuthState('google', state);
    expect(consumed.data.userId).toBe(42);
    expect(consumed.data.meta?.returnTo).toBe('/dashboard');

    await expect(consumeOAuthState('google', state)).rejects.toThrow(InvalidOAuthStateError);
  });

  it('rejects mismatched providers', async () => {
    const req = createMockRequest();
    
    (stateStore.set as any).mockResolvedValue(undefined);

    const { state } = await createOAuthState('facebook', req);

    await expect(consumeOAuthState('google', state)).rejects.toThrow(InvalidOAuthStateError);
  });

  it('supports explicit intent overrides and strips unsafe metadata', async () => {
    const req = createMockRequest();

    const stateData = {
      provider: 'facebook',
      intent: 'signup',
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      timestamp: Date.now(),
      meta: { redirect: '/welcome' } // nested object should be stripped
    };

    (stateStore.set as any).mockResolvedValue(undefined);
    (stateStore.get as any).mockResolvedValueOnce(JSON.stringify(stateData));
    (stateStore.delete as any).mockResolvedValue(undefined);

    const { state } = await createOAuthState('facebook', req, {
      intent: 'signup',
      meta: {
        redirect: '/welcome',
        nested: { value: 'nope' },
      },
    });

    const consumed = await consumeOAuthState('facebook', state);
    expect(consumed.data.intent).toBe('signup');
    expect(consumed.data.meta?.redirect).toBe('/welcome');
    expect(consumed.data.meta?.nested).toBeUndefined();
  });

  it('defaults intent to login when no user is present', async () => {
    const req = createMockRequest();

    (stateStore.set as any).mockResolvedValue(undefined);

    const { data } = await createOAuthState('facebook', req);

    expect(data.intent).toBe('login');
    expect(data.userId).toBeUndefined();
  });
});
