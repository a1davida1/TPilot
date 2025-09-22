import { vi } from 'vitest';

export type MockQueryOptions = {
  queryKey: unknown;
  enabled?: boolean;
};

export type MockQueryResult = {
  data: unknown;
  isLoading: boolean;
  error: unknown;
};

export interface MockMutationResult {
  mutate: (variables?: unknown) => void;
  mutateAsync: (variables?: unknown) => Promise<unknown>;
  isPending: boolean;
  reset: () => void;
}

/**
 * Creates shared React Query test mocks that can be used across client tests
 * Prevents 'reading queryKey' errors by properly passing options to mocks
 */
export function buildQueryMocks() {
  const mockUseQuery = vi.fn().mockReturnValue({} as MockQueryResult);
  const mockUseMutation = vi.fn().mockReturnValue({} as MockMutationResult);
  const mockInvalidateQueries = vi.fn();
  const mockSetQueryData = vi.fn();

  const reactQueryMock = vi.fn().mockImplementation(async () => {
    const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
      '@tanstack/react-query'
    );

    return {
      ...actual,
      useQuery: (options: MockQueryOptions) => mockUseQuery(options),
      useMutation: (options: unknown) => mockUseMutation(options),
      useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
        setQueryData: mockSetQueryData,
      }),
    };
  });

  return {
    mockUseQuery,
    mockUseMutation,
    mockInvalidateQueries,
    mockSetQueryData,
    reactQueryMock
  };
}