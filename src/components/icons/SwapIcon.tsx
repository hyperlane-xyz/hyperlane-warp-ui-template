import { DefaultIconProps } from '@hyperlane-xyz/widgets';
import { memo } from 'react';
import { Color } from '../../styles/Color';

function _SwapIcon({ color, ...props }: DefaultIconProps) {
  return (
    <svg viewBox="0 0 15 20" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M5.58675 18.0072H6.09464V9.5H7.92744V18.0072H8.43533V17.7906C8.43533 16.8159 8.70032 16.1227 9.40694 15.4296L14.0221 10.9025V13.1336L7.02208 20L0 13.1336V10.9025L4.61514 15.4296C5.32177 16.1227 5.58675 16.7942 5.58675 17.7906V18.0072Z"
        fill={color || Color.gray[400]}
      />
      <path
        d="M5.58675 8.50722H6.09464V0H7.92744V8.50722H8.43533V8.29062C8.43533 7.31589 8.70032 6.62274 9.40694 5.9296L14.0221 1.40253V3.63357L7.02208 10.5L0 3.63357V1.40253L4.61514 5.9296C5.32177 6.62274 5.58675 7.29423 5.58675 8.29062V8.50722Z"
        fill={color || Color.gray[400]}
      />
    </svg>
  );
}

export const SwapIcon = memo(_SwapIcon);
