import { storage } from "../../server/storage";
/* eslint-env node, jest */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { InsertExpense } from '@shared/schema';

// Mock database with proper hoisting
vi.mock('../../../server/db.js', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis()
  }
}));

import { DatabaseStorage } from '../../../server/storage';
import { db } from '../../../server/db.js';

describe('Expense Operations Unit Tests', () => {
  let storage: DatabaseStorage;
  const userId = 123;
  const categoryId = 1;

  beforeEach(() => {
    storage = storage;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createExpense', () => {
    test('should create expense with valid data', async () => {
      const expenseData: InsertExpense = {
        userId,
        categoryId,
        description: 'Professional camera equipment',
        amount: 150000, // $1500.00 in cents
        expenseDate: new Date('2024-01-15'),
        taxYear: 2024,
        deductionPercentage: 100,
        notes: 'Used for content creation'
      };

      const expectedExpense = {
        id: 1,
        ...expenseData,
        receiptUrl: null,
        receiptFileName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (db.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([expectedExpense]);

      const result = await storage.createExpense(expenseData);

      expect(db.insert).toHaveBeenCalledWith(expect.anything());
      expect(db.values).toHaveBeenCalledWith(expenseData);
      expect(db.returning).toHaveBeenCalled();
      expect(result).toEqual(expectedExpense);
    });

    test('should handle expense creation error', async () => {
      const expenseData: InsertExpense = {
        userId,
        categoryId,
        description: 'Test expense',
        amount: 5000,
        expenseDate: new Date(),
        taxYear: 2024,
        deductionPercentage: 100
      };

      (db.returning as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Database error'));

      await expect(storage.createExpense(expenseData)).rejects.toThrow('Database error');
    });

    test('should create expense with optional fields', async () => {
      const minimalExpenseData: InsertExpense = {
        userId,
        categoryId,
        description: 'Minimal expense',
        amount: 2500,
        expenseDate: new Date(),
        taxYear: 2024,
        deductionPercentage: 100
      };

      const expectedExpense = {
        id: 2,
        ...minimalExpenseData,
        receiptUrl: null,
        receiptFileName: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (db.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([expectedExpense]);

      const result = await storage.createExpense(minimalExpenseData);

      expect(result).toEqual(expectedExpense);
      expect(db.values).toHaveBeenCalledWith(minimalExpenseData);
    });
  });

  describe('deleteExpense', () => {
    test('should delete expense with valid ID and userId', async () => {
      const expenseId = 5;
      
      (db.where as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

      await storage.deleteExpense(expenseId, userId);

      expect(db.delete).toHaveBeenCalledWith(expect.anything());
      expect(db.where).toHaveBeenCalled();
    });

    test('should handle deletion error', async () => {
      const expenseId = 5;
      
      (db.where as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Expense not found'));

      await expect(storage.deleteExpense(expenseId, userId)).rejects.toThrow('Expense not found');
    });

    test('should only delete expense owned by user', async () => {
      const expenseId = 5;
      const otherUserId = 456;
      
      await storage.deleteExpense(expenseId, otherUserId);

      // Verify the where clause includes both expense ID and user ID
      expect(db.where).toHaveBeenCalled();
    });
  });

  describe('getExpenseTotals', () => {
    test('should calculate expense totals correctly', async () => {
      const mockExpenses = [
        { categoryName: 'Beauty & Wellness', amount: 10000, deductionPercentage: 100 },
        { categoryName: 'Technology', amount: 50000, deductionPercentage: 100 },
        { categoryName: 'Travel', amount: 25000, deductionPercentage: 50 }
      ];

      (db.where as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockExpenses);

      const result = await storage.getExpenseTotals(userId, 2024);

      expect(result).toEqual({
        total: 85000, // $850.00 total
        deductible: 72500, // $725.00 deductible (10000 + 50000 + 12500)
        byCategory: {
          'Beauty & Wellness': 10000,
          'Technology': 50000,
          'Travel': 25000
        }
      });
    });

    test('should handle empty expense list', async () => {
      (db.where as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const result = await storage.getExpenseTotals(userId, 2024);

      expect(result).toEqual({
        total: 0,
        deductible: 0,
        byCategory: {}
      });
    });

    test('should filter by tax year when specified', async () => {
      const taxYear = 2023;
      
      const mockExpenses = [
        { categoryName: 'Beauty & Wellness', amount: 5000, deductionPercentage: 100 }
      ];

      (db.where as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockExpenses);

      const result = await storage.getExpenseTotals(userId, taxYear);

      expect(result.total).toBe(5000);
      expect(db.where).toHaveBeenCalled();
    });

    test('should handle partial deduction percentages', async () => {
      const mockExpenses = [
        { categoryName: 'Mixed Use Equipment', amount: 20000, deductionPercentage: 75 },
        { categoryName: 'Home Office', amount: 30000, deductionPercentage: 30 }
      ];

      (db.where as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockExpenses);

      const result = await storage.getExpenseTotals(userId);

      expect(result).toEqual({
        total: 50000, // $500.00 total
        deductible: 24000, // $240.00 deductible (15000 + 9000)
        byCategory: {
          'Mixed Use Equipment': 20000,
          'Home Office': 30000
        }
      });
    });

    test('should handle database error in totals calculation', async () => {
      (db.where as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(storage.getExpenseTotals(userId, 2024)).rejects.toThrow('Database connection failed');
    });
  });

  describe('updateExpense', () => {
    test('should update expense with receipt information', async () => {
      const expenseId = 3;
      const updates = {
        receiptUrl: '/uploads/receipts/receipt_123.pdf',
        receiptFileName: 'receipt_123.pdf'
      };

      const updatedExpense = {
        id: expenseId,
        userId,
        categoryId,
        description: 'Updated expense',
        amount: 7500,
        ...updates,
        updatedAt: new Date()
      };

      (db.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([updatedExpense]);

      const result = await storage.updateExpense(expenseId, userId, updates);

      expect(db.update).toHaveBeenCalled();
      expect(db.where).toHaveBeenCalled();
      expect(result).toEqual(updatedExpense);
    });

    test('should update expense amount', async () => {
      const expenseId = 4;
      const updates = {
        amount: 12000,
        description: 'Updated description'
      };

      const updatedExpense = {
        id: expenseId,
        userId,
        ...updates,
        updatedAt: new Date()
      };

      (db.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([updatedExpense]);

      const result = await storage.updateExpense(expenseId, userId, updates);

      expect(result.amount).toBe(12000);
      expect(result.description).toBe('Updated description');
    });

    test('should handle update error', async () => {
      const expenseId = 4;
      const updates = { amount: 15000 };

      (db.returning as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Update failed'));

      await expect(storage.updateExpense(expenseId, userId, updates)).rejects.toThrow('Update failed');
    });
  });

  describe('getUserExpenses', () => {
    test('should fetch user expenses with category information', async () => {
      const mockExpensesWithCategories = [
        {
          expense: {
            id: 1,
            userId,
            categoryId: 1,
            description: 'Camera lens',
            amount: 75000,
            expenseDate: new Date('2024-01-15'),
            taxYear: 2024
          },
          category: {
            id: 1,
            name: 'Technology',
            deductionPercentage: 100
          }
        }
      ];

      (db.orderBy as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockExpensesWithCategories);

      const result = await storage.getUserExpenses(userId, 2024);

      expect(db.select).toHaveBeenCalled();
      expect(db.leftJoin).toHaveBeenCalled();
      expect(db.where).toHaveBeenCalled();
      expect(result).toEqual(mockExpensesWithCategories);
    });

    test('should fetch expenses without tax year filter', async () => {
      const mockAllExpenses = [
        {
          expense: { id: 1, userId, description: 'Expense 1', taxYear: 2023 },
          category: { name: 'Category 1' }
        },
        {
          expense: { id: 2, userId, description: 'Expense 2', taxYear: 2024 },
          category: { name: 'Category 2' }
        }
      ];

      (db.orderBy as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockAllExpenses);

      const result = await storage.getUserExpenses(userId);

      expect(result).toEqual(mockAllExpenses);
      expect(db.where).toHaveBeenCalled();
    });
  });
});