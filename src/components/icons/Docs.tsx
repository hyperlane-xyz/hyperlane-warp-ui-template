import { memo } from 'react';
import { Color } from '../../styles/Color';

interface Props {
  width?: string | number;
  height?: string | number;
  color?: string;
  className?: string;
}

function _DocsIcon({ className, color, height = 24, width = 24 }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height={height}
      viewBox="0 -960 960 960"
      width={width}
      fill={color || Color.white}
      className={className}
    >
      <path d="M320-440h320v-80H320v80Zm0 120h320v-80H320v80Zm0 120h200v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z" />
    </svg>
  );
}

export const DocsIcon = memo(_DocsIcon);
