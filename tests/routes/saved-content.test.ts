import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentGeneration, SavedContent } from '../../shared/schema.js';
import { createSaveContentHandler } from '../../server/routes.ts';

const createMockStorage = () => ({
  createSavedContent: vi.fn(),
  getUserContentGenerations: vi.fn(),
  getSocialMediaPost: vi.fn(),
});

describe('POST /api/saved-content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    const storage = createMockStorage();
    const app = express();
    app.use(express.json());
    app.post('/api/saved-content', createSaveContentHandler({ storage }));

    const response = await request(app)
      .post('/api/saved-content')
      .send({ title: 'Title', content: 'Body' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Authentication required' });
    expect(storage.createSavedContent).not.toHaveBeenCalled();
  });

  it('returns 404 when generation does not belong to the caller', async () => {
    const storage = createMockStorage();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as express.Request & { user?: { id: number } }).user = { id: 11 };
      next();
    });
    storage.getUserContentGenerations.mockResolvedValueOnce([]);

    app.post('/api/saved-content', createSaveContentHandler({ storage }));

    const response = await request(app)
      .post('/api/saved-content')
      .send({ title: 'Missing generation', content: 'Body', generationId: 99 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Content generation not found' });
    expect(storage.getUserContentGenerations).toHaveBeenCalledWith(11);
    expect(storage.createSavedContent).not.toHaveBeenCalled();
  });

  it('persists saved content when validation succeeds', async () => {
    const storage = createMockStorage();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as express.Request & { user?: { id: number } }).user = { id: 5 };
      next();
    });

    const generation = {
      id: 77,
      userId: 5,
      platform: 'reddit',
    } as unknown as ContentGeneration;
    storage.getUserContentGenerations.mockResolvedValueOnce([generation]);
    storage.getSocialMediaPost.mockResolvedValue(undefined);

    const nowIso = new Date().toISOString();
    const savedRecord = {
      id: 301,
      userId: 5,
      title: 'Valid title',
      content: 'Valid body',
      platform: 'reddit',
      contentGenerationId: 77,
      socialMediaPostId: null,
      metadata: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    } as unknown as SavedContent;

    storage.createSavedContent.mockResolvedValueOnce(savedRecord);

    app.post('/api/saved-content', createSaveContentHandler({ storage }));

    const response = await request(app)
      .post('/api/saved-content')
      .send({
        title: '  Valid title  ',
        content: 'Valid body',
        generationId: 77,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: savedRecord.id,
      userId: savedRecord.userId,
      title: savedRecord.title,
      content: savedRecord.content,
      platform: savedRecord.platform,
      contentGenerationId: savedRecord.contentGenerationId,
    });
    expect(storage.createSavedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 5,
        title: 'Valid title',
        content: 'Valid body',
        platform: 'reddit',
        contentGenerationId: 77,
        socialMediaPostId: undefined,
      })
    );
    expect(storage.getSocialMediaPost).not.toHaveBeenCalled();
  });
});