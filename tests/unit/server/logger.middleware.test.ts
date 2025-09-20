
import { describe, expect, it } from 'vitest';
import { MAX_LOG_PAYLOAD_LENGTH, prepareResponseLogPayload } from '../../../server/lib/request-logger';

const REDACTED_VALUE = '[REDACTED]';

describe('prepareResponseLogPayload', () => {
  it('redacts nested sensitive keys without mutating the original payload', () => {
    const payload = {
      user: {
        id: 'user-123',
        password: 'super-secret-value',
        profile: {
          accessToken: 'access-token',
          nested: {
            token: 'deep-token',
            apiKey: 'api-key-value',
            clientSecret: 'client-secret',
            metadata: [
              { secret: 'nested-secret', safe: 'visible' },
              { Authorization: 'Bearer sensitive', safe: true },
              { customToken: 'custom-token-value' }
            ]
          }
        }
      }
    } as const;

    const result = prepareResponseLogPayload(payload);

    expect(result).toBeDefined();
    expect(result).not.toContain('super-secret-value');
    expect(result).not.toContain('access-token');
    expect(result).not.toContain('deep-token');

    const parsed = JSON.parse(result ?? '{}');

    expect(parsed.user.password).toBe(REDACTED_VALUE);
    expect(parsed.user.profile.nested.token).toBe(REDACTED_VALUE);
    expect(parsed.user.profile.nested.apiKey).toBe(REDACTED_VALUE);
    expect(parsed.user.profile.nested.clientSecret).toBe(REDACTED_VALUE);
    expect(parsed.user.profile.nested.metadata[0].secret).toBe(REDACTED_VALUE);
    expect(parsed.user.profile.nested.metadata[1].Authorization).toBe(REDACTED_VALUE);
    expect(parsed.user.profile.nested.metadata[2].customToken).toBe(REDACTED_VALUE);
    expect(parsed.user.profile.nested.metadata[0].safe).toBe('visible');

    expect(payload.user.password).toBe('super-secret-value');
    expect(payload.user.profile.nested.token).toBe('deep-token');
    expect(payload.user.profile.nested.metadata[0].secret).toBe('nested-secret');
  });

  it('truncates oversized payloads for logging', () => {
    const payload = {
      message: 'a'.repeat(MAX_LOG_PAYLOAD_LENGTH * 2)
    };

    const result = prepareResponseLogPayload(payload);

    expect(result).toBeDefined();
    expect(result?.length).toBeLessThanOrEqual(MAX_LOG_PAYLOAD_LENGTH);
    expect(result?.endsWith('… (truncated)')).toBe(true);
  });
});
