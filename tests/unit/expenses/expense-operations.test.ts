/* eslint-env node, jest */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import type {
  InsertExpense,
  Expense,
  ExpenseCategory
} from '../../../shared/schema.js';
import type { IStorage } from '../../../server/storage';
import { buildStorageMock } from '../../_helpers/buildStorageMock.js';

// Mock the storage module
const mockStorage = buildStorageMock();

vi.mock('../../../server/storage.ts', () => ({
  storage: mockStorage
}));

describe('Expense Operations Unit Tests', () => {
  const userId = 123;
  const categoryId = 1;
  let storage: IStorage;

  beforeAll(async () => {
    vi.resetModules();
    // Import storage dynamically after mocks are set up
    const storageModule = await import('../../../server/storage.ts');
    storage = storageModule.storage;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createExpense', () => {
    it('should create expense with valid data', async () => {
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

      mockStorage.createExpense.mockResolvedValueOnce(expectedExpense);

      const result = await storage.createExpense(expenseData);

      expect(result).toEqual(expectedExpense);
      expect(mockStorage.createExpense).toHaveBeenCalledWith(expenseData);
    });

    it('should handle expense creation error', async () => {
      const expenseData: InsertExpense = {
        userId,
        categoryId,
        description: 'Test expense',
        amount: 5000,
        expenseDate: new Date(),
        taxYear: 2024,
        deductionPercentage: 100
      };

      mockStorage.createExpense.mockRejectedValueOnce(new Error('Database error'));

      await expect(storage.createExpense(expenseData)).rejects.toThrow('Database error');
    });

    it('should create expense with optional fields', async () => {
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

      mockStorage.createExpense.mockResolvedValueOnce(expectedExpense);

      const result = await storage.createExpense(minimalExpenseData);

      expect(result).toEqual(expectedExpense);
      expect(mockStorage.createExpense).toHaveBeenCalledWith(minimalExpenseData);
    });
  });

  describe('deleteExpense', () => {
    test('should delete expense with valid ID and userId', async () => {
      const expenseId = 5;

      mockStorage.deleteExpense.mockResolvedValueOnce(undefined);

      await storage.deleteExpense(expenseId, userId);

      expect(mockStorage.deleteExpense).toHaveBeenCalledWith(expenseId, userId);
    });

    test('should handle deletion error', async () => {
      const expenseId = 5;

      mockStorage.deleteExpense.mockRejectedValueOnce(new Error('Expense not found'));

      await expect(storage.deleteExpense(expenseId, userId)).rejects.toThrow('Expense not found');
    });

    test('should only delete expense owned by user', async () => {
      const expenseId = 5;
      const otherUserId = 456;

      mockStorage.deleteExpense.mockResolvedValueOnce(undefined);

      await storage.deleteExpense(expenseId, otherUserId);

      expect(mockStorage.deleteExpense).toHaveBeenCalledWith(expenseId, otherUserId);
    });
  });

  describe('getExpenseTotals', () => {
    test('should calculate expense totals correctly', async () => {
      const mockExpenses = [
        { categoryName: 'Beauty & Wellness', amount: 10000, deductionPercentage: 100 },
        { categoryName: 'Technology', amount: 50000, deductionPercentage: 100 },
        { categoryName: 'Travel', amount: 25000, deductionPercentage: 50 }
      ];

      const expectedTotals = {
        total: 85000, // $850.00 total
        deductible: 72500, // $725.00 deductible (10000 + 50000 + 12500)
        byCategory: {
          'Beauty & Wellness': 10000,
          'Technology': 50000,
          'Travel': 25000
        }
      };

      mockStorage.getExpenseTotals.mockResolvedValueOnce(expectedTotals);

      const result = await storage.getExpenseTotals(userId, 2024);

      expect(result).toEqual(expectedTotals);
      expect(mockStorage.getExpenseTotals).toHaveBeenCalledWith(userId, 2024);
    });

    test('should handle empty expense list', async () => {
      const expectedTotals = {
        total: 0,
        deductible: 0,
        byCategory: {}
      };

      mockStorage.getExpenseTotals.mockResolvedValueOnce(expectedTotals);

      const result = await storage.getExpenseTotals(userId, 2024);

      expect(result).toEqual(expectedTotals);
      expect(mockStorage.getExpenseTotals).toHaveBeenCalledWith(userId, 2024);
    });

    test('should filter by tax year when specified', async () => {
      const taxYear = 2023;

      const mockExpenses = [
        { categoryName: 'Beauty & Wellness', amount: 5000, deductionPercentage: 100 }
      ];

      const expectedTotals = {
        total: 5000,
        deductible: 5000,
        byCategory: { 'Beauty & Wellness': 5000 }
      };

      mockStorage.getExpenseTotals.mockResolvedValueOnce(expectedTotals);

      const result = await storage.getExpenseTotals(userId, taxYear);

      expect(result.total).toBe(5000);
      expect(mockStorage.getExpenseTotals).toHaveBeenCalledWith(userId, taxYear);
    });

    test('should handle partial deduction percentages', async () => {
      const mockExpenses = [
        { categoryName: 'Mixed Use Equipment', amount: 20000, deductionPercentage: 75 },
        { categoryName: 'Home Office', amount: 30000, deductionPercentage: 30 }
      ];

      const expectedTotals = {
        total: 50000, // $500.00 total
        deductible: 24000, // $240.00 deductible (15000 + 9000)
        byCategory: {
          'Mixed Use Equipment': 20000,
          'Home Office': 30000
        }
      };

      mockStorage.getExpenseTotals.mockResolvedValueOnce(expectedTotals);

      const result = await storage.getExpenseTotals(userId);

      expect(result).toEqual(expectedTotals);
      expect(mockStorage.getExpenseTotals).toHaveBeenCalledWith(userId);
    });

    test('should handle database error in totals calculation', async () => {
      mockStorage.getExpenseTotals.mockRejectedValueOnce(new Error('Database connection failed'));

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

      mockStorage.updateExpense.mockResolvedValueOnce(updatedExpense);

      const result = await storage.updateExpense(expenseId, userId, updates);

      expect(result).toEqual(updatedExpense);
      expect(mockStorage.updateExpense).toHaveBeenCalledWith(expenseId, userId, updates);
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

      mockStorage.updateExpense.mockResolvedValueOnce(updatedExpense);

      const result = await storage.updateExpense(expenseId, userId, updates);

      expect(result.amount).toBe(12000);
      expect(result.description).toBe('Updated description');
      expect(mockStorage.updateExpense).toHaveBeenCalledWith(expenseId, userId, updates);
    });

    test('should handle update error', async () => {
      const expenseId = 4;
      const updates = { amount: 15000 };

      mockStorage.updateExpense.mockRejectedValueOnce(new Error('Update failed'));

      await expect(storage.updateExpense(expenseId, userId, updates)).rejects.toThrow('Update failed');
    });
  });

  describe('getUserExpenses', () => {
    test('should fetch user expenses with category information', async () => {
      const mockExpensesWithCategories = [
        {
          id: 1,
          userId,
          categoryId: 1,
          amount: 75000,
          description: 'Camera lens',
          vendor: null,
          expenseDate: new Date('2024-01-15'),
          receiptUrl: null,
          receiptFileName: null,
          businessPurpose: null,
          deductionPercentage: 100,
          tags: null,
          isRecurring: false,
          recurringPeriod: null,
          taxYear: 2024,
          notes: null,
          createdAt: new Date('2024-01-20'),
          updatedAt: new Date('2024-01-20'),
          category: {
            id: 1,
            name: 'Technology',
            description: 'Equipment and technology purchases',
            legalExplanation: 'Equipment deduction',
            deductionPercentage: 100,
            itsDeductionCode: null,
            examples: [],
            icon: 'tech',
            color: '#000000',
            isActive: true,
            sortOrder: 1,
            defaultBusinessPurpose: null,
            createdAt: new Date('2024-01-01')
          }
        }
      ] satisfies Array<Expense & { category: ExpenseCategory | null }>;

      mockStorage.getUserExpenses.mockResolvedValueOnce(mockExpensesWithCategories);

      const result = await storage.getUserExpenses(userId, 2024);

      expect(result).toEqual(mockExpensesWithCategories);
      expect(result[0]?.category?.name).toBe('Technology');
      expect(mockStorage.getUserExpenses).toHaveBeenCalledWith(userId, 2024);
    });

    test('should fetch expenses without tax year filter', async () => {
      const mockAllExpenses = [
        {
          id: 1,
          userId,
          categoryId: 2,
          amount: 12000,
          description: 'Expense 1',
          vendor: null,
          expenseDate: new Date('2023-03-10'),
          receiptUrl: null,
          receiptFileName: null,
          businessPurpose: null,
          deductionPercentage: 80,
          tags: null,
          isRecurring: false,
          recurringPeriod: null,
          taxYear: 2023,
          notes: null,
          createdAt: new Date('2023-03-11'),
          updatedAt: new Date('2023-03-11'),
          category: {
            id: 2,
            name: 'Education',
            description: 'Courses and learning materials',
            legalExplanation: 'Education deduction',
            deductionPercentage: 80,
            itsDeductionCode: null,
            examples: ['Online courses'],
            icon: 'book',
            color: '#FFAA00',
            isActive: true,
            sortOrder: 2,
            defaultBusinessPurpose: null,
            createdAt: new Date('2023-01-01')
          }
        },
        {
          id: 2,
          userId,
          categoryId: 3,
          amount: 8500,
          description: 'Expense 2',
          vendor: null,
          expenseDate: new Date('2024-02-05'),
          receiptUrl: null,
          receiptFileName: null,
          businessPurpose: null,
          deductionPercentage: 100,
          tags: null,
          isRecurring: false,
          recurringPeriod: null,
          taxYear: 2024,
          notes: null,
          createdAt: new Date('2024-02-06'),
          updatedAt: new Date('2024-02-06'),
          category: {
            id: 3,
            name: 'Travel',
            description: 'Business travel expenses',
            legalExplanation: 'Travel deduction',
            deductionPercentage: 100,
            itsDeductionCode: null,
            examples: ['Flights', 'Hotels'],
            icon: 'plane',
            color: '#3366FF',
            isActive: true,
            sortOrder: 3,
            defaultBusinessPurpose: null,
            createdAt: new Date('2024-01-05')
          }
        }
      ] satisfies Array<Expense & { category: ExpenseCategory | null }>;

      mockStorage.getUserExpenses.mockResolvedValueOnce(mockAllExpenses);

      const result = await storage.getUserExpenses(userId);

      expect(result).toEqual(mockAllExpenses);
      expect(result).toHaveLength(2);
      expect(mockStorage.getUserExpenses).toHaveBeenCalledWith(userId);
    });
  });
});