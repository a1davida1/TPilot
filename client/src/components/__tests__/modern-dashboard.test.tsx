import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModernDashboard, MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY } from '../modern-dashboard';

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, error: null }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('ModernDashboard onboarding gating', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const renderDashboard = (props: Partial<React.ComponentProps<typeof ModernDashboard>> = {}) => {
    return render(
      <ModernDashboard
        isRedditConnected={false}
        userTier="free"
        {...props}
      />
    );
  };

  it('prompts users to connect Reddit before showing other actions', () => {
    renderDashboard();

    expect(
      screen.getByText(/connect your reddit account to sync communities/i)
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /connect reddit to start/i })).toBeInTheDocument();
    expect(screen.getByText('Connect Reddit')).toBeInTheDocument();
    expect(screen.queryByText('Find Subreddits')).not.toBeInTheDocument();
    expect(screen.queryByText('Quick Post')).not.toBeInTheDocument();
  });

  it('unlocks subreddit discovery once Reddit is connected', () => {
    window.localStorage.setItem(
      MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY,
      JSON.stringify({ connectedReddit: true, selectedCommunities: false, createdFirstPost: false })
    );

    renderDashboard({ isRedditConnected: true });

    expect(screen.getByText(/pick your top subreddits next/i)).toBeInTheDocument();
    expect(screen.getByText('Find Subreddits')).toBeInTheDocument();
    expect(screen.queryByText('Quick Post')).not.toBeInTheDocument();
  });

  it('reveals quick post and growth tools after choosing communities', () => {
    window.localStorage.setItem(
      MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY,
      JSON.stringify({ connectedReddit: true, selectedCommunities: true, createdFirstPost: false })
    );

    renderDashboard({ isRedditConnected: true });

    expect(screen.getByText(/ship your first reddit post/i)).toBeInTheDocument();
    expect(screen.getByText('Quick Post')).toBeInTheDocument();
    expect(screen.getByText('Generate Caption')).toBeInTheDocument();
  });

  it('exposes advanced tools behind the expander after the first post', async () => {
    window.localStorage.setItem(
      MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY,
      JSON.stringify({ connectedReddit: true, selectedCommunities: true, createdFirstPost: true })
    );

    renderDashboard({ isRedditConnected: true, userTier: 'pro' });

    expect(screen.getByText(/you're ready for deeper automation/i)).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /show more tools/i });
    const user = userEvent.setup();
    await user.click(toggle);

    expect(screen.getByText('Tax Tracker')).toBeInTheDocument();
    expect(screen.getByText('Scan Takedowns')).toBeInTheDocument();
  });

  it('asks lower tiers to upgrade when advanced tools are locked', async () => {
    window.localStorage.setItem(
      MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY,
      JSON.stringify({ connectedReddit: true, selectedCommunities: true, createdFirstPost: true })
    );

    renderDashboard({ isRedditConnected: true, userTier: 'free' });

    const toggle = screen.getByRole('button', { name: /show more tools/i });
    const user = userEvent.setup();
    await user.click(toggle);

    expect(
      screen.getByText(/upgrade your plan to unlock analytics, takedown scanning, and finance workflows/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Tax Tracker')).not.toBeInTheDocument();
  });
});