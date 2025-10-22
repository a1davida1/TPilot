import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FileTypeResult } from 'file-type';

const mockSubmitImage = vi.fn();
const mockGetSubreddit = vi.fn();
const mockGetMe = vi.fn();
const mockFileTypeFromBuffer = vi.fn();

vi.mock('file-type', () => ({
  fileTypeFromBuffer: mockFileTypeFromBuffer,
}));

vi.mock('../../../server/lib/safety-systems.js', () => ({
  SafetyManager: {
    recordPost: vi.fn().mockResolvedValue(undefined),
    recordPostForDuplicateDetection: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('snoowrap', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => ({
    getMe: mockGetMe,
    getSubreddit: mockGetSubreddit,
    requestOAuth: vi.fn(),
    refreshToken: vi.fn(),
  })),
}));

import { RedditManager } from '../../../server/lib/reddit.ts';
import { logger } from '../../../server/bootstrap/logger.ts';

describe('RedditManager.submitImagePost', () => {
  const userId = 42;
  const baseBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const submissionResponse = { id: 'abc123', permalink: '/r/test/comments/abc123/' };

  let canPostSpy: ReturnType<typeof vi.spyOn>;
  let submitPostSpy: ReturnType<typeof vi.spyOn>;
  let loggerErrorSpy: ReturnType<typeof vi.spyOn>;
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetMe.mockResolvedValue({});
    mockGetSubreddit.mockImplementation(() => ({
      submitImage: mockSubmitImage,
    }));
    mockSubmitImage.mockResolvedValue(submissionResponse);

    canPostSpy = vi.spyOn(RedditManager, 'canPostToSubreddit').mockResolvedValue({
      canPost: true,
      warnings: [],
      reasons: [],
      evaluatedAt: new Date(),
      postsInLast24h: 0,
      maxPostsPer24h: 10,
    } as any);

    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    submitPostSpy = vi.spyOn(RedditManager.prototype, 'submitPost').mockResolvedValue({
      success: true,
      postId: 'link123',
      url: 'https://www.reddit.com/r/test/comments/link123/',
    });
  });

  afterEach(() => {
    canPostSpy.mockRestore();
    submitPostSpy.mockRestore();
    loggerErrorSpy.mockRestore();
    loggerWarnSpy.mockRestore();
  });

  it('uploads buffers directly with detected file type metadata', async () => {
    mockFileTypeFromBuffer.mockResolvedValue({ ext: 'png', mime: 'image/png' } as FileTypeResult);

    const manager = new RedditManager('token', 'refresh', userId);

    const result = await manager.submitImagePost({
      subreddit: 'test',
      title: 'Sample title',
      imageBuffer: baseBuffer,
      nsfw: true,
      spoiler: false,
    });

    expect(result.success).toBe(true);
    expect(mockSubmitImage).toHaveBeenCalledTimes(1);

    const submitArgs = mockSubmitImage.mock.calls[0][0];
    expect(submitArgs.title).toBe('Sample title');
    expect(submitArgs.nsfw).toBe(true);
    expect(submitArgs.spoiler).toBe(false);

    const imageFile = submitArgs.imageFile as { file: Buffer; name: string };
    expect(Buffer.isBuffer(imageFile.file)).toBe(true);
    expect(imageFile.name).toBe('upload.png');

    expect(mockFileTypeFromBuffer).toHaveBeenCalledWith(baseBuffer);
    expect(submitPostSpy).not.toHaveBeenCalled();
  });

  it('falls back to URL-derived extension when detection is unavailable', async () => {
    mockFileTypeFromBuffer.mockResolvedValue(undefined);

    const manager = new RedditManager('token', 'refresh', userId);

    const result = await manager.submitImagePost({
      subreddit: 'test',
      title: 'Another title',
      imageBuffer: baseBuffer,
      imageUrl: 'https://i.imgur.com/example.WEBP?token=abc',
      nsfw: false,
    });

    expect(result.success).toBe(true);
    expect(mockSubmitImage).toHaveBeenCalledTimes(1);

    const submitArgs = mockSubmitImage.mock.calls[0][0];
    const imageFile = submitArgs.imageFile as { file: Buffer; name: string };
    expect(imageFile.name).toBe('upload.webp');
    expect(submitPostSpy).not.toHaveBeenCalled();
  });
});
