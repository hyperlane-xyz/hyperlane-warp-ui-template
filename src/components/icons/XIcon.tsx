import { memo } from 'react';

function _XIcon({
  width,
  height,
  fill,
  className = '',
}: {
  width?: number | string;
  height?: number | string;
  fill?: string;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      className={className}
      viewBox="20.24 19.95 56.33 56.24"
    >
      <path
        fill={fill}
        d="M27.73 76.19a7.5 7.5 0 0 1-5.3-12.8l41.34-41.34a7.5 7.5 0 0 1 10.6 10.61L33 74a7.48 7.48 0 0 1-5.27 2.19Z"
      />
      <path d="M69.07 76.19a7.48 7.48 0 0 1-5.3-2.2L22.43 32.66A7.5 7.5 0 0 1 33 22.05l41.37 41.34a7.5 7.5 0 0 1-5.3 12.8Z" />
    </svg>
  );
}

export const XIcon = memo(_XIcon);
