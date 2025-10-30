import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusBanner } from '../status-banner';

describe('StatusBanner', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders banner with default props', () => {
    render(<StatusBanner message="System update available" />);

    expect(screen.getByText(/system update/i)).toBeInTheDocument();
  });

  it('renders custom message', () => {
    const customMessage = 'Custom test message';
    render(<StatusBanner message={customMessage} />);
    
    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('applies correct variant styles', () => {
    const { rerender } = render(<StatusBanner message="Test" variant="info" />);
    let banner = screen.getByRole('alert');
    expect(banner).toHaveClass('bg-blue-50');

    rerender(<StatusBanner message="Test" variant="warning" />);
    banner = screen.getByRole('alert');
    expect(banner).toHaveClass('bg-amber-50');

    rerender(<StatusBanner message="Test" variant="error" />);
    banner = screen.getByRole('alert');
    expect(banner).toHaveClass('bg-red-50');

    rerender(<StatusBanner message="Test" variant="success" />);
    banner = screen.getByRole('alert');
    expect(banner).toHaveClass('bg-emerald-50');
  });

  it('shows correct icon for each variant', () => {
    const { rerender } = render(<StatusBanner message="Test" variant="info" />);
    expect(screen.getByTestId('info-icon')).toBeInTheDocument();

    rerender(<StatusBanner message="Test" variant="warning" />);
    expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();

    rerender(<StatusBanner message="Test" variant="error" />);
    expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();

    rerender(<StatusBanner message="Test" variant="success" />);
    expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
  });

  it('handles dismiss when closeable is true', async () => {
    const onClose = vi.fn();
    render(<StatusBanner message="Test" closeable={true} onClose={onClose} />);

    const dismissButton = screen.getByRole('button');
    expect(dismissButton).toBeInTheDocument();

    fireEvent.click(dismissButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not show dismiss button when closeable is false', () => {
    render(<StatusBanner message="Test" closeable={false} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('handles action button when provided', () => {
    const handleAction = vi.fn();
    render(
      <StatusBanner
        message="Test"
        onAction={handleAction}
        actionLabel="Take Action"
      />
    );

    const actionButton = screen.getByRole('button', { name: /take action/i });
    expect(actionButton).toBeInTheDocument();

    fireEvent.click(actionButton);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('renders with custom className', () => {
    render(<StatusBanner message="Test" className="custom-class" />);
    
    const banner = screen.getByRole('alert');
    expect(banner).toHaveClass('animate-in');
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<StatusBanner message="Test" closeable={true} onClose={onClose} />);

    const dismissButton = screen.getByRole('button');
    fireEvent.click(dismissButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('respects custom className', () => {
    render(<StatusBanner message="Test" className="custom-class" />);

    const banner = screen.getByRole('alert');
    expect(banner).toHaveClass('custom-class');
  });

  it('displays action button correctly', () => {
    const handleAction = vi.fn();

    render(
      <StatusBanner
        message="Test"
        onAction={handleAction}
        actionLabel="Action 1"
      />
    );

    const actionButton = screen.getByRole('button', { name: /action 1/i });
    expect(actionButton).toBeInTheDocument();
    fireEvent.click(actionButton);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });
});
