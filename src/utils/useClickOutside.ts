import { useCallback, useEffect, useRef } from 'react';

// Close a popover / dropdown when the user clicks outside its container.
// Extracted from ChainFilterPanel's local helper so other components can
// reuse the same pointerdown-based detection.
export function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handlerRef.current();
      }
    },
    [ref],
  );

  useEffect(() => {
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onPointerDown]);
}
