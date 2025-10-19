import { describe, expect, it } from 'vitest';
import { buildRemoteObjectKey } from '../../server/bootstrap/log-forwarder.js';

describe('buildRemoteObjectKey', () => {
  it('builds a hierarchical key with prefix, category, level, and date', () => {
    const rotatedAt = new Date(Date.UTC(2024, 9, 21, 15, 30, 0));
    const key = buildRemoteObjectKey({
      prefix: 'archive/logs',
      category: 'Combined',
      level: 'INFO',
      rotatedAt,
      fileName: 'combined-2024-10-21.log.gz',
    });

    expect(key).toBe('archive/logs/combined/info/2024/10/21/combined-2024-10-21.log.gz');
  });

  it('adds the dry-run segment when requested', () => {
    const rotatedAt = new Date(Date.UTC(2024, 0, 2, 0, 0, 0));
    const key = buildRemoteObjectKey({
      prefix: 'logs',
      category: 'diagnostic',
      level: 'info',
      rotatedAt,
      fileName: 'dry-run.json',
      dryRun: true,
    });

    expect(key).toBe('logs/_dry-run/2024/01/02/dry-run.json');
  });

  it('sanitises unexpected characters in category and level', () => {
    const rotatedAt = new Date(Date.UTC(2024, 4, 10, 0, 0, 0));
    const key = buildRemoteObjectKey({
      category: 'Security Alerts',
      level: 'Warn+',
      rotatedAt,
      fileName: 'security-2024-05-10.log',
    });

    expect(key).toBe('security-alerts/warn-/2024/05/10/security-2024-05-10.log');
  });
});
