import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from "react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GettingStarted } from '../getting-started';

// Create a new QueryClient for each test
let queryClient: QueryClient;

const mockOnboardingState = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-onboarding-state', () => ({
  useOnboardingState: () => mockOnboardingState()
}));

// Mock dependencies
vi.mock('@/components/thottopilot-logo', () => ({
  ThottoPilotLogo: ({ size }: { size?: string }) => (
    <div data-testid="thottopilot-logo" data-size={size}>Logo</div>
  )
}));

describe('GettingStarted', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    
    // Mock the onboarding state hook
    mockOnboardingState.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      updateState: vi.fn(),
      isUpdating: false,
    });
  });

  // Helper function to render component with QueryClientProvider
  const renderWithProvider = (component: React.ReactElement) => {
    return (
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  describe('Accordion Functionality', () => {
    it('should expand step details when accordion trigger is clicked', async () => {
      await act(async () => {
        root.render(renderWithProvider(<GettingStarted userTier="free" />));
      });
      
      const profileExpandTrigger = container.querySelector('[data-testid="expand-profile"]');
      expect(profileExpandTrigger).toBeTruthy();
      
      // Initially, details should not be visible
      let profileDetails = container.querySelector('[data-testid="details-profile"]');
      expect(profileDetails).toBeFalsy();
      
      // Click to expand
      await act(async () => {
        (profileExpandTrigger as HTMLElement).click();
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      // Details should now be visible
      profileDetails = container.querySelector('[data-testid="details-profile"]');
      expect(profileDetails).toBeTruthy();
      expect(profileDetails?.textContent).toContain('Add your username, bio');
    });

    it('should collapse step details when accordion trigger is clicked again', async () => {
      await act(async () => {
        root.render(renderWithProvider(<GettingStarted userTier="free" />));
      });
      
      const profileExpandTrigger = container.querySelector('[data-testid="expand-profile"]');
      
      // Expand first
      await act(async () => {
        (profileExpandTrigger as HTMLElement).click();
        await new Promise(resolve => setTimeout(resolve, 300));
      });
      
      let profileDetails = container.querySelector('[data-testid="details-profile"]');
      expect(profileDetails).toBeTruthy();
      
      // Click to collapse
      await act(async () => {
        (profileExpandTrigger as HTMLElement).click();
        await new Promise(resolve => setTimeout(resolve, 300));
      });
      
      // Note: AccordionContent might still be in DOM but hidden via CSS
      // Check if the content is not visible instead of checking if it exists
      const accordion = container.querySelector('[data-testid="getting-started-accordion"]');
      // If collapsed, value should be empty or different from 'profile'
      expect(accordion?.getAttribute('data-value')).not.toBe('profile');
    });

    it('should only allow one step to be expanded at a time', async () => {
      await act(async () => {
        root.render(renderWithProvider(<GettingStarted userTier="free" />));
      });
      
      const profileTrigger = container.querySelector('[data-testid="expand-profile"]');
      const contentTrigger = container.querySelector('[data-testid="expand-first-content"]');
      
      // Expand profile step
      await act(async () => {
        (profileTrigger as HTMLElement).click();
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      let profileDetails = container.querySelector('[data-testid="details-profile"]');
      expect(profileDetails).toBeTruthy();
      
      // Expand content step (should close profile)
      await act(async () => {
        (contentTrigger as HTMLElement).click();
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      profileDetails = container.querySelector('[data-testid="details-profile"]');
      const contentDetails = container.querySelector('[data-testid="details-first-content"]');
      
      expect(profileDetails).toBeFalsy(); // Profile should be collapsed
      expect(contentDetails).toBeTruthy(); // Content should be expanded
    });
  });

  describe('Step Completion', () => {
    it('should mark step as complete when checkbox is clicked', async () => {
      await act(async () => {
        root.render(renderWithProvider(<GettingStarted userTier="free" />));
      });
      
      const profileCheckbox = container.querySelector('[data-testid="checkbox-profile"]');
      const profileStep = container.querySelector('[data-testid="step-profile"]');
      
      // Initially should not be completed
      expect(profileStep?.className).not.toContain('bg-green-50');
      
      // Click checkbox to mark complete
      await act(async () => {
        (profileCheckbox as HTMLElement).click();
      });
      
      // Should now be marked as completed
      const updatedStep = container.querySelector('[data-testid="step-profile"]');
      expect(updatedStep?.className).toContain('bg-green-50');
      expect(updatedStep?.className).toContain('border-green-200');
    });

    it('should unmark step when checkbox is clicked again', async () => {
      await act(async () => {
        root.render(renderWithProvider(<GettingStarted userTier="free" />));
      });
      
      const profileCheckbox = container.querySelector('[data-testid="checkbox-profile"]');
      
      // Mark as complete
      await act(async () => {
        (profileCheckbox as HTMLElement).click();
      });
      
      let profileStep = container.querySelector('[data-testid="step-profile"]');
      expect(profileStep?.className).toContain('bg-green-50');
      
      // Unmark
      await act(async () => {
        (profileCheckbox as HTMLElement).click();
      });
      
      profileStep = container.querySelector('[data-testid="step-profile"]');
      expect(profileStep?.className).not.toContain('bg-green-50');
      expect(profileStep?.className).toContain('bg-white');
    });

    it('should update progress percentage when steps are completed', async () => {
      await act(async () => {
        root.render(renderWithProvider(<GettingStarted userTier="free" />));
      });
      
      // Get total steps count (should be 9 based on the component)
      const progressText = container.querySelector('.text-sm.font-normal.text-gray-600');
      expect(progressText?.textContent).toContain('0 of 9 completed');
      
      // Complete one step
      const profileCheckbox = container.querySelector('[data-testid="checkbox-profile"]');
      await act(async () => {
        (profileCheckbox as HTMLElement).click();
      });
      
      const updatedProgressText = container.querySelector('.text-sm.font-normal.text-gray-600');
      expect(updatedProgressText?.textContent).toContain('1 of 9 completed');
    });
  });

  describe('Navigation Callbacks', () => {
    it('should call onSectionSelect when action button is clicked', async () => {
      const onSectionSelect = vi.fn();
      
      await act(async () => {
        root.render(renderWithProvider(<GettingStarted userTier="free" onSectionSelect={onSectionSelect} />));
      });
      
      const profileActionButton = container.querySelector('[data-testid="action-profile"]');
      
      await act(async () => {
        (profileActionButton as HTMLElement).click();
      });
      
      expect(onSectionSelect).toHaveBeenCalledWith('profile');
    });

    it('should call onSetupLater when Setup Later button is clicked', async () => {
      const onSetupLater = vi.fn();
      
      await act(async () => {
        root.render(renderWithProvider(<GettingStarted userTier="free" onSetupLater={onSetupLater} />));
      });
      
      // Find the "Setup Later" button
      const buttons = Array.from(container.querySelectorAll('button'));
      const setupLaterButton = buttons.find(btn => btn.textContent?.includes('Setup Later'));
      
      expect(setupLaterButton).toBeTruthy();
      
      await act(async () => {
        setupLaterButton?.click();
      });
      
      expect(onSetupLater).toHaveBeenCalled();
    });
  });

  describe('User Tier Display', () => {
    it('should display all steps as enabled for guest users (no pro-only restrictions)', async () => {
      await act(async () => {
        root.render(renderWithProvider(<GettingStarted userTier="guest" />));
      });
      
      // All checkboxes should be enabled since no steps are marked pro-only
      const allCheckboxes = Array.from(container.querySelectorAll('[data-testid^="checkbox-"]'));
      allCheckboxes.forEach(checkbox => {
        expect(checkbox).toHaveProperty('disabled', false);
      });
    });

    it('should display all steps for pro users', async () => {
      await act(async () => {
        root.render(renderWithProvider(<GettingStarted userTier="pro" />));
      });
      
      // All checkboxes should be enabled
      const allCheckboxes = Array.from(container.querySelectorAll('[data-testid^="checkbox-"]'));
      allCheckboxes.forEach(checkbox => {
        expect(checkbox).toHaveProperty('disabled', false);
      });
    });
  });

  describe('Visual States', () => {
    it('should display correct tier badge for different user tiers', async () => {
      const { unmount } = await act(async () => {
        root.render(renderWithProvider(<GettingStarted userTier="guest" />));
        return { unmount: () => {} };
      });
      
      let tierBadge = Array.from(container.querySelectorAll('.bg-purple-100')).find(
        el => el.textContent?.includes('Guest Mode')
      );
      expect(tierBadge).toBeTruthy();
      
      await act(async () => {
        root.unmount();
      });
      
      // Re-render with different tier
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
      
      await act(async () => {
        root.render(renderWithProvider(<GettingStarted userTier="pro" />));
      });
      
      tierBadge = Array.from(container.querySelectorAll('.bg-purple-100')).find(
        el => el.textContent?.includes('Pro Plan')
      );
      expect(tierBadge).toBeTruthy();
    });

    it('should show pro upgrade CTA for free users', async () => {
      await act(async () => {
        root.render(renderWithProvider(<GettingStarted userTier="free" />));
      });
      
      const upgradeButton = Array.from(container.querySelectorAll('button')).find(
        btn => btn.textContent?.includes('Upgrade Now')
      );
      expect(upgradeButton).toBeTruthy();
    });

    it('should not show pro upgrade CTA for pro users', async () => {
      await act(async () => {
        root.render(renderWithProvider(<GettingStarted userTier="pro" />));
      });
      
      const upgradeButton = Array.from(container.querySelectorAll('button')).find(
        btn => btn.textContent?.includes('Upgrade Now')
      );
      expect(upgradeButton).toBeFalsy();
    });
  });
});
