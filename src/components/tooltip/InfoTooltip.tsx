import { clsx } from 'clsx';
import { AnchorHTMLAttributes } from 'react';
import { PlacesType, Tooltip as ReactTooltip } from 'react-tooltip';

import { InfoCircleIcon } from '../icons/InfoCircleIcon';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  id: string;
  content: string;
  size?: number;
  placement?: PlacesType;
  tooltipClassName?: string;
};

export function InfoTooltip({
  id,
  content,
  className,
  placement = 'top-start',
  size = 16,
  tooltipClassName,
  ...rest
}: Props) {
  return (
    <>
      <a
        className={clsx('hover:scale-105 hover:opacity-70', className)}
        data-tooltip-place={placement}
        data-tooltip-id={id}
        data-tooltip-html={content}
        data-tooltip-class-name={clsx('max-w-[calc(100%-10px)] sm:max-w-[526px]', tooltipClassName)}
        {...rest}
      >
        <span
          style={{ width: `${size}px`, height: `${size}px` }}
          className="flex items-center justify-center text-primary-600 transition-all dark:text-primary-50"
        >
          <InfoCircleIcon width={size} height={size} />
        </span>
      </a>
      <ReactTooltip id={id} />
    </>
  );
}
