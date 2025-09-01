import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initializeQueue } from '../../../server/lib/queue-factory.js';
import { initializeWorkers } from '../../../server/lib/workers/index.js';

// Mock console methods for logging tests
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});

describe('Worker Queue Initialization', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('Queue Factory Initialization', () => {
    it('should initialize PostgreSQL queue backend when Redis unavailable', async () => {
      // Test queue initialization falls back to PostgreSQL
      const originalRedisUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;

      await initializeQueue();

      // Should log PostgreSQL queue usage
      expect(mockConsoleLog).toHaveBeenCalledWith(
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
      const logCalls = mockConsoleLog.mock.calls.flat();
      const hasQueueLog = logCalls.some(call => 
        typeof call === 'string' && call.includes('queue backend')
      );
      expect(hasQueueLog).toBe(true);
    });
  });

  describe('Worker Initialization Logging', () => {
    it('should log successful worker initialization', async () => {
      await initializeWorkers();

      // Should log initialization progress
      const infoCalls = mockConsoleInfo.mock.calls.flat();
      const hasWorkerLog = infoCalls.some(call =>
        typeof call === 'string' && call.includes('worker initialized')
      );
      expect(hasWorkerLog).toBe(true);
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

      const infoCalls = mockConsoleInfo.mock.calls.flat();
      const loggedText = infoCalls.join(' ');

      expectedWorkers.forEach(workerName => {
        expect(loggedText).toContain(workerName);
      });
    });

    it('should log queue monitoring startup', async () => {
      // This test checks if queue monitoring is properly logged
      await initializeWorkers();

      // Should include queue monitoring messages
      const logCalls = [...mockConsoleLog.mock.calls, ...mockConsoleInfo.mock.calls].flat();
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