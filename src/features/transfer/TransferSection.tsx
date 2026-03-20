import { ReactNode } from 'react';

type TransferSectionProps = {
  label: string;
  children: ReactNode;
};

export function TransferSection({ label, children }: TransferSectionProps) {
  return (
    <div className="overflow-hidden rounded bg-card-gradient shadow-card dark:bg-[rgba(13,6,18,0.65)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(185,89,255,0.2)]">
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
