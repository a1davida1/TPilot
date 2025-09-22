import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type MockFn = ReturnType<typeof vi.fn>;

type MockedDb = {
  select: MockFn;
  update: MockFn;
  insert?: MockFn;
};

const dbModuleMock: { db: MockedDb } = {
  db: {
    select: vi.fn(),
    update: vi.fn()
  }
};

vi.mock('../../../server/db', () => dbModuleMock);
vi.mock('../../../server/db.ts', () => dbModuleMock);
vi.mock('../../../server/db.js', () => dbModuleMock);

const expenseCategoriesTableMock = {
  id: { name: 'id' },
  isActive: { name: 'isActive' },
  sortOrder: { name: 'sortOrder' },
  name: { name: 'name' },
  deductionPercentage: { name: 'deductionPercentage' },
  description: { name: 'description' },
  createdAt: { name: 'createdAt' },
  updatedAt: { name: 'updatedAt' }
};

vi.mock('../../../shared/schema.js', async () => {
  const actual = await vi.importActual<typeof import('../../../shared/schema.js')>('../../../shared/schema.js');
  return {
    ...actual,
    expenseCategories: expenseCategoriesTableMock
  };
});

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...actual,
    eq: vi.fn(() => ({})),
    asc: vi.fn(() => ({}))
  };
});

describe('Expense Categories Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const { db } = (await import('../../../server/db.ts')) as { db: MockedDb };
    db.select.mockReset();
    db.update.mockReset();
    if (db.insert) {
      db.insert.mockReset();
      delete db.insert;
    }
    const drizzle = await import('drizzle-orm');
    (drizzle.eq as unknown as MockFn).mockReset();
    (drizzle.asc as unknown as MockFn).mockReset();
  });

  describe('createExpenseCategory', () => {
    it('should create expense category with valid data', async () => {
      const categoryData = {
        name: 'Professional Development',
        description: 'Courses, certifications, and training',
        deductionPercentage: 100,
        isActive: true
      };

      const expectedCategory = {
        id: 1,
        ...categoryData,
        defaultBusinessPurpose: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const { db } = (await import('../../../server/db.ts')) as { db: MockedDb };
      const mockReturning = vi.fn().mockResolvedValueOnce([expectedCategory]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      db.insert = vi.fn().mockReturnValue({ values: mockValues });

      const { storage } = await import('../../../server/storage.ts');
      const result = await storage.createExpenseCategory(categoryData);

      expect(result).toEqual(expectedCategory);
      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(categoryData);
      expect(mockReturning).toHaveBeenCalledTimes(1);
    });

    it('should handle category creation error', async () => {
      const categoryData = {
        name: 'Test Category',
        description: 'Test description',
        deductionPercentage: 50,
        isActive: true
      };

      const { db } = (await import('../../../server/db.ts')) as { db: MockedDb };
      const mockReturning = vi.fn().mockRejectedValueOnce(new Error('Duplicate category name'));
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      db.insert = vi.fn().mockReturnValue({ values: mockValues });

      const { storage } = await import('../../../server/storage.ts');

      await expect(storage.createExpenseCategory(categoryData)).rejects.toThrow('Duplicate category name');
      expect(mockReturning).toHaveBeenCalledTimes(1);
    });
  });

  describe('getExpenseCategories', () => {
    it('should fetch all active expense categories', async () => {
      const mockCategories = [
        {
          id: 1,
          name: 'Beauty & Wellness',
          description: 'Professional beauty treatments',
          deductionPercentage: 100,
          isActive: true
        },
        {
          id: 2,
          name: 'Technology',
          description: 'Cameras, computers, software',
          deductionPercentage: 100,
          isActive: true
        }
      ];

      const { db } = (await import('../../../server/db.ts')) as { db: MockedDb };
      const mockOrderBy = vi.fn().mockResolvedValueOnce(mockCategories);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      db.select.mockReturnValue({ from: mockFrom });

      const { storage } = await import('../../../server/storage.ts');
      const result = await storage.getExpenseCategories();

      expect(result).toEqual(mockCategories);
      expect(mockOrderBy).toHaveBeenCalledTimes(1);
    });

    it('should handle empty categories list', async () => {
      const { db } = (await import('../../../server/db.ts')) as { db: MockedDb };
      const mockOrderBy = vi.fn().mockResolvedValueOnce([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      db.select.mockReturnValue({ from: mockFrom });

      const { storage } = await import('../../../server/storage.ts');
      const result = await storage.getExpenseCategories();

      expect(result).toEqual([]);
      expect(mockOrderBy).toHaveBeenCalledTimes(1);
    });

    it('should handle database error gracefully', async () => {
      const { db } = (await import('../../../server/db.ts')) as { db: MockedDb };
      const mockOrderBy = vi.fn().mockRejectedValueOnce(new Error('Database connection failed'));
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      db.select.mockReturnValue({ from: mockFrom });

      const { storage } = await import('../../../server/storage.ts');
      const result = await storage.getExpenseCategories();

      expect(result).toEqual([]);
      expect(mockOrderBy).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateExpenseCategory', () => {
    it('should update category successfully', async () => {
      const categoryId = 1;
      const updates = {
        description: 'Updated description',
        deductionPercentage: 75
      };

      const updatedCategory = {
        id: categoryId,
        name: 'Technology',
        ...updates,
        isActive: true,
        updatedAt: new Date()
      };

      const { db } = (await import('../../../server/db.ts')) as { db: MockedDb };
      const mockReturning = vi.fn().mockResolvedValueOnce([updatedCategory]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      db.update.mockReturnValue({ set: mockSet });

      const { storage } = await import('../../../server/storage.ts');
      const result = await storage.updateExpenseCategory(categoryId, updates);

      expect(result).toEqual(updatedCategory);
      expect(mockReturning).toHaveBeenCalledTimes(1);
    });

    it('should handle update error', async () => {
      const categoryId = 999;
      const updates = { name: 'New Name' };

      const { db } = (await import('../../../server/db.ts')) as { db: MockedDb };
      const mockReturning = vi.fn().mockRejectedValueOnce(new Error('Category not found'));
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      db.update.mockReturnValue({ set: mockSet });

      const { storage } = await import('../../../server/storage.ts');

      await expect(storage.updateExpenseCategory(categoryId, updates)).rejects.toThrow('Category not found');
      expect(mockReturning).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteExpenseCategory', () => {
    it('should soft delete category (set isActive to false)', async () => {
      const categoryId = 2;

      const { db } = (await import('../../../server/db.ts')) as { db: MockedDb };
      const mockWhere = vi.fn().mockResolvedValueOnce(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      db.update.mockReturnValue({ set: mockSet });

      const { storage } = await import('../../../server/storage.ts');
      await storage.deleteExpenseCategory(categoryId);

      expect(mockWhere).toHaveBeenCalledTimes(1);
    });

    it('should handle deletion error', async () => {
      const categoryId = 999;

      const { db } = (await import('../../../server/db.ts')) as { db: MockedDb };
      const mockWhere = vi.fn().mockRejectedValueOnce(new Error('Category not found'));
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      db.update.mockReturnValue({ set: mockSet });

      const { storage } = await import('../../../server/storage.ts');

      await expect(storage.deleteExpenseCategory(categoryId)).rejects.toThrow('Category not found');
      expect(mockWhere).toHaveBeenCalledTimes(1);
    });
  });

  describe('getExpenseCategory', () => {
    it('should fetch single category by ID', async () => {
      const categoryId = 1;
      const mockCategory = {
        id: categoryId,
        name: 'Beauty & Wellness',
        description: 'Professional beauty treatments',
        deductionPercentage: 100,
        isActive: true
      };

      const { db } = (await import('../../../server/db.ts')) as { db: MockedDb };
      const mockWhere = vi.fn().mockResolvedValueOnce([mockCategory]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      db.select.mockReturnValue({ from: mockFrom });

      const { storage } = await import('../../../server/storage.ts');
      const result = await storage.getExpenseCategory(categoryId);

      expect(result).toEqual(mockCategory);
      expect(mockWhere).toHaveBeenCalledTimes(1);
    });

    it('should return undefined for non-existent category', async () => {
      const categoryId = 999;

      const { db } = (await import('../../../server/db.ts')) as { db: MockedDb };
      const mockWhere = vi.fn().mockResolvedValueOnce([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      db.select.mockReturnValue({ from: mockFrom });

      const { storage } = await import('../../../server/storage.ts');
      const result = await storage.getExpenseCategory(categoryId);

      expect(result).toBeUndefined();
      expect(mockWhere).toHaveBeenCalledTimes(1);
    });

    it('should handle database error', async () => {
      const categoryId = 1;

      const { db } = (await import('../../../server/db.ts')) as { db: MockedDb };
      const mockWhere = vi.fn().mockRejectedValueOnce(new Error('Database error'));
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      db.select.mockReturnValue({ from: mockFrom });

      const { storage } = await import('../../../server/storage.ts');

      const result = await storage.getExpenseCategory(categoryId);

      expect(result).toBeUndefined();
      expect(mockWhere).toHaveBeenCalledTimes(1);
    });
  });
});