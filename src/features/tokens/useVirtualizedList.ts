import { type RefObject, useCallback, useLayoutEffect, useState } from 'react';

interface VirtualListOptions {
  itemCount: number;
  itemSize: number;
  overscan?: number;
  scrollRef: RefObject<HTMLElement | null>;
}

export interface VirtualListRange {
  endIndex: number;
  offsetTop: number;
  startIndex: number;
  totalSize: number;
}

export function getVirtualListRange({
  itemCount,
  itemSize,
  overscan = 3,
  scrollOffset = 0,
  viewportSize = 0,
}: Omit<VirtualListOptions, 'scrollRef'> & {
  scrollOffset?: number;
  viewportSize?: number;
}): VirtualListRange {
  if (itemCount <= 0 || itemSize <= 0) {
    return { endIndex: 0, offsetTop: 0, startIndex: 0, totalSize: 0 };
  }

  const safeOverscan = Math.max(0, Math.floor(overscan));
  const firstVisible = Math.min(itemCount - 1, Math.floor(Math.max(0, scrollOffset) / itemSize));
  const visibleCount = Math.max(1, Math.ceil(Math.max(0, viewportSize) / itemSize));
  const startIndex = Math.max(0, firstVisible - safeOverscan);
  const endIndex = Math.min(itemCount, firstVisible + visibleCount + safeOverscan);

  return {
    startIndex,
    endIndex,
    offsetTop: startIndex * itemSize,
    totalSize: itemCount * itemSize,
  };
}

export function useVirtualizedList({
  itemCount,
  itemSize,
  overscan = 3,
  scrollRef,
}: VirtualListOptions) {
  const [range, setRange] = useState(() =>
    getVirtualListRange({
      itemCount,
      itemSize,
      overscan,
      viewportSize: itemSize * 8,
    }),
  );

  const measure = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const nextRange = getVirtualListRange({
      itemCount,
      itemSize,
      overscan,
      scrollOffset: element.scrollTop,
      viewportSize: element.clientHeight,
    });
    setRange((current) =>
      current.startIndex === nextRange.startIndex &&
      current.endIndex === nextRange.endIndex &&
      current.totalSize === nextRange.totalSize
        ? current
        : nextRange,
    );
  }, [itemCount, itemSize, overscan, scrollRef]);

  useLayoutEffect(() => {
    measure();
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure, scrollRef]);

  return { ...range, onScroll: measure };
}
