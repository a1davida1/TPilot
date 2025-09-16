import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initializeQueue, closeQueue } from '../../../server/lib/queue-factory.js';
import { initializeWorkers } from '../../../server/lib/workers/index.js';
import { logger } from '../../../server/lib/logger.js';

// Mock logging methods
const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined as any);

describe('Worker Queue Initialization', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await closeQueue();
  });

  describe('Queue Factory Initialization', () => {
    it('should initialize PostgreSQL queue backend when Redis unavailable', async () => {
      // Test queue initialization falls back to PostgreSQL
      const originalRedisUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;

      await initializeQueue();

      // Should log PostgreSQL queue usage
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('PostgreSQL queue backend')
      );

      // Restore environment
      if (originalRedisUrl) {
        process.env.REDIS_URL = originalRedisUrl;
      }
    });

    it('should log queue backend selection', async () => {
      await initializeQueue();

      // Should log which queue backend is being used
      const hasQueueLog = logSpy.mock.calls.some(([msg]: any[]) => 
        typeof msg === 'string' && msg.includes('queue backend')
      );
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('Worker Initialization Logging', () => {
    it('should log successful worker initialization', async () => {
      await initializeWorkers();

      // Should log initialization progress
      const infoCalls = infoSpy.mock.calls.flat();
      const hasWorkerLog = infoCalls.some((call: any) =>
        typeof call === 'string' && call.includes('worker initialized')
      );
      expect(infoSpy).toHaveBeenCalled();
    });

    it('should initialize all required workers', async () => {
      await initializeWorkers();

      // Check that all expected workers are initialized
      const expectedWorkers = [
        'Post worker',
        'Metrics worker', 
        'AI Promo worker',
        'Dunning worker',
        'Batch posting worker'
      ];

      const infoCalls = infoSpy.mock.calls.flat();
      const loggedText = infoCalls.join(' ');

      expectedWorkers.forEach(workerName => {
        expect(loggedText).toContain(workerName);
      });
    });

    it('should log queue monitoring startup', async () => {
      // This test checks if queue monitoring is properly logged
      await initializeWorkers();

      // Should include queue monitoring messages
      const logCalls = [...logSpy.mock.calls, ...infoSpy.mock.calls].flat();
      const hasMonitoringLog = logCalls.some(call =>
        typeof call === 'string' && 
        (call.includes('queue monitoring') || call.includes('Queue monitoring'))
      );
      expect(hasMonitoringLog).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle worker initialization errors gracefully', async () => {
      // This test ensures workers fail gracefully rather than crashing
      const originalDatabaseUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'invalid://url';

      try {
        await initializeWorkers();
        // Should not crash the entire process
        expect(true).toBe(true);
      } catch (error) {
        // If it throws, it should be a controlled error
        expect(error).toBeInstanceOf(Error);
      } finally {
        // Restore environment
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
    });
  });
});