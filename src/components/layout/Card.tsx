import { PropsWithChildren } from 'react';

interface Props {
  className?: string;
}

export function Card({ className, children }: PropsWithChildren<Props>) {
  return (
    <div
      className={`p-1.5 xs:p-2 sm:p-3 md:p-3.5 relative bg-white rounded-2xl overflow-auto ${className}`}
    >
      {children}
    </div>
  );
}
