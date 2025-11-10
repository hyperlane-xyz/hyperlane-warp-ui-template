import { describe, expect, it, vi } from 'vitest';
import { Color } from '../Color';

// Mock the tailwind config
vi.mock('../../../tailwind.config', () => ({
  theme: {
    extend: {
      colors: {
        black: '#000000',
        white: '#ffffff',
        gray: '#6b7280',
        primary: '#3b82f6',
        accent: '#10b981',
        red: '#ef4444',
      },
    },
  },
}));

describe('Color', () => {
  it('should export all expected color properties', () => {
    expect(Color).toHaveProperty('black');
    expect(Color).toHaveProperty('white');
    expect(Color).toHaveProperty('gray');
    expect(Color).toHaveProperty('primary');
    expect(Color).toHaveProperty('accent');
    expect(Color).toHaveProperty('red'); // Example additional color
  });

  it('should have correct color values from theme', () => {
    expect(Color.black).toBe('#000000');
    expect(Color.white).toBe('#ffffff');
    expect(Color.gray).toBe('#6b7280');
    expect(Color.primary).toBe('#3b82f6');
    expect(Color.accent).toBe('#10b981');
    expect(Color.red).toBe('#ef4444');
  });

  it('should contain exactly 6 color properties', () => {
    expect(Object.keys(Color)).toHaveLength(6); // Adjust this number based on actual colors defined
  });
});
