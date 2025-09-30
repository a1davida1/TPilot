import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../server/lib/queue-factory.ts', () => ({
  registerProcessor: vi.fn(),
}));

import { registerProcessor } from '../../../server/lib/queue-factory.ts';
import { PostWorker } from '../../../server/lib/workers/post-worker.ts';
import { QUEUE_NAMES } from '../../../server/lib/queue/index.ts';

const registerProcessorMock = vi.mocked(registerProcessor);

describe('PostWorker initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers the post queue processor with the expected queue name', async () => {
    const worker = new PostWorker();

    await worker.initialize();

    expect(registerProcessorMock).toHaveBeenCalledTimes(1);
    expect(registerProcessorMock).toHaveBeenCalledWith(
      QUEUE_NAMES.POST,
      expect.any(Function),
      expect.objectContaining({ concurrency: 2 })
    );
  });
});
