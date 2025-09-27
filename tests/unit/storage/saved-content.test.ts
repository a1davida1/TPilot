import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { InsertSavedContent, SavedContent } from '../../../shared/schema.js';

const insertMock = vi.fn();
const selectMock = vi.fn();
const deleteMock = vi.fn();
const safeLogMock = vi.fn();

vi.mock('../../../server/db.js', () => ({
  db: {
    insert: (...args: unknown[]) => insertMock(...args),
    select: (...args: unknown[]) => selectMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

vi.mock('../../../server/lib/logger-utils.js', () => ({
  safeLog: safeLogMock,
}));

let DatabaseStorageClass: typeof import('../../../server/storage.js').DatabaseStorage;

const basePayload: InsertSavedContent = {
  userId: 1,
  title: 'Sample',
  content: 'Saved content body',
};

beforeEach(async () => {
  insertMock.mockReset();
  selectMock.mockReset();
  deleteMock.mockReset();
  safeLogMock.mockReset();
  vi.resetModules();
  ({ DatabaseStorage: DatabaseStorageClass } = await import('../../../server/storage.js'));
});

describe('DatabaseStorage saved content operations', () => {
  it('creates saved content successfully', async () => {
    const createdRecord: SavedContent = {
      id: 10,
      userId: 1,
      title: basePayload.title,
      content: basePayload.content,
      platform: 'instagram',
      tags: ['tag'],
      metadata: { foo: 'bar' },
      contentGenerationId: null,
      socialMediaPostId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const returningMock = vi.fn().mockResolvedValue([createdRecord]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    insertMock.mockReturnValue({ values: valuesMock });

    const storage = new DatabaseStorageClass();
    const result = await storage.createSavedContent(basePayload);

    expect(insertMock).toHaveBeenCalledOnce();
    expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining(basePayload));
    expect(returningMock).toHaveBeenCalledOnce();
    expect(result).toEqual(createdRecord);
  });

  it('logs and rethrows when createSavedContent fails', async () => {
    const failure = new Error('insert failure');
    const returningMock = vi.fn().mockRejectedValue(failure);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    insertMock.mockReturnValue({ values: valuesMock });

    const storage = new DatabaseStorageClass();

    await expect(storage.createSavedContent(basePayload)).rejects.toThrow(failure);
    expect(safeLogMock).toHaveBeenCalledWith('error', expect.stringContaining('creating saved content'), expect.objectContaining({
      error: failure.message,
      userId: basePayload.userId,
    }));
  });

  it('retrieves saved content by id when owned by user', async () => {
    const record: SavedContent = {
      id: 42,
      userId: 1,
      title: 'Owned',
      content: 'Owned content',
      platform: null,
      tags: null,
      metadata: null,
      contentGenerationId: null,
      socialMediaPostId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    selectMock.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([record]),
        }),
      }),
    });

    const storage = new DatabaseStorageClass();
    const result = await storage.getSavedContentById(42, 1);

    expect(result).toEqual(record);
  });

  it('returns undefined and logs when getSavedContentById throws', async () => {
    const failure = new Error('select failure');
    selectMock.mockImplementation(() => { throw failure; });

    const storage = new DatabaseStorageClass();
    const result = await storage.getSavedContentById(1, 1);

    expect(result).toBeUndefined();
    expect(safeLogMock).toHaveBeenCalledWith('error', expect.stringContaining('getting saved content by id'), expect.objectContaining({
      error: failure.message,
      id: 1,
      userId: 1,
    }));
  });

  it('returns user saved content list', async () => {
    const records: SavedContent[] = [
      {
        id: 1,
        userId: 5,
        title: 'First',
        content: 'Content A',
        platform: 'x',
        tags: ['one'],
        metadata: null,
        contentGenerationId: null,
        socialMediaPostId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    selectMock.mockReturnValue({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(records),
        }),
      }),
    });

    const storage = new DatabaseStorageClass();
    const result = await storage.getUserSavedContent(5);

    expect(result).toEqual(records);
  });

  it('returns empty array and logs when getUserSavedContent fails', async () => {
    const failure = new Error('user list failure');
    selectMock.mockImplementation(() => { throw failure; });

    const storage = new DatabaseStorageClass();
    const result = await storage.getUserSavedContent(3);

    expect(result).toEqual([]);
    expect(safeLogMock).toHaveBeenCalledWith('error', expect.stringContaining('getting user saved content'), expect.objectContaining({
      error: failure.message,
      userId: 3,
    }));
  });

  it('deletes saved content for user', async () => {
    deleteMock.mockReturnValue({
      where: () => Promise.resolve(undefined),
    });

    const storage = new DatabaseStorageClass();
    await storage.deleteSavedContent(7, 2);

    expect(deleteMock).toHaveBeenCalledOnce();
  });

  it('logs and rethrows when deleteSavedContent fails', async () => {
    const failure = new Error('delete failure');
    deleteMock.mockReturnValue({
      where: () => Promise.reject(failure),
    });

    const storage = new DatabaseStorageClass();
    await expect(storage.deleteSavedContent(9, 2)).rejects.toThrow(failure);

    expect(safeLogMock).toHaveBeenCalledWith('error', expect.stringContaining('deleting saved content'), expect.objectContaining({
      error: failure.message,
      id: 9,
      userId: 2,
    }));
  });
});