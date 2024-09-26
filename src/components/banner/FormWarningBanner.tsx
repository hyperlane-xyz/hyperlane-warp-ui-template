import { ComponentProps } from 'react';

import { WarningBanner } from '../../components/banner/WarningBanner';
import { cardStyles } from '../layout/Card';

export function FormWarningBanner({ className, ...props }: ComponentProps<typeof WarningBanner>) {
  return (
    <WarningBanner
      className={`z-20 ${cardStyles.inverseMargin} mb-0 sm:mb-0 md:mb-0 ${className}`}
      {...props}
    />
  );
}
