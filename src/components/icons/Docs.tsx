import { memo } from 'react';

import { Color } from '../../styles/Color';
import { IconProps } from './types';

function _DocsIcon({
  width = 24,
  height = 24,
  className,
  color = Color.black,
  ...props
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 -960 960 960"
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M320-440h320v-80H320v80Zm0 120h320v-80H320v80Zm0 120h200v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"
      />
    </svg>
  );
}

export const DocsIcon = memo(_DocsIcon);
