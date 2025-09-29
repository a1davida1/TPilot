
import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { Expense, ExpenseCategory } from '../../../shared/schema.js';
import { DatabaseStorage } from '../../../server/storage.js';

const updateMock = vi.hoisted(() => vi.fn());
const setMock = vi.hoisted(() => vi.fn());
const whereMock = vi.hoisted(() => vi.fn());
const returningMock = vi.hoisted(() => vi.fn());

vi.mock('../../../server/db.js', () => ({
  db: {
    update: (...args: unknown[]) => updateMock(...args),
  },
}));

class TestableStorage extends DatabaseStorage {
  constructor(private readonly expense: Expense, private readonly category: ExpenseCategory) {
    super();
  }

  async getExpense(id: number, userId: number): Promise<Expense | undefined> {
    if (id === this.expense.id && userId === this.expense.userId) {
      return this.expense;
    }

    return undefined;
  }

  async getExpenseCategory(categoryId: number): Promise<ExpenseCategory | undefined> {
    if (categoryId === this.category.id) {
      return this.category;
    }

    return undefined;
  }
}

describe('DatabaseStorage.updateExpense business purpose handling', () => {
  let lastSetPayload: Partial<Expense> | undefined;

  beforeEach(() => {
    lastSetPayload = undefined;
    updateMock.mockReset();
    setMock.mockReset();
    whereMock.mockReset();
    returningMock.mockReset();

    setMock.mockImplementation((value: Partial<Expense>) => {
      lastSetPayload = value;
      return { where: whereMock };
    });

    whereMock.mockImplementation(() => ({ returning: returningMock }));
    updateMock.mockImplementation(() => ({ set: setMock }));
  });

  test('applies category default when business purpose is cleared without category change', async () => {
    const now = new Date('2024-01-01T00:00:00.000Z');
    const defaultBusinessPurpose = 'Client meeting travel';

    const existingExpense: Expense = {
      id: 42,
      userId: 7,
      categoryId: 9,
      amount: 12500,
      description: 'Flight to client site',
      vendor: null,
      expenseDate: now,
      receiptUrl: null,
      receiptFileName: null,
      businessPurpose: 'Custom purpose to remove',
      deductionPercentage: 100,
      tags: null,
      isRecurring: false,
      recurringPeriod: null,
      taxYear: 2024,
      notes: null,
      createdAt: now,
      updatedAt: now,
    };

    const categoryWithDefault: ExpenseCategory = {
      id: existingExpense.categoryId,
      name: 'Travel',
      description: 'Business travel expenses',
      legalExplanation: 'Deductible when travel is primarily for business.',
      deductionPercentage: 100,
      examples: ['Flights', 'Hotels'],
      icon: 'plane',
      color: '#0055AA',
      isActive: true,
      sortOrder: 1,
      itsDeductionCode: null,
      defaultBusinessPurpose,
      createdAt: now,
    };

    const updatedExpense: Expense = {
      ...existingExpense,
      businessPurpose: defaultBusinessPurpose,
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    };

    returningMock.mockResolvedValueOnce([updatedExpense]);

    const storage = new TestableStorage(existingExpense, categoryWithDefault);

    const result = await storage.updateExpense(existingExpense.id, existingExpense.userId, {
      businessPurpose: undefined,
    });

    expect(result.businessPurpose).toBe(defaultBusinessPurpose);
    expect(lastSetPayload?.businessPurpose).toBe(defaultBusinessPurpose);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(setMock).toHaveBeenCalledTimes(1);
    expect(whereMock).toHaveBeenCalledTimes(1);
    expect(returningMock).toHaveBeenCalledTimes(1);
  });
});
