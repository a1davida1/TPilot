import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InsertSavedContent, SavedContent } from '../../../shared/schema.js';

const insertMock = vi.fn();
const selectMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('../../../server/db.js', () => ({
  db: {
    insert: insertMock,
    select: selectMock,
    delete: deleteMock,
  },
}));

const safeLogMock = vi.fn();

vi.mock('../../../server/lib/logger-utils.js', async () => {
  const actual = await vi.importActual<typeof import('../../../server/lib/logger-utils.js')>(
    '../../../server/lib/logger-utils.js'
  );

  return {
    ...actual,
    safeLog: safeLogMock,
  };
});

type DatabaseStorageCtor = typeof import('../../../server/storage.ts').DatabaseStorage;
let DatabaseStorageClass: DatabaseStorageCtor | null = null;

describe('DatabaseStorage saved content operations', () => {
  beforeEach(async () => {
    insertMock.mockReset();
    selectMock.mockReset();
    deleteMock.mockReset();
    safeLogMock.mockReset();
    if (!DatabaseStorageClass) {
      ({ DatabaseStorage: DatabaseStorageClass } = await import('../../../server/storage.ts'));
    }
  });

  const createStorage = () => {
    if (!DatabaseStorageClass) {
      throw new Error('DatabaseStorageClass not initialized');
    }

    return new DatabaseStorageClass();
  };

  it('creates saved content records', async () => {
    const storage = createStorage();
    const payload: InsertSavedContent = {
      userId: 42,
      title: 'Test title',
      content: 'Saved body',
      platform: 'reddit',
    };

    const savedRecord: SavedContent = {
      id: 7,
      userId: payload.userId,
      title: payload.title,
      content: payload.content,
      platform: payload.platform,
      contentGenerationId: null,
      socialMediaPostId: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const returningMock = vi.fn().mockResolvedValue([savedRecord]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    insertMock.mockReturnValue({ values: valuesMock });

    const result = await storage.createSavedContent(payload);

    expect(result).toBe(savedRecord);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledWith(payload);
    expect(returningMock).toHaveBeenCalledTimes(1);
    expect(safeLogMock).not.toHaveBeenCalled();
  });

  it('logs and rethrows when createSavedContent fails', async () => {
    const storage = createStorage();
    const payload: InsertSavedContent = {
      userId: 99,
      title: 'Oops',
      content: 'Broken',
    };

    const dbError = new Error('insert failed');
    const returningMock = vi.fn().mockRejectedValue(dbError);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    insertMock.mockReturnValue({ values: valuesMock });

    await expect(storage.createSavedContent(payload)).rejects.toThrow(dbError);
    expect(safeLogMock).toHaveBeenCalledWith(
      'error',
      'Failed to create saved content record',
      expect.objectContaining({
        error: dbError.message,
        userId: payload.userId,
      })
    );
  });

  it('retrieves saved content for a user by id', async () => {
    const storage = createStorage();
    const savedRecord: SavedContent = {
      id: 55,
      userId: 123,
      title: 'Existing record',
      content: 'Body copy',
      platform: 'instagram',
      contentGenerationId: null,
      socialMediaPostId: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const limitMock = vi.fn().mockResolvedValue([savedRecord]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    selectMock.mockReturnValue({ from: fromMock });

    const result = await storage.getSavedContentById(savedRecord.id, savedRecord.userId);

    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalled();
    expect(whereMock).toHaveBeenCalled();
    expect(limitMock).toHaveBeenCalledWith(1);
    expect(result).toBe(savedRecord);
    expect(safeLogMock).not.toHaveBeenCalled();
  });
});