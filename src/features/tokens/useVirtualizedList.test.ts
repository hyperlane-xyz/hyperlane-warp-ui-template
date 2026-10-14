import { describe, expect, it } from 'vitest';

import { getVirtualListRange } from './useVirtualizedList';

describe('getVirtualListRange', () => {
  it('renders the viewport and overscan at the start', () => {
    expect(
      getVirtualListRange({
        itemCount: 200,
        itemSize: 68,
        overscan: 3,
        viewportSize: 340,
      }),
    ).toEqual({ startIndex: 0, endIndex: 8, offsetTop: 0, totalSize: 13_600 });
  });

  it('windows rows around the current scroll position', () => {
    expect(
      getVirtualListRange({
        itemCount: 200,
        itemSize: 68,
        overscan: 3,
        scrollOffset: 680,
        viewportSize: 340,
      }),
    ).toEqual({ startIndex: 7, endIndex: 18, offsetTop: 476, totalSize: 13_600 });
  });

  it('clamps the rendered range to the final row', () => {
    expect(
      getVirtualListRange({
        itemCount: 20,
        itemSize: 68,
        overscan: 3,
        scrollOffset: 1_200,
        viewportSize: 340,
      }),
    ).toEqual({ startIndex: 14, endIndex: 20, offsetTop: 952, totalSize: 1_360 });
  });

  it('handles scroll offsets beyond the final row', () => {
    expect(
      getVirtualListRange({
        itemCount: 20,
        itemSize: 68,
        overscan: 3,
        scrollOffset: 10_000,
        viewportSize: 340,
      }),
    ).toEqual({ startIndex: 16, endIndex: 20, offsetTop: 1_088, totalSize: 1_360 });
  });

  it('handles an empty list', () => {
    expect(getVirtualListRange({ itemCount: 0, itemSize: 68 })).toEqual({
      startIndex: 0,
      endIndex: 0,
      offsetTop: 0,
      totalSize: 0,
    });
  });
});
