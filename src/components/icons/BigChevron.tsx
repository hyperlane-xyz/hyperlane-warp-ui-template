import { memo } from 'react';

import { Color } from '../../styles/Color';

interface Props {
  width?: string | number;
  height?: string | number;
  direction: 'n' | 'e' | 's' | 'w';
  color?: string;
  classes?: string;
}

function _BigChevron({ width, height, direction, color, classes }: Props) {
  let directionClass;
  switch (direction) {
    case 'n':
      directionClass = '-rotate-90';
      break;
    case 'e':
      directionClass = '';
      break;
    case 's':
      directionClass = 'rotate-90';
      break;
    case 'w':
      directionClass = 'rotate-180';
      break;
    default:
      throw new Error(`Invalid chevron direction ${direction}`);
  }

  return (
    <svg
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="1.2 1 139.1 322"
      width={width}
      height={height}
      className={`${directionClass} ${classes}`}
    >
      <path
        d="M6.3 1h61.3a20 20 0 0 1 18.7 13L140 158.3a5 5 0 0 1 0 3.4l-.3.9-53.5 147.2A20 20 0 0 1 67.4 323H6.2a5 5 0 0 1-4.7-6.6l55.2-158.1L1.7 7.7A5 5 0 0 1 6.2 1Z"
        fill={color || Color.primaryBlack}
      ></path>
    </svg>
  );
}

export const BigChevron = memo(_BigChevron);
