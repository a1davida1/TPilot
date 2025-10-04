import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { LandingPage } from '../landing-page';
import type { Metrics } from '@/hooks/use-metrics';

// Mock metrics data
const mockMetricsData: Metrics = {
  creators: 5420,
  posts: 128000,
  engagement: 87,
  activeSubscriptions: 1240,
  generatedAt: new Date().toISOString()
};

const mockUseMetrics = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-metrics', () => ({
  useMetrics: mockUseMetrics
}));

// Mock wouter
vi.mock('wouter', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useLocation: () => ['/landing', vi.fn()]
}));

// Mock theme toggle
vi.mock('@/components/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>
}));

// Mock auth modal
vi.mock('@/components/auth-modal', () => ({
  AuthModal: ({ isOpen, mode }: { isOpen: boolean; mode: string }) => (
    isOpen ? <div data-testid="auth-modal">Auth Modal ({mode})</div> : null
  )
}));

describe('LandingPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    
    // Mock window.scrollY
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 0
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  describe('Parallax Effects', () => {
    it('should apply parallax transform to hero background when scrolled', async () => {
      mockUseMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        isError: false
      });

      await act(async () => {
        root.render(<LandingPage />);
      });
      
      const heroBackground = container.querySelector('[data-testid="hero-parallax-background"]');
      expect(heroBackground).toBeTruthy();
      
      // Initial state - no scroll
      const initialTransform = (heroBackground as HTMLElement).style.transform;
      expect(initialTransform).toBe('translateY(0px)');
      
      // Simulate scroll
      Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 100 });
      
      await act(async () => {
        window.dispatchEvent(new Event('scroll'));
        // Allow state update
        await new Promise(resolve => setTimeout(resolve, 0));
        root.render(<LandingPage />);
      });
      
      const updatedBackground = container.querySelector('[data-testid="hero-parallax-background"]');
      const updatedTransform = (updatedBackground as HTMLElement).style.transform;
      // Parallax multiplier is 0.5, so 100 * 0.5 = 50
      expect(updatedTransform).toBe('translateY(50px)');
    });

    it('should apply floating effect to metric badges based on scroll', async () => {
      mockUseMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        isError: false
      });

      await act(async () => {
        root.render(<LandingPage />);
      });
      
      const floatingBadges = container.querySelector('[data-testid="floating-badges"]');
      expect(floatingBadges).toBeTruthy();
      
      // Initial state
      const initialTransform = (floatingBadges as HTMLElement).style.transform;
      const initialOffset = Math.sin(0 * 0.01) * 10;
      expect(initialTransform).toBe(`translateY(${initialOffset}px)`);
      
      // Simulate scroll
      Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 200 });
      
      await act(async () => {
        window.dispatchEvent(new Event('scroll'));
        await new Promise(resolve => setTimeout(resolve, 0));
        root.render(<LandingPage />);
      });
      
      const updatedBadges = container.querySelector('[data-testid="floating-badges"]');
      const expectedOffset = Math.sin(200 * 0.01) * 10;
      const updatedTransform = (updatedBadges as HTMLElement).style.transform;
      expect(updatedTransform).toBe(`translateY(${expectedOffset}px)`);
    });
  });

  describe('Metrics Loading States', () => {
    it('should display skeleton loaders when metrics are loading', async () => {
      mockUseMetrics.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false
      });

      await act(async () => {
        root.render(<LandingPage />);
      });
      
      const creatorsMetric = container.querySelector('[data-testid="metric-creators"]');
      const postsMetric = container.querySelector('[data-testid="metric-posts"]');
      const engagementMetric = container.querySelector('[data-testid="metric-engagement"]');
      
      // Check that skeleton spans are rendered
      expect(creatorsMetric?.querySelector('.animate-pulse')).toBeTruthy();
      expect(postsMetric?.querySelector('.animate-pulse')).toBeTruthy();
      expect(engagementMetric?.querySelector('.animate-pulse')).toBeTruthy();
    });

    it('should display metrics data when loaded successfully', async () => {
      mockUseMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        isError: false
      });

      await act(async () => {
        root.render(<LandingPage />);
      });
      
      const creatorsMetric = container.querySelector('[data-testid="metric-creators"]');
      const postsMetric = container.querySelector('[data-testid="metric-posts"]');
      const engagementMetric = container.querySelector('[data-testid="metric-engagement"]');
      
      // Check formatted numbers are displayed
      expect(creatorsMetric?.textContent).toContain('5,420');
      expect(postsMetric?.textContent).toContain('128,000');
      expect(engagementMetric?.textContent).toContain('87%');
    });

    it('should display fallback when metrics fail to load', async () => {
      mockUseMetrics.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true
      });

      await act(async () => {
        root.render(<LandingPage />);
      });
      
      const creatorsMetric = container.querySelector('[data-testid="metric-creators"]');
      const postsMetric = container.querySelector('[data-testid="metric-posts"]');
      const engagementMetric = container.querySelector('[data-testid="metric-engagement"]');
      
      expect(creatorsMetric?.textContent).toContain('—');
      expect(postsMetric?.textContent).toContain('—');
      expect(engagementMetric?.textContent).toContain('—');
    });

    it('should display fallback when metrics data is null', async () => {
      mockUseMetrics.mockReturnValue({
        data: null,
        isLoading: false,
        isError: false
      });

      await act(async () => {
        root.render(<LandingPage />);
      });
      
      const creatorsMetric = container.querySelector('[data-testid="metric-creators"]');
      const postsMetric = container.querySelector('[data-testid="metric-posts"]');
      const engagementMetric = container.querySelector('[data-testid="metric-engagement"]');
      
      expect(creatorsMetric?.textContent).toContain('—');
      expect(postsMetric?.textContent).toContain('—');
      expect(engagementMetric?.textContent).toContain('—');
    });
  });

  describe('Scroll Event Handling', () => {
    it('should clean up scroll event listener on unmount', async () => {
      mockUseMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        isError: false
      });

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      await act(async () => {
        root.render(<LandingPage />);
      });
      
      await act(async () => {
        root.unmount();
      });
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
      
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('User Interactions', () => {
    it('should render header CTA buttons', async () => {
      mockUseMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        isError: false
      });

      await act(async () => {
        root.render(<LandingPage />);
      });
      
      expect(container.querySelector('[data-testid="button-header-signin"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="button-header-get-started"]')).toBeTruthy();
    });

    it('should render hero CTA buttons', async () => {
      mockUseMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        isError: false
      });

      await act(async () => {
        root.render(<LandingPage />);
      });
      
      expect(container.querySelector('[data-testid="button-hero-get-started"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="button-hero-signin"]')).toBeTruthy();
    });
  });
});
