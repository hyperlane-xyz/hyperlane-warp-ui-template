import { memo } from 'react';

function _Linkedin({
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
      viewBox="0 0 30 30"
    >
      <path
        d="M9 25H4V10h5v15zM6.5 8a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zM27 25h-4.8v-7.3c0-1.74-.04-3.98-2.5-3.98-2.5 0-2.9 1.9-2.9 3.85V25H12V9.99h4.61v2.05h.07a5.08 5.08 0 0 1 4.55-2.42c4.87 0 5.77 3.1 5.77 7.15V25z"
        fill={fill}
      />
    </svg>
  );
}

export const Linkedin = memo(_Linkedin);
