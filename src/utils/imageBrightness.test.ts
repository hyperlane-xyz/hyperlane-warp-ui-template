import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  markDarkLogoMissing,
  processDarkLogoImage,
  processDarkLogosInContainer,
} from './imageBrightness';

class FakeImage {
  dataset: Record<string, string> = {};
  private attrs = new Map<string, string>();
  private listeners = new Map<string, Array<() => void>>();

  constructor(src: string) {
    this.src = src;
  }

  get src() {
    return this.attrs.get('src') || '';
  }

  set src(value: string) {
    this.attrs.set('src', value);
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) || null;
  }

  addEventListener(name: string, callback: () => void) {
    const existing = this.listeners.get(name) || [];
    this.listeners.set(name, [...existing, callback]);
  }

  dispatch(name: string) {
    const existing = this.listeners.get(name) || [];
    existing.forEach((callback) => callback());
  }
}

const originalDocument = (globalThis as { document?: unknown }).document;
const originalWindow = (globalThis as { window?: unknown }).window;

function setThemeMode(themeMode: 'light' | 'dark') {
  (globalThis as { document: unknown }).document = {
    documentElement: { dataset: { themeMode } },
    getElementById: (id: string) =>
      id === 'app-content'
        ? {
            getAttribute: (name: string) => (name === 'data-theme-mode' ? themeMode : null),
          }
        : null,
  };

  (globalThis as { window: unknown }).window = {
    location: { href: 'https://app.example/' },
    matchMedia: () => ({ matches: themeMode === 'dark' }),
  };
}

function restoreDomGlobals() {
  if (originalDocument === undefined) {
    delete (globalThis as { document?: unknown }).document;
  } else {
    (globalThis as { document: unknown }).document = originalDocument;
  }

  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window: unknown }).window = originalWindow;
  }
}

describe('imageBrightness', () => {
  beforeEach(() => {
    setThemeMode('dark');
  });

  afterEach(() => {
    restoreDomGlobals();
  });

  test('uses dark variant in dark mode', () => {
    const img = new FakeImage('https://cdn.example/icons/logo-a.svg');
    processDarkLogoImage(img as unknown as HTMLImageElement);
    expect(img.src).toBe('https://cdn.example/icons/darkmode-logo-a.svg');
  });

  test('falls back to original when dark variant fails to load', () => {
    const img = new FakeImage('https://cdn.example/icons/logo-b.svg');
    processDarkLogoImage(img as unknown as HTMLImageElement);
    expect(img.src).toBe('https://cdn.example/icons/darkmode-logo-b.svg');

    img.dispatch('error');
    expect(img.src).toBe('https://cdn.example/icons/logo-b.svg');

    processDarkLogoImage(img as unknown as HTMLImageElement);
    expect(img.src).toBe('https://cdn.example/icons/logo-b.svg');
  });

  test('respects known-missing dark variants', () => {
    markDarkLogoMissing('https://cdn.example/icons/darkmode-logo-c.svg');
    const img = new FakeImage('https://cdn.example/icons/logo-c.svg');
    processDarkLogoImage(img as unknown as HTMLImageElement);
    expect(img.src).toBe('https://cdn.example/icons/logo-c.svg');
  });

  test('keeps original source in light mode', () => {
    setThemeMode('light');
    const img = new FakeImage('https://cdn.example/icons/logo-d.svg');
    processDarkLogoImage(img as unknown as HTMLImageElement);
    expect(img.src).toBe('https://cdn.example/icons/logo-d.svg');
  });

  test('processes all images in a container', () => {
    const first = new FakeImage('https://cdn.example/icons/logo-e.svg');
    const second = new FakeImage('https://cdn.example/icons/logo-f.svg');
    const container = {
      querySelectorAll: () => [first, second],
    };

    processDarkLogosInContainer(container as unknown as Element);

    expect(first.src).toBe('https://cdn.example/icons/darkmode-logo-e.svg');
    expect(second.src).toBe('https://cdn.example/icons/darkmode-logo-f.svg');
  });
});
