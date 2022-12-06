import { memo } from 'react';

import { Color } from '../../styles/Color';

interface Props {
  width?: string | number;
  height?: string | number;
  direction: 'n' | 'e' | 's' | 'w';
  color?: string;
  classes?: string;
}

function _HyperlaneChevron({ width, height, direction, color, classes }: Props) {
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
        fill={color || Color.primaryBlue}
      ></path>
    </svg>
  );
}

export const HyperlaneChevron = memo(_HyperlaneChevron);

function _HyperlaneWideChevron({ width, height, direction, color, classes }: Props) {
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
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120.3 190"
      width={width}
      height={height}
      className={`${directionClass} ${classes}`}
      fill={color || Color.primaryBlue}
    >
      <path d="M4.4 0h53c7.2 0 13.7 3 16.2 7.7l46.5 85.1a2 2 0 0 1 0 2l-.2.5-46.3 87c-2.5 4.6-9 7.7-16.3 7.7h-53c-3 0-5-2-4-4L48 92.9.4 4c-1-2 1-4 4-4Z" />
    </svg>
  );
}

export const HyperlaneWideChevron = memo(_HyperlaneWideChevron);
