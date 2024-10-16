import { PropsWithChildren } from 'react';

interface Props {
  className?: string;
}

export function Card({ className, children }: PropsWithChildren<Props>) {
  return (
    <div
      className={`${cardStyles.padding} relative overflow-auto rounded-2xl bg-white ${className}`}
    >
      {children}
    </div>
  );
}

export const cardStyles = {
  padding: 'p-1.5 xs:p-2 sm:p-3 md:p-4',
  // Should be inverse of cardPadding, used when something
  // should be flush with card edge
  inverseMargin: '-m-1.5 xs:-m-2 sm:-m-3 md:-m-4',
};
