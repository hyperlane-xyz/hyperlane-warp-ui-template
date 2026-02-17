// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { SafeTextMorph } from './SafeTextMorph';

const mockState = vi.hoisted(() => ({ shouldThrow: false }));

vi.mock('torph/react', () => ({
  TextMorph: vi.fn(({ children }: { children: string }) => {
    if (mockState.shouldThrow) throw new Error('TextMorph failed');
    return children;
  }),
}));

function renderToContainer(element: React.ReactElement): HTMLDivElement {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  cleanupRoots.push(() => {
    act(() => {
      root.unmount();
    });
  });
  return container;
}

const cleanupRoots: Array<() => void> = [];

beforeEach(() => {
  mockState.shouldThrow = false;
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanupRoots.splice(0).forEach((cleanup) => cleanup());
});

describe('SafeTextMorph', () => {
  test('renders children string correctly', () => {
    const container = renderToContainer(React.createElement(SafeTextMorph, null, 'Hello World'));
    expect(container.textContent).toContain('Hello World');
  });

  test('renders fallback when TextMorph throws', () => {
    mockState.shouldThrow = true;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = renderToContainer(React.createElement(SafeTextMorph, null, 'Fallback Text'));
    expect(container.textContent).toContain('Fallback Text');
    expect(consoleSpy).toHaveBeenCalledWith('TextMorph error:', expect.any(Error));
  });

  test('preserves fallback element props', () => {
    mockState.shouldThrow = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = renderToContainer(
      <SafeTextMorph as="p" className="fallback-text" style={{ color: 'red' }}>
        Fallback Text
      </SafeTextMorph>,
    );

    const fallback = container.querySelector('p.fallback-text');
    expect(fallback).not.toBeNull();
    expect((fallback as HTMLElement).style.color).toBe('red');
  });

  test('handles empty string', () => {
    const container = renderToContainer(React.createElement(SafeTextMorph, null, ''));
    expect(container.textContent).toBe('');
  });

  test('coerces number to string', () => {
    const container = renderToContainer(React.createElement(SafeTextMorph, null, 42));
    expect(container.textContent).toContain('42');
  });
});
