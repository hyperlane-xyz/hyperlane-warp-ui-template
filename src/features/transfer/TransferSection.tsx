import { ReactNode } from 'react';

type TransferSectionProps = {
  label: string;
  children: ReactNode;
};

export function TransferSection({ label, children }: TransferSectionProps) {
  return (
    <div className="bg-card-gradient shadow-card overflow-hidden rounded">
      {/* Gradient Header */}
      <div className="bg-accent-gradient px-4 py-1.5 shadow-accent-glow">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-cream-300" />
          <span className="text-sm font-medium text-white">{label}</span>
        </div>
      </div>
      {/* Content */}
      <div className="p-4">{children}</div>
    </div>
  );
}
