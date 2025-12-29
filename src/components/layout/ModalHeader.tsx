import { ReactNode } from 'react';

export function ModalHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 bg-accent-gradient px-4 py-1">
      <div className="h-2 w-2 rounded-full bg-white" />
      <span className="font-secondary text-xs text-white">{children}</span>
    </div>
  );
}
