import { WarningIcon } from '@hyperlane-xyz/widgets';
import { PropsWithChildren, ReactNode } from 'react';

export function WarningBanner({
  isVisible,
  cta,
  onClick,
  className,
  children,
}: PropsWithChildren<{
  isVisible: boolean;
  cta: ReactNode;
  onClick: () => void;
  className?: string;
}>) {
  return (
    <div
      className={`flex items-center justify-between gap-2 bg-amber-400 px-4 text-sm ${
        isVisible ? 'max-h-28 py-2' : 'max-h-0'
      } overflow-hidden transition-all duration-500 ${className}`}
    >
      <div className="flex items-center gap-2">
        <WarningIcon width={20} height={20} />
        {children}
      </div>
      <button
        type="button"
        onClick={onClick}
        className="rounded-full bg-white/30 px-2.5 py-1 text-center hover:bg-white/50 active:bg-white/60"
      >
        {cta}
      </button>
    </div>
  );
}
