import { describe, it, expect } from 'vitest';
import type {
  ExpenseCategory,
  Expense,
} from '../../../shared/schema.js';
import { summarizeExpenseTotals } from '../../../server/storage.js';

function makeCategory(overrides: Partial<ExpenseCategory> & Pick<ExpenseCategory, 'name' | 'description' | 'legalExplanation' | 'deductionPercentage' | 'examples' | 'icon' | 'color' | 'isActive' | 'sortOrder'>, id: number): ExpenseCategory {
  const now = new Date('2024-01-01T00:00:00.000Z');
  return {
    id,
    createdAt: overrides.createdAt ?? now,
    name: overrides.name,
    description: overrides.description,
    legalExplanation: overrides.legalExplanation,
    deductionPercentage: overrides.deductionPercentage,
    examples: overrides.examples,
    icon: overrides.icon,
    color: overrides.color,
    isActive: overrides.isActive,
    sortOrder: overrides.sortOrder,
    itsDeductionCode: overrides.itsDeductionCode ?? null,
    defaultBusinessPurpose: overrides.defaultBusinessPurpose ?? null,
  } satisfies ExpenseCategory;
}

function makeExpense(overrides: Partial<Expense> & Pick<Expense, 'userId' | 'categoryId' | 'amount' | 'description' | 'taxYear' | 'deductionPercentage'>, id: number): Expense {
  const now = new Date('2024-01-01T00:00:00.000Z');
  return {
    id,
    userId: overrides.userId,
    categoryId: overrides.categoryId,
    amount: overrides.amount,
    description: overrides.description,
    taxYear: overrides.taxYear,
    deductionPercentage: overrides.deductionPercentage,
    vendor: overrides.vendor ?? null,
    expenseDate: overrides.expenseDate ?? now,
    receiptUrl: overrides.receiptUrl ?? null,
    receiptFileName: overrides.receiptFileName ?? null,
    businessPurpose: overrides.businessPurpose ?? null,
    tags: overrides.tags ?? null,
    isRecurring: overrides.isRecurring ?? false,
    recurringPeriod: overrides.recurringPeriod ?? null,
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  } satisfies Expense;
}

describe('getExpenseTotals', () => {
  it('applies stored deduction percentage for partially deductible categories', () => {
    const userId = 42;
    const taxYear = 2024;

    const sharedUtilities = makeCategory(
      {
        name: 'Shared Utilities',
        description: 'Utilities partially used for business operations',
        legalExplanation: 'Only the business-use portion is deductible.',
        deductionPercentage: 60,
        examples: ['Internet'],
        icon: 'bolt',
        color: '#224466',
        isActive: true,
        sortOrder: 1,
      },
      1,
    );

    const marketing = makeCategory(
      {
        name: 'Marketing',
        description: 'Campaigns that directly promote the business',
        legalExplanation: 'Marketing efforts are fully deductible.',
        deductionPercentage: 100,
        examples: ['Online ads'],
        icon: 'megaphone',
        color: '#FF8800',
        isActive: true,
        sortOrder: 2,
      },
      2,
    );

    const partialAmount = 20000;
    const fullAmount = 10000;

    const expenses = [
      makeExpense(
        {
          userId,
          categoryId: sharedUtilities.id,
          amount: partialAmount,
          description: 'Shared internet service',
          taxYear,
          deductionPercentage: sharedUtilities.deductionPercentage,
          businessPurpose: 'Home office connectivity',
        },
        1,
      ),
      makeExpense(
        {
          userId,
          categoryId: marketing.id,
          amount: fullAmount,
          description: 'Social media promotion',
          taxYear,
          deductionPercentage: marketing.deductionPercentage,
          businessPurpose: 'Audience growth campaign',
        },
        2,
      ),
    ];

    const rows = expenses.map((expense) => ({
      categoryName:
        expense.categoryId === sharedUtilities.id
          ? sharedUtilities.name
          : marketing.name,
      amount: expense.amount,
      deductionPercentage: expense.deductionPercentage,
    }));

    const totals = summarizeExpenseTotals(rows);

    const expectedPartialDeduction = Math.round(
      partialAmount * (sharedUtilities.deductionPercentage / 100),
    );
    const expectedFullDeduction = Math.round(
      fullAmount * (marketing.deductionPercentage / 100),
    );

    expect(totals.total).toBe(partialAmount + fullAmount);
    expect(totals.deductible).toBe(expectedPartialDeduction + expectedFullDeduction);
    expect(totals.byCategory[sharedUtilities.name]).toBe(expectedPartialDeduction);
    expect(totals.byCategory[marketing.name]).toBe(expectedFullDeduction);
  });
});