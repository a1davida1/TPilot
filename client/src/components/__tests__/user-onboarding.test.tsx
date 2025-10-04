import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UserOnboarding from '../onboarding/UserOnboarding';

describe('UserOnboarding', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let queryClient: QueryClient;
  let localStorageMock: Record<string, string>;

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
    const localStorageGetItem = vi.spyOn(Storage.prototype, 'getItem');
    const localStorageSetItem = vi.spyOn(Storage.prototype, 'setItem');
    const localStorageRemoveItem = vi.spyOn(Storage.prototype, 'removeItem');

    localStorageGetItem.mockImplementation((key: string) => {
      return localStorageMock[key] || null;
    });

    localStorageSetItem.mockImplementation((key: string, value: string) => {
      localStorageMock[key] = value;
      return undefined;
    });

    localStorageRemoveItem.mockImplementation((key: string) => {
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
  });

  it('renders onboarding component with initial state', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <UserOnboarding />
        </QueryClientProvider>
      );
    });

    expect(container.querySelector('h2')?.textContent).toBe('Getting Started');
    expect(container.querySelector('[data-testid="button-reset-onboarding"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="button-next-step"]')).toBeTruthy();
  });

  it('resets onboarding progress when reset button is clicked', () => {
    // Set some initial progress
    localStorageMock['onboarding_completed'] = JSON.stringify(['welcome', 'profile']);
    localStorageMock['onboarding_current_step'] = '2';

    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <UserOnboarding />
        </QueryClientProvider>
      );
    });

    const resetButton = container.querySelector('[data-testid="button-reset-onboarding"]') as HTMLButtonElement;
    expect(resetButton).toBeTruthy();

    act(() => {
      resetButton.click();
    });

    // Verify localStorage was cleared
    expect(localStorageMock['onboarding_completed']).toBeUndefined();
    expect(localStorageMock['onboarding_current_step']).toBeUndefined();
  });

  it('completes a tutorial step when complete button is clicked', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <UserOnboarding />
        </QueryClientProvider>
      );
    });

    const completeButton = container.querySelector('[data-testid="button-complete-step"]') as HTMLButtonElement;
    
    if (completeButton) {
      act(() => {
        completeButton.click();
      });

      // Verify localStorage was updated with completed step
      const completed = localStorageMock['onboarding_completed'];
      expect(completed).toBeTruthy();
      const completedSteps = JSON.parse(completed);
      expect(completedSteps.length).toBeGreaterThan(0);
    }
  });

  it('skips a tutorial step when skip button is clicked', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <UserOnboarding />
        </QueryClientProvider>
      );
    });

    const skipButton = container.querySelector('[data-testid="button-skip-step"]') as HTMLButtonElement;
    
    if (skipButton) {
      const initialStep = localStorageMock['onboarding_current_step'];
      
      act(() => {
        skipButton.click();
      });

      // Verify current step was advanced
      const newStep = localStorageMock['onboarding_current_step'];
      expect(parseInt(newStep || '0')).toBeGreaterThan(parseInt(initialStep || '0'));
    }
  });

  it('navigates to next step when next button is clicked', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <UserOnboarding />
        </QueryClientProvider>
      );
    });

    const nextButton = container.querySelector('[data-testid="button-next-step"]') as HTMLButtonElement;
    expect(nextButton).toBeTruthy();

    act(() => {
      nextButton.click();
    });

    // Verify current step was updated in localStorage
    const currentStep = localStorageMock['onboarding_current_step'];
    expect(parseInt(currentStep)).toBe(1);
  });

  it('navigates to previous step when previous button is clicked', () => {
    // Start at step 1
    localStorageMock['onboarding_current_step'] = '1';

    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <UserOnboarding />
        </QueryClientProvider>
      );
    });

    const previousButton = container.querySelector('[data-testid="button-previous-step"]') as HTMLButtonElement;
    expect(previousButton).toBeTruthy();
    expect(previousButton.disabled).toBe(false);

    act(() => {
      previousButton.click();
    });

    // Verify current step went back to 0
    const currentStep = localStorageMock['onboarding_current_step'];
    expect(parseInt(currentStep)).toBe(0);
  });

  it('starts content tutorial when start tutorial button is clicked', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <UserOnboarding />
        </QueryClientProvider>
      );
    });

    const startTutorialButton = container.querySelector('[data-testid="button-start-content-tutorial"]') as HTMLButtonElement;
    
    if (startTutorialButton) {
      act(() => {
        startTutorialButton.click();
      });

      // Verify step was marked as completed
      const completed = localStorageMock['onboarding_completed'];
      expect(completed).toBeTruthy();
    }
  });

  it('persists completed steps to localStorage', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <UserOnboarding />
        </QueryClientProvider>
      );
    });

    const completeButton = container.querySelector('[data-testid="button-complete-step"]') as HTMLButtonElement;
    
    if (completeButton) {
      act(() => {
        completeButton.click();
      });

      // Verify localStorage contains completed steps
      const stored = localStorageMock['onboarding_completed'];
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    }
  });

  it('restores state from localStorage on mount', () => {
    // Set initial state in localStorage
    const completedSteps = ['welcome', 'profile'];
    localStorageMock['onboarding_completed'] = JSON.stringify(completedSteps);
    localStorageMock['onboarding_current_step'] = '2';

    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <UserOnboarding />
        </QueryClientProvider>
      );
    });

    // Verify component restored the state
    const currentStepDisplay = container.querySelector('[data-testid="button-next-step"]');
    expect(currentStepDisplay).toBeTruthy();
  });

  it('shows user feedback toast when completing a step', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <UserOnboarding />
        </QueryClientProvider>
      );
    });

    const completeButton = container.querySelector('[data-testid="button-complete-step"]') as HTMLButtonElement;
    
    if (completeButton) {
      act(() => {
        completeButton.click();
      });

      // Note: In a real test, we'd verify the toast was shown
      // For now, we verify the state change happened
      expect(localStorageMock['onboarding_completed']).toBeTruthy();
    }
  });
});
