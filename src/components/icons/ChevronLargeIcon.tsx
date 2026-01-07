import { DefaultIconProps } from '@hyperlane-xyz/widgets';
import { memo } from 'react';
import { Color } from '../../styles/Color';

function _ChevronLargeIcon({ color, ...props }: DefaultIconProps) {
  return (
    <svg viewBox="0 0 16 20" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M16 11.2601L2.31817e-07 20L1.95149e-07 16.8365L11.2573 10.992C11.8306 10.6702 12.2997 10.563 12.9251 10.563H14.5928V9.49062H12.9251C12.2997 9.49062 11.8306 9.38338 11.2573 9.06166L3.6048e-08 3.10992L0 0L16 8.68633V11.2601Z"
        fill={color || Color.gray[900]}
      />
    </svg>
  );
}

export const ChevronLargeIcon = memo(_ChevronLargeIcon);
