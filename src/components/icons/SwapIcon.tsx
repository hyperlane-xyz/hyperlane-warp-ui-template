import { DefaultIconProps } from '@hyperlane-xyz/widgets';
import { memo } from 'react';
import { Color } from '../../styles/Color';

function _SwapIcon({ color, ...props }: DefaultIconProps) {
  return (
    <svg viewBox="0 0 15 21" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M9.40694 4.5704L14.0221 9.09747V6.86643L7 0L0 6.86643V9.09747L4.61514 4.5704C5.32177 3.87726 5.58675 3.18412 5.58675 2.20939V1.99278H6.09464V19.0072H5.58675V18.7906C5.58675 17.7942 5.32177 17.1227 4.61514 16.4296L0 11.9025V14.1336L7.02208 21L14.0221 14.1336V11.9025L9.40694 16.4296C8.70032 17.1227 8.43533 17.8159 8.43533 18.7906V19.0072H7.92744V1.99278H8.43533V2.20939C8.43533 3.20578 8.70032 3.87726 9.40694 4.5704Z"
        fill={color || Color.gray[400]}
      />
    </svg>
  );
}

export const SwapIcon = memo(_SwapIcon);
