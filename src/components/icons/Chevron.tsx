import { memo } from 'react';

import { Color } from '../../styles/Color';

interface Props {
  width?: string | number;
  height?: string | number;
  direction: 'n' | 'e' | 's' | 'w';
  color?: string;
  classes?: string;
}

function _ChevronIcon({ width, height, direction, color, classes }: Props) {
  let directionClass;
  switch (direction) {
    case 'n':
      directionClass = 'rotate-180';
      break;
    case 'e':
      directionClass = '-rotate-90';
      break;
    case 's':
      directionClass = '';
      break;
    case 'w':
      directionClass = 'rotate-90';
      break;
    default:
      throw new Error(`Invalid chevron direction ${direction}`);
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 14 8"
      className={`${directionClass} ${classes}`}
    >
      <path
        d="M1 1l6 6 6-6"
        strokeWidth="2"
        stroke={color || Color.primaryBlack}
        fill="none"
        fillRule="evenodd"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const ChevronIcon = memo(_ChevronIcon);
