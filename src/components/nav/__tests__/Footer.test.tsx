import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Footer } from '../Footer';

// Mock dependencies
vi.mock('next/link', () => ({
  default: ({ children, href, target }: any) => (
    <a href={href} target={target}>
      {children}
    </a>
  ),
}));

vi.mock('../../consts/links', () => ({
  links: {
    pruv: 'https://pruv.finance',
    d3labs: 'https://d3labs.io',
  },
}));

describe('Footer', () => {
  it('should render footer element', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer');
    expect(footer).toBeInTheDocument();
  });

  it('should render footer logo text', () => {
    render(<Footer />);
    expect(screen.getByText('Unlock the Future of Investment')).toBeInTheDocument();
    expect(screen.getByText('with Pruv')).toBeInTheDocument();
  });

  it('should render Pruv Finance link', () => {
    render(<Footer />);
    const link = screen.getByText('part of Pruv Finance');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://pruv.finance');
  });

  it('should render D3 Labs link', () => {
    render(<Footer />);
    const link = screen.getByText('by D3 Labs');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://d3labs.io');
  });

  it('should open external links in new tab', () => {
    render(<Footer />);
    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  it('should have correct number of footer links', () => {
    render(<Footer />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
  });

  it('should render navigation element', () => {
    const { container } = render(<Footer />);
    const nav = container.querySelector('nav');
    expect(nav).toBeInTheDocument();
  });

  it('should have gradient background class', () => {
    const { container } = render(<Footer />);
    const gradientDiv = container.querySelector('.bg-gradient-to-b');
    expect(gradientDiv).toBeInTheDocument();
  });
});

