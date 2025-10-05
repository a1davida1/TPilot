import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from "react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnboardingWalkthrough } from '../onboarding-walkthrough';

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user-123' },
    isAuthenticated: true,
  })),
}));

describe('OnboardingWalkthrough', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let queryClient: QueryClient;
  let localStorageMock: Record<string, string>;
  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock localStorage
    localStorageMock = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return localStorageMock[key] || null;
    });

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      localStorageMock[key] = value;
      return undefined;
    });

    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      delete localStorageMock[key];
      return undefined;
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    document.body.removeChild(container);
    vi.restoreAllMocks();
    mockOnClose.mockClear();
    mockOnComplete.mockClear();
  });

  it('renders walkthrough when open', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <OnboardingWalkthrough 
            isOpen={true} 
            onClose={mockOnClose} 
            onComplete={mockOnComplete} 
          />
        </QueryClientProvider>
      );
    });

    expect(container.querySelector('[data-testid="button-walkthrough-next"]')).toBeTruthy();
  });

  it('persists user-specific progress to localStorage', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <OnboardingWalkthrough 
            isOpen={true} 
            onClose={mockOnClose} 
            onComplete={mockOnComplete} 
          />
        </QueryClientProvider>
      );
    });

    const nextButton = container.querySelector('[data-testid="button-walkthrough-next"]') as HTMLButtonElement;
    
    act(() => {
      nextButton?.click();
    });

    // Verify user-specific storage key was set
    const storageKey = 'walkthrough-progress-test-user-123';
    expect(localStorageMock[storageKey]).toBeTruthy();
  });

  it('restarts walkthrough when restart button clicked', () => {
    // Set initial progress
    localStorageMock['walkthrough-progress-test-user-123'] = '2';

    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <OnboardingWalkthrough 
            isOpen={true} 
            onClose={mockOnClose} 
            onComplete={mockOnComplete} 
          />
        </QueryClientProvider>
      );
    });

    const restartButton = container.querySelector('[data-testid="button-walkthrough-restart"]') as HTMLButtonElement;
    
    act(() => {
      restartButton?.click();
    });

    // Verify storage was cleared
    expect(localStorageMock['walkthrough-progress-test-user-123']).toBeFalsy();
  });
});
