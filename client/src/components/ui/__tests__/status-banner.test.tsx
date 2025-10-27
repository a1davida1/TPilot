import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StatusBanner } from '../status-banner';

describe('StatusBanner', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders banner with default props', () => {
    render(<StatusBanner />);
    
    expect(screen.getByText(/system update/i)).toBeInTheDocument();
  });

  it('renders custom message', () => {
    const customMessage = 'Custom test message';
    render(<StatusBanner message={customMessage} />);
    
    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('applies correct variant styles', () => {
    const { rerender } = render(<StatusBanner variant="info" />);
    let banner = screen.getByRole('alert');
    expect(banner).toHaveClass('bg-blue-50');

    rerender(<StatusBanner variant="warning" />);
    banner = screen.getByRole('alert');
    expect(banner).toHaveClass('bg-amber-50');

    rerender(<StatusBanner variant="error" />);
    banner = screen.getByRole('alert');
    expect(banner).toHaveClass('bg-red-50');

    rerender(<StatusBanner variant="success" />);
    banner = screen.getByRole('alert');
    expect(banner).toHaveClass('bg-emerald-50');
  });

  it('shows correct icon for each variant', () => {
    const { rerender } = render(<StatusBanner variant="info" />);
    expect(screen.getByTestId('info-icon')).toBeInTheDocument();

    rerender(<StatusBanner variant="warning" />);
    expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();

    rerender(<StatusBanner variant="error" />);
    expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();

    rerender(<StatusBanner variant="success" />);
    expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
  });

  it('handles dismiss when dismissible is true', async () => {
    render(<StatusBanner dismissible={true} />);
    
    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    expect(dismissButton).toBeInTheDocument();
    
    fireEvent.click(dismissButton);
    
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('does not show dismiss button when dismissible is false', () => {
    render(<StatusBanner dismissible={false} />);
    
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it('persists dismissal in localStorage', async () => {
    const storageKey = 'test-banner';
    render(<StatusBanner dismissible={true} storageKey={storageKey} />);
    
    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissButton);
    
    await waitFor(() => {
      expect(localStorage.getItem(`banner-dismissed-${storageKey}`)).toBe('true');
    });
  });

  it('does not render if previously dismissed', () => {
    const storageKey = 'test-banner';
    localStorage.setItem(`banner-dismissed-${storageKey}`, 'true');
    
    render(<StatusBanner dismissible={true} storageKey={storageKey} />);
    
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    const handleAction = vi.fn();
    render(
      <StatusBanner 
        action={{ label: 'Take Action', onClick: handleAction }}
      />
    );
    
    const actionButton = screen.getByRole('button', { name: /take action/i });
    expect(actionButton).toBeInTheDocument();
    
    fireEvent.click(actionButton);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('renders link when provided', () => {
    render(
      <StatusBanner 
        link={{ label: 'Learn More', href: 'https://example.com' }}
      />
    );
    
    const link = screen.getByRole('link', { name: /learn more/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('animates in on mount', () => {
    render(<StatusBanner />);
    
    const banner = screen.getByRole('alert');
    expect(banner).toHaveClass('animate-in');
  });

  it('animates out on dismiss', async () => {
    render(<StatusBanner dismissible={true} />);
    
    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissButton);
    
    const banner = screen.getByRole('alert');
    expect(banner).toHaveClass('animate-out');
  });

  it('respects custom className', () => {
    render(<StatusBanner className="custom-class" />);
    
    const banner = screen.getByRole('alert');
    expect(banner).toHaveClass('custom-class');
  });

  it('displays multiple actions/links correctly', () => {
    const handleAction1 = vi.fn();
    const handleAction2 = vi.fn();
    
    render(
      <StatusBanner 
        action={{ label: 'Action 1', onClick: handleAction1 }}
        link={{ label: 'Link 1', href: '/page1' }}
      />
    );
    
    expect(screen.getByRole('button', { name: /action 1/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /link 1/i })).toBeInTheDocument();
  });
});
