import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../ErrorBoundary';

// Mock the ErrorBoundary from @hyperlane-xyz/widgets
vi.mock('@hyperlane-xyz/widgets', () => ({
  ErrorBoundary: ({ children, supportLink }: any) => (
    <div data-testid="error-boundary">
      {children}
      {supportLink}
    </div>
  ),
}));

vi.mock('../../consts/links', () => ({
  links: {
    discord: 'https://discord.gg/VK9ZUy3aTV',
  },
}));

describe('ErrorBoundary', () => {
  it('should render children', () => {
    render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should pass support link to inner ErrorBoundary', () => {
    render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
  });

  it('should render support link with correct text', () => {
    render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText(/For support, join the/)).toBeInTheDocument();
    expect(screen.getByText('Hyperlane Discord')).toBeInTheDocument();
  });

  it('should render support link with correct href', () => {
    render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://discord.gg/VK9ZUy3aTV');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
