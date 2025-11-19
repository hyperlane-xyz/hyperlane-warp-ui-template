import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isWindowSizeMobile,
  isWindowSizeSmallMobile,
  useIsMobile,
  useWindowSize,
} from '../mediaQueries';

// Mock window object
const mockWindow = {
  innerWidth: 1024,
  innerHeight: 768,
};

Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: mockWindow.innerWidth,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: mockWindow.innerHeight,
});

describe('mediaQueries', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    window.innerWidth = 1024;
    window.innerHeight = 768;
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  describe('useWindowSize', () => {
    it('returns current window dimensions by default and reacts to resize events', async () => {
      window.innerWidth = 800;
      window.innerHeight = 600;

      const { result } = renderHook(() => useWindowSize());

      expect(result.current).toEqual({ width: 800, height: 600 });

      await act(async () => {
        window.innerWidth = 500;
        window.innerHeight = 400;
        window.dispatchEvent(new Event('resize'));
      });

      expect(result.current).toEqual({ width: 500, height: 400 });
      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
    });

    it('cleans up resize listener on unmount', () => {
      const { unmount } = renderHook(() => useWindowSize());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });
  });

  describe('isWindowSizeMobile', () => {
    it('should return true for width less than 768', () => {
      expect(isWindowSizeMobile(767)).toBe(true);
      expect(isWindowSizeMobile(500)).toBe(true);
      expect(isWindowSizeMobile(360)).toBe(true); // Edge case
    });

    it('should return false for width 768 or greater', () => {
      expect(isWindowSizeMobile(768)).toBe(false);
      expect(isWindowSizeMobile(1024)).toBe(false);
      expect(isWindowSizeMobile(1920)).toBe(false);
    });

    it('should return false for undefined width', () => {
      expect(isWindowSizeMobile(undefined)).toBe(false); // Assuming default is non-mobile
    });
  });

  describe('isWindowSizeSmallMobile', () => {
    it('should return true for width less than 360', () => {
      expect(isWindowSizeSmallMobile(359)).toBe(true);
      expect(isWindowSizeSmallMobile(320)).toBe(true);
      expect(isWindowSizeSmallMobile(200)).toBe(true);
    });

    it('should return false for width 360 or greater', () => {
      expect(isWindowSizeSmallMobile(360)).toBe(false);
      expect(isWindowSizeSmallMobile(768)).toBe(false);
      expect(isWindowSizeSmallMobile(1024)).toBe(false);
    });

    it('should return false for undefined width', () => {
      expect(isWindowSizeSmallMobile(undefined)).toBe(false); // Assuming default is non-small-mobile
    });
  });

  describe('useIsMobile', () => {
    it('tracks breakpoint in response to resize events', async () => {
      window.innerWidth = 900;
      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);

      await act(async () => {
        window.innerWidth = 500;
        window.dispatchEvent(new Event('resize'));
      });

      expect(result.current).toBe(true);

      await act(async () => {
        window.innerWidth = 900;
        window.dispatchEvent(new Event('resize'));
      });

      expect(result.current).toBe(false);
    });
  });
});
