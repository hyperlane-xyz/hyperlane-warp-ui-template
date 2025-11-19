import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CustomSwapIcon } from '../CustomSwapIcon';

describe('CustomSwapIcon', () => {
  it('should render SVG element', () => {
    const { container } = render(<CustomSwapIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should render with default width and height', () => {
    const { container } = render(<CustomSwapIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
  });

  it('should render with custom width', () => {
    const { container } = render(<CustomSwapIcon width={40} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '40');
  });

  it('should render with custom height', () => {
    const { container } = render(<CustomSwapIcon height={40} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('height', '40');
  });

  it('should apply custom className', () => {
    const { container } = render(<CustomSwapIcon className="custom-icon" />);
    const svg = container.querySelector('svg.custom-icon');
    expect(svg).toBeInTheDocument();
  });

  it('should have correct viewBox', () => {
    const { container } = render(<CustomSwapIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 670.41 670.41');
  });

  it('should contain circle and path elements', () => {
    const { container } = render(<CustomSwapIcon />);
    const circle = container.querySelector('circle');
    const paths = container.querySelectorAll('path');
    
    expect(circle).toBeInTheDocument();
    expect(paths).toHaveLength(2);
  });
});

