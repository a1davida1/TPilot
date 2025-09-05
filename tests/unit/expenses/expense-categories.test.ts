/* eslint-env node, jest */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { InsertExpenseCategory } from '@shared/schema';

// Mock database with proper hoisting
vi.mock('../../../server/db.js', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis()
  }
}));

import { DatabaseStorage } from '../../../server/storage';
import { db } from '../../../server/db.js';

describe('Expense Categories Unit Tests', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    vi.clearAllMocks();
  });

  describe('createExpenseCategory', () => {
    test('should create expense category with valid data', async () => {
      const categoryData: InsertExpenseCategory = {
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

      (db.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([expectedCategory]);

      const result = await storage.createExpenseCategory(categoryData);

      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalledWith(categoryData);
      expect(result).toEqual(expectedCategory);
    });

    test('should handle category creation error', async () => {
      const categoryData: InsertExpenseCategory = {
        name: 'Test Category',
        description: 'Test description',
        deductionPercentage: 50,
        isActive: true
      };

      (db.returning as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Duplicate category name'));

      await expect(storage.createExpenseCategory(categoryData)).rejects.toThrow('Duplicate category name');
    });
  });

  describe('getExpenseCategories', () => {
    test('should fetch all active expense categories', async () => {
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

      (db.where as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCategories);

      const result = await storage.getExpenseCategories();

      expect(db.select).toHaveBeenCalled();
      expect(db.where).toHaveBeenCalled();
      expect(result).toEqual(mockCategories);
    });

    test('should handle empty categories list', async () => {
      (db.where as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const result = await storage.getExpenseCategories();

      expect(result).toEqual([]);
    });

    test('should handle database error', async () => {
      (db.where as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await storage.getExpenseCategories();

      expect(result).toEqual([]);
    });
  });

  describe('updateExpenseCategory', () => {
    test('should update category successfully', async () => {
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

      (db.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([updatedCategory]);

      const result = await storage.updateExpenseCategory(categoryId, updates);

      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalledWith(updates);
      expect(db.where).toHaveBeenCalled();
      expect(result).toEqual(updatedCategory);
    });

    test('should handle update error', async () => {
      const categoryId = 999;
      const updates = { name: 'New Name' };

      (db.returning as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Category not found'));

      await expect(storage.updateExpenseCategory(categoryId, updates)).rejects.toThrow('Category not found');
    });
  });

  describe('deleteExpenseCategory', () => {
    test('should soft delete category (set isActive to false)', async () => {
      const categoryId = 2;

      (db.where as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

      await storage.deleteExpenseCategory(categoryId);

      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalledWith({ isActive: false });
      expect(db.where).toHaveBeenCalled();
    });

    test('should handle deletion error', async () => {
      const categoryId = 999;

      (db.where as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Category not found'));

      await expect(storage.deleteExpenseCategory(categoryId)).rejects.toThrow('Category not found');
    });
  });

  describe('getExpenseCategory', () => {
    test('should fetch single category by ID', async () => {
      const categoryId = 1;
      const mockCategory = {
        id: categoryId,
        name: 'Beauty & Wellness',
        description: 'Professional beauty treatments',
        deductionPercentage: 100,
        isActive: true
      };

      (db.limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockCategory]);

      const result = await storage.getExpenseCategory(categoryId);

      expect(db.select).toHaveBeenCalled();
      expect(db.where).toHaveBeenCalled();
      expect(db.limit).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockCategory);
    });

    test('should return undefined for non-existent category', async () => {
      const categoryId = 999;

      (db.limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const result = await storage.getExpenseCategory(categoryId);

      expect(result).toBeUndefined();
    });

    test('should handle database error', async () => {
      const categoryId = 1;

      (db.limit as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Database error'));

      const result = await storage.getExpenseCategory(categoryId);

      expect(result).toBeUndefined();
    });
  });
});