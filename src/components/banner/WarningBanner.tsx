import Image from 'next/image';
import { PropsWithChildren, ReactNode } from 'react';

import WarningIcon from '../../images/icons/warning.svg';

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
      className={`flex items-center justify-between gap-2 px-4 bg-amber-400 text-sm ${
        isVisible ? 'max-h-28 py-2 mb-2' : 'max-h-0 mb-0'
      } overflow-hidden transition-all duration-500 ${className}`}
    >
      <div className="flex items-center gap-2">
        <Image src={WarningIcon} width={20} height={20} alt="Warning:" />
        {children}
      </div>
      <button
        type="button"
        onClick={onClick}
        className="bg-white/30 rounded-full px-2.5 py-1 text-center hover:bg-white/50 active:bg-white/60"
      >
        {cta}
      </button>
    </div>
  );
}
