import clsx from 'clsx';
import { ReactNode } from 'react';

export function ModalHeader({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex items-center gap-2 bg-accent-gradient px-4 py-1', className)}>
      {children && (
        <>
          <div className="h-2 w-2 rounded-full bg-white" />
          <span className="font-secondary text-xs text-white">{children}</span>
        </>
      )}
    </div>
  );
}
