import { DefaultIconProps } from '@hyperlane-xyz/widgets';
import { memo } from 'react';

function _HamburgerIcon({ color, ...props }: DefaultIconProps) {
  return (
    <svg viewBox="0 0 20 19" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M10 18H1M19 9.5H1M19 1H1"
        stroke={color || 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const HamburgerIcon = memo(_HamburgerIcon);
