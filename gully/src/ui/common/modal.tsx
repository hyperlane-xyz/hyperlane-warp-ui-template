// One modal for the whole bridge: rendered in a portal on <body> so no page stacking context (cards, steps strip,
// sticky header) can ever paint over it. Esc closes, Tab is trapped inside, focus returns to the opener, the page
// does not scroll behind it. Phones (<= 640px) get a bottom sheet. Layers come from the --z-* scale in base.css.
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Icon } from './icons';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({ title, titleId, onClose, children }: { title: string; titleId: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root?.setAttribute('inert', '');
    const first = box.current?.querySelector<HTMLElement>('[aria-current="true"],' + FOCUSABLE);
    (first || box.current)?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== 'Tab' || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const a = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (a === f[0] || !box.current.contains(a))) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && (a === f[f.length - 1] || !box.current.contains(a))) {
        e.preventDefault();
        f[0].focus();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.body.style.overflow = prevOverflow;
      root?.removeAttribute('inert');
      opener?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()} data-testid="modal">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={box} tabIndex={-1}>
        <div className="modal-grip" aria-hidden="true" />
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
