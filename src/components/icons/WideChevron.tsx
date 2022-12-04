import { memo } from 'react';

import { Color } from '../../styles/Color';

interface Props {
  width?: string | number;
  height?: string | number;
  direction: 'n' | 'e' | 's' | 'w';
  color?: string;
  rounded?: boolean;
  classes?: string;
}

function _WideChevronIcon({ width, height, direction, color, rounded, classes }: Props) {
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

  if (rounded) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 120.3 190"
        width={width}
        height={height}
        fill={color || Color.primaryBlue}
        className={`${directionClass} ${classes}`}
      >
        <path d="M4.4 0h53c7.2 0 13.7 3 16.2 7.7l46.5 85.1a2 2 0 0 1 0 2l-.2.5-46.3 87c-2.5 4.6-9 7.7-16.3 7.7h-53c-3 0-5-2-4-4L48 92.9.4 4c-1-2 1-4 4-4Z" />
      </svg>
    );
  } else {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 28 27"
        width={width}
        height={height}
        className={`${directionClass} ${classes}`}
      >
        <path
          d="M13.44 13.5 0 27h14.56L28 13.5 14.56 0H0l13.44 13.5Z"
          fill={color || Color.primaryBlue}
        />
      </svg>
    );
  }
}

export const WideChevronIcon = memo(_WideChevronIcon);
