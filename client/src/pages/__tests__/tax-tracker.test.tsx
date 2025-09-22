import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

type MockQueryOptions = {
  queryKey: unknown;
  enabled?: boolean;
};

type MockQueryResult = {
  data: unknown;
  isLoading: boolean;
  error: unknown;
};

interface MockMutationResult {
  mutate: (variables?: unknown) => void;
  mutateAsync: (variables?: unknown) => Promise<unknown>;
  isPending: boolean;
  reset: () => void;
}

const mockUseQuery = vi.fn().mockReturnValue({} as MockQueryResult);
const mockUseMutation = vi.fn().mockReturnValue({} as MockMutationResult);
const mockInvalidateQueries = vi.fn();
const mockSetQueryData = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query'
  );

  return {
    ...actual,
    useQuery: (options: MockQueryOptions) => mockUseQuery(),
    useMutation: (options: unknown) => mockUseMutation(),
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
      setQueryData: mockSetQueryData,
    }),
  };
});

const globalScope = globalThis as typeof globalThis & {
  React?: typeof React;
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

globalScope.React = React;

globalScope.IS_REACT_ACT_ENVIRONMENT = true;

const flushPromises = () => new Promise<void>((resolve) => {
  setTimeout(resolve, 0);
});

describe('TaxTracker deduction badges', () => {
  beforeEach(() => {
    vi.resetModules();
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockInvalidateQueries.mockReset();
    mockSetQueryData.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders deduction badges for full, partial, and unknown categories', async () => {
    const categories = [
      {
        id: 1,
        name: 'Beauty & Wellness',
        deductionPercentage: 100,
        icon: 'Sparkles',
        color: '#f0f0f0',
        description: 'Cosmetic and wellness expenses related to content creation.',
        examples: ['Facials', 'Makeup'],
        legalExplanation: 'Fully deductible when directly tied to business activities.'
      },
      {
        id: 2,
        name: 'Home Office',
        deductionPercentage: 50,
        icon: 'Calculator',
        color: '#e0e0ff',
        description: 'Shared personal and business expenses for the home office.',
        examples: ['Rent', 'Utilities'],
        legalExplanation: 'Partially deductible based on dedicated workspace usage.'
      }
    ] as const;

    const recentExpenses = [
      {
        id: 101,
        description: 'Professional Photoshoot',
        amount: 25000,
        categoryId: 1,
        expenseDate: '2024-01-10',
        taxYear: 2024,
        category: categories[0]
      },
      {
        id: 102,
        description: 'Home Office Internet',
        amount: 8000,
        categoryId: 2,
        expenseDate: '2024-02-15',
        taxYear: 2024,
        category: categories[1]
      },
      {
        id: 103,
        description: 'Miscellaneous Supplies',
        amount: 5000,
        categoryId: 999,
        expenseDate: '2024-03-05',
        taxYear: 2024,
        category: null
      }
    ] as const;

    const totals = { total: 0, deductible: 0, byCategory: {} } as const;

    mockUseQuery.mockImplementation((options: MockQueryOptions): MockQueryResult => {
      const key = Array.isArray(options.queryKey) ? options.queryKey[0] : options.queryKey;
      switch (key) {
        case '/api/expense-categories':
          return { data: categories, isLoading: false, error: null };
        case '/api/expenses/totals':
          return { data: totals, isLoading: false, error: null };
        case '/api/expenses':
          return { data: recentExpenses, isLoading: false, error: null };
        case '/api/expenses/range':
          return { data: [], isLoading: false, error: null };
        case '/api/tax-guidance':
          return { data: [], isLoading: false, error: null };
        default:
          return { data: undefined, isLoading: false, error: null };
      }
    });

    mockUseMutation.mockImplementation((): MockMutationResult => ({
      mutate: () => undefined,
      mutateAsync: async () => undefined,
      isPending: false,
      reset: () => undefined,
    }));

    const { default: TaxTracker } = await import('../tax-tracker');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TaxTracker />);
      await flushPromises();
    });

    const badges = Array.from(
      container.querySelectorAll('[data-testid="recent-expense-deduction-badge"]')
    );

    expect(badges).toHaveLength(3);
    expect(badges[0]?.textContent).toBe('100% Deductible');
    expect(badges[1]?.textContent).toBe('50% Deductible (Home Office)');
    expect(badges[2]?.textContent).toBe('—% Deductible');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});