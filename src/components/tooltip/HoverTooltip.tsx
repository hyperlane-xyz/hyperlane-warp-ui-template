import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Portal-based tooltip so overflow/clip containers never occlude the content.
export function HoverTooltip({
  children,
  tooltip,
}: {
  children: React.ReactNode;
  tooltip: React.ReactNode;
}) {
  const tooltipId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const computePos = () => {
    if (!ref.current) return null;
    const r = ref.current.getBoundingClientRect();
    const tooltipWidth = 240;
    const rawLeft = r.left + r.width / 2;
    const clampedLeft = Math.min(
      Math.max(rawLeft, tooltipWidth / 2 + 8),
      window.innerWidth - tooltipWidth / 2 - 8,
    );
    return { top: r.bottom + 8, left: clampedLeft };
  };

  const handleMouseEnter = () => {
    setPos(computePos());
  };

  const handleMouseLeave = () => {
    setPos(null);
  };

  const handleTouchStart = () => {
    setPos((current) => (current ? null : computePos()));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setPos((current) => (current ? null : computePos()));
  };

  useEffect(() => {
    if (!pos) return;
    const update = () => setPos(computePos());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPos(null);
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      window.removeEventListener('keydown', closeOnEscape);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!pos]);

  return (
    <div
      ref={ref}
      // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- Tooltip wraps arbitrary markup; a button would reject block children.
      role="button"
      tabIndex={0}
      aria-expanded={!!pos}
      aria-describedby={pos ? tooltipId : undefined}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onKeyDown={handleKeyDown}
    >
      {children}
      {pos &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
            className="w-max max-w-[240px] -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs shadow-xl dark:border-primary-300/30 dark:bg-surface dark:text-foreground-primary"
          >
            {tooltip}
          </div>,
          document.body,
        )}
    </div>
  );
}
