import React, { act } from 'react';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

import { RedditAccounts } from '../reddit-accounts';

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();
const toastMock = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');

  return {
    ...actual,
    useQuery: (options: { queryKey: unknown }) => mockUseQuery(options),
    useMutation: () => mockUseMutation(),
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 1, username: 'tester' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

const globalScope = globalThis as typeof globalThis & { React?: typeof React; IS_REACT_ACT_ENVIRONMENT?: boolean };
globalScope.React = React;
globalScope.IS_REACT_ACT_ENVIRONMENT = true;

describe('RedditAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      reset: vi.fn(),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('displays a fallback connection date when the value is missing or invalid', async () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 1,
          username: 'valid-user',
          isActive: true,
          connectedAt: null,
          karma: 1234,
          verified: false,
        },
        {
          id: 2,
          username: 'invalid-user',
          isActive: false,
          connectedAt: 'not-a-real-date',
          karma: 5678,
          verified: true,
        },
      ],
      isLoading: false,
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<RedditAccounts />);
    });

    const textContent = container.textContent ?? '';
    const occurrences = textContent.split('Connection date unavailable').length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});