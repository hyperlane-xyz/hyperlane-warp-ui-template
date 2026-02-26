import { ReactNode } from 'react';

type TransferSectionProps = {
  label: string;
  children: ReactNode;
};

export function TransferSection({ label, children }: TransferSectionProps) {
  return (
    <div className="overflow-hidden rounded bg-card-gradient shadow-card">
      {/* Gradient Header */}
      <div className="bg-accent-gradient px-3 py-1 shadow-accent-glow">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-cream-300" />
          <span className="text-sm font-medium text-white">{label}</span>
        </div>
      </div>
      {/* Content */}
      <div className="p-3">{children}</div>
    </div>
  );
}
