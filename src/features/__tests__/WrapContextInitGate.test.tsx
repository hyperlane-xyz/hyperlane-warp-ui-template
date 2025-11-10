import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WarpContextInitGate } from '../WarpContextInitGate';

// Mock the custom hooks and SpinnerIcon
vi.mock('@hyperlane-xyz/widgets', () => ({
  SpinnerIcon: ({ width, height, color, className }: any) => (
    <div
      data-testid="spinner-icon"
      data-width={width}
      data-height={height}
      data-color={color}
      className={className}
    >
      Loading...
    </div>
  ),
  useTimeout: vi.fn(),
}));

vi.mock('../chains/hooks', () => ({
  useReadyMultiProvider: vi.fn(),
}));

import { useTimeout } from '@hyperlane-xyz/widgets';
import { useReadyMultiProvider } from '../chains/hooks';

describe('WarpContextInitGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when warp context is ready', () => {
    vi.mocked(useReadyMultiProvider).mockReturnValue({} as any);
    vi.mocked(useTimeout).mockImplementation(() => {
      return () => {};
    });

    render(
      <WarpContextInitGate>
        <div data-testid="child-content">Child Component</div>
      </WarpContextInitGate>,
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Child Component')).toBeInTheDocument();
  });

  it('renders spinner when warp context is not ready', () => {
    vi.mocked(useReadyMultiProvider).mockReturnValue(undefined);
    vi.mocked(useTimeout).mockImplementation(() => {
      return () => {};
    });

    render(
      <WarpContextInitGate>
        <div data-testid="child-content">Child Component</div>
      </WarpContextInitGate>,
    );

    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('spinner-icon')).toBeInTheDocument();
  });

  it('renders spinner with correct props and throws on timeout', () => {
    vi.mocked(useReadyMultiProvider).mockReturnValue(undefined);

    // initial render with no-op timeout
    vi.mocked(useTimeout).mockImplementation(() => {
      return () => {};
    });

    render(
      <WarpContextInitGate>
        <div>Child</div>
      </WarpContextInitGate>,
    );

    const spinner = screen.getByTestId('spinner-icon');
    expect(spinner).toHaveAttribute('data-width', '80');
    expect(spinner).toHaveAttribute('data-height', '80');

    // Simulate timeout calling the callback immediately which should trigger the error path
    vi.mocked(useTimeout).mockImplementation((callback: () => void) => {
      // call the callback synchronously to simulate timeout
      callback();
      return () => {};
    });

    expect(() =>
      render(
        <WarpContextInitGate>
          <div data-testid="child-content">Child Component</div>
        </WarpContextInitGate>,
      ),
    ).toThrow(
      'Failed to initialize warp context. Please check your registry URL and connection status.',
    );
  });

  it('calls useTimeout and allows becoming ready before timeout', () => {
    // Start not ready and capture timeout callback
    vi.mocked(useReadyMultiProvider).mockReturnValue(undefined);

    const { rerender } = render(
      <WarpContextInitGate>
        <div data-testid="child-content">Child Component</div>
      </WarpContextInitGate>,
    );

    // Initially shows spinner
    expect(screen.getByTestId('spinner-icon')).toBeInTheDocument();

    // Before firing timeout, make context ready and rerender
    vi.mocked(useReadyMultiProvider).mockReturnValue({} as any);
    rerender(
      <WarpContextInitGate>
        <div data-testid="child-content">Child Component</div>
      </WarpContextInitGate>,
    );

    // Child should be visible and spinner gone
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.queryByTestId('spinner-icon')).not.toBeInTheDocument();
  });

  it('renders loading container with correct styles', () => {
    vi.mocked(useReadyMultiProvider).mockReturnValue(undefined);
    vi.mocked(useTimeout).mockImplementation(() => {
      return () => {};
    });

    const { container } = render(
      <WarpContextInitGate>
        <div>Child</div>
      </WarpContextInitGate>,
    );

    const loadingDiv = container.querySelector(
      '.flex.h-screen.items-center.justify-center.bg-primary-500',
    );
    expect(loadingDiv).toBeInTheDocument();
  });
});
