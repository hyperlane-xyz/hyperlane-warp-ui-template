// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, test, vi } from 'vitest';

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
  return container;
}

beforeEach(() => {
  mockState.shouldThrow = false;
  vi.restoreAllMocks();
});

describe('SafeTextMorph', () => {
  test('renders children string correctly', () => {
    const container = renderToContainer(
      React.createElement(SafeTextMorph, null, 'Hello World'),
    );
    expect(container.textContent).toContain('Hello World');
  });

  test('renders fallback when TextMorph throws', () => {
    mockState.shouldThrow = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = renderToContainer(
      React.createElement(SafeTextMorph, null, 'Fallback Text'),
    );
    expect(container.textContent).toContain('Fallback Text');
  });

  test('handles empty string', () => {
    const container = renderToContainer(
      React.createElement(SafeTextMorph, null, ''),
    );
    expect(container.textContent).toBeDefined();
  });

  test('coerces number to string', () => {
    const container = renderToContainer(
      React.createElement(SafeTextMorph, null, 42),
    );
    expect(container.textContent).toContain('42');
  });
});
