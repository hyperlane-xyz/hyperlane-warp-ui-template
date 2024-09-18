import { ComponentProps } from 'react';

import { WarningBanner } from '../../components/banner/WarningBanner';

export function FormWarningBanner({ className, ...props }: ComponentProps<typeof WarningBanner>) {
  return (
    <WarningBanner
      // The margins here should be the inverse of those in Card.tsx
      className={`z-20 -m-1.5 mb-0 sm:-m-3 sm:mb-0 md:-m-3.5 md:mb-0 ${className}`}
      {...props}
    />
  );
}
