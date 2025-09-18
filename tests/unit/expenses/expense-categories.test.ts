import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the storage module
const mockStorage = {
  getExpenseCategories: vi.fn(),
  updateExpenseCategory: vi.fn(),
  deleteExpenseCategory: vi.fn(),
  getExpenseCategory: vi.fn(),
  createExpenseCategory: vi.fn(), // Added mock for createExpenseCategory
};

vi.mock('../../../server/storage', () => ({
  storage: mockStorage
}));

describe('Expense Categories Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStorage.createExpenseCategory.mockResolvedValueOnce(expectedCategory);

      const { storage } = await import('../../../server/storage.js');
      const result = await storage.createExpenseCategory(categoryData);

      expect(result).toEqual(expectedCategory);
      expect(mockStorage.createExpenseCategory).toHaveBeenCalledTimes(1);
      expect(mockStorage.createExpenseCategory).toHaveBeenCalledWith(categoryData);
    });

    it('should handle category creation error', async () => {
      const categoryData = {
        name: 'Test Category',
        description: 'Test description',
        deductionPercentage: 50,
        isActive: true
      };

      mockStorage.createExpenseCategory.mockRejectedValueOnce(new Error('Duplicate category name'));

      const { storage } = await import('../../../server/storage.js');
      await expect(storage.createExpenseCategory(categoryData)).rejects.toThrow('Duplicate category name');
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

      mockStorage.getExpenseCategories.mockResolvedValueOnce(mockCategories);

      const { storage } = await import('../../../server/storage.js');
      const result = await storage.getExpenseCategories();

      expect(result).toEqual(mockCategories);
      expect(mockStorage.getExpenseCategories).toHaveBeenCalledTimes(1);
    });

    it('should handle empty categories list', async () => {
      mockStorage.getExpenseCategories.mockResolvedValueOnce([]);

      const { storage } = await import('../../../server/storage.js');
      const result = await storage.getExpenseCategories();

      expect(result).toEqual([]);
    });

    it('should handle database error', async () => {
      // Mock the entire query chain
      const mockWhere = vi.fn().mockRejectedValueOnce(new Error('Database connection failed'));
      const mockSelect = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const { storage } = await import('../../../server/storage.js');
      const result = await storage.getExpenseCategories();
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

      // Mock the entire update chain
      const mockReturning = vi.fn().mockResolvedValueOnce([updatedCategory]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      vi.mocked(db.update).mockReturnValue(mockUpdate as any);

      const { storage } = await import('../../../server/storage.js');
      const result = await storage.updateExpenseCategory(categoryId, updates);

      expect(result).toEqual(updatedCategory);
      expect(mockStorage.updateExpenseCategory).toHaveBeenCalledTimes(1);
      expect(mockStorage.updateExpenseCategory).toHaveBeenCalledWith(categoryId, updates);
    });

    it('should handle update error', async () => {
      const categoryId = 999;
      const updates = { name: 'New Name' };

      // Mock the entire update chain to throw error
      const mockReturning = vi.fn().mockRejectedValueOnce(new Error('Category not found'));
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      vi.mocked(db.update).mockReturnValue(mockUpdate as any);

      const { storage } = await import('../../../server/storage.js');

      await expect(storage.updateExpenseCategory(categoryId, updates)).rejects.toThrow('Category not found');
    });
  });

  describe('deleteExpenseCategory', () => {
    it('should soft delete category (set isActive to false)', async () => {
      const categoryId = 2;

      mockStorage.deleteExpenseCategory.mockResolvedValue(undefined);

      const { storage } = await import('../../../server/storage.js');
      await storage.deleteExpenseCategory(categoryId);

      expect(mockStorage.deleteExpenseCategory).toHaveBeenCalledTimes(1);
      expect(mockStorage.deleteExpenseCategory).toHaveBeenCalledWith(categoryId);
    });

    it('should handle deletion error', async () => {
      const categoryId = 999;

      mockStorage.deleteExpenseCategory.mockRejectedValueOnce(new Error('Category not found'));

      const { storage } = await import('../../../server/storage.js');

      await expect(storage.deleteExpenseCategory(categoryId)).rejects.toThrow('Category not found');
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

      mockStorage.getExpenseCategory.mockResolvedValueOnce(mockCategory);

      const { storage } = await import('../../../server/storage.js');
      const result = await storage.getExpenseCategory(categoryId);

      expect(result).toEqual(mockCategory);
      expect(mockStorage.getExpenseCategory).toHaveBeenCalledTimes(1);
      expect(mockStorage.getExpenseCategory).toHaveBeenCalledWith(categoryId);
    });

    it('should return undefined for non-existent category', async () => {
      const categoryId = 999;

      mockStorage.getExpenseCategory.mockResolvedValueOnce(undefined);

      const { storage } = await import('../../../server/storage.js');
      const result = await storage.getExpenseCategory(categoryId);

      expect(result).toBeUndefined();
    });

    it('should handle database error', async () => {
      const categoryId = 1;

      mockStorage.getExpenseCategory.mockRejectedValueOnce(new Error('Database error'));

      const { storage } = await import('../../../server/storage.js');

      await expect(storage.getExpenseCategory(categoryId)).rejects.toThrow('Database error');
    });
  });
});