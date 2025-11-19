import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from '../Card';

describe('Card', () => {
  it('should render children', () => {
    render(
      <Card>
        <div>Test Content</div>
      </Card>,
    );
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should apply default className', () => {
    const { container } = render(
      <Card>
        <div>Content</div>
      </Card>,
    );
    const card = container.querySelector('.rounded-2xl');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('bg-white');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Card className="custom-card">
        <div>Content</div>
      </Card>,
    );
    const card = container.querySelector('.custom-card');
    expect(card).toBeInTheDocument();
  });

  it('should have overflow-auto class', () => {
    const { container } = render(
      <Card>
        <div>Content</div>
      </Card>,
    );
    const card = container.querySelector('.overflow-auto');
    expect(card).toBeInTheDocument();
  });

  it('should have responsive padding classes', () => {
    const { container } = render(
      <Card>
        <div>Content</div>
      </Card>,
    );
    const card = container.firstChild;
    expect(card).toHaveClass('p-1.5', 'xs:p-2', 'sm:p-3', 'md:p-4');
  });

  it('should render multiple children', () => {
    render(
      <Card>
        <div>First Child</div>
        <div>Second Child</div>
      </Card>,
    );
    expect(screen.getByText('First Child')).toBeInTheDocument();
    expect(screen.getByText('Second Child')).toBeInTheDocument();
  });

  it('should be relatively positioned', () => {
    const { container } = render(
      <Card>
        <div>Content</div>
      </Card>,
    );
    const card = container.querySelector('.relative');
    expect(card).toBeInTheDocument();
  });
});
