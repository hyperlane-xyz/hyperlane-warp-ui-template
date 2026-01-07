import clsx from 'clsx';
import { ComponentProps } from 'react';
import { WarningBanner } from '../../components/banner/WarningBanner';

export function FormWarningBanner({
  className,
  isVisible,
  ...props
}: ComponentProps<typeof WarningBanner>) {
  return (
    <div>
      <WarningBanner
        className={clsx('absolute -top-4 left-0 right-0 z-10', className)}
        isVisible={isVisible}
        {...props}
      />
      <div className={clsx('transition-all duration-500', isVisible ? 'pb-10' : 'pb-0')}></div>
    </div>
  );
}
