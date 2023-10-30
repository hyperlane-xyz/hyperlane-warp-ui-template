import { memo } from 'react';

function _Discord({
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
      viewBox="0 0 71 55"
      fill="none"
    >
      <g clipPath="url(#a)">
        <path
          d="M60.1 4.9A58.5 58.5 0 0 0 45.4.5l-1.8 3.7a54 54 0 0 0-16.2 0 37.4 37.4 0 0 0-2-3.8A58.4 58.4 0 0 0 10.7 5 60 60 0 0 0 .4 45.6a58.9 58.9 0 0 0 18 8.8 42 42 0 0 0 3.6-5.9l-.1-.3c-2-.7-3.8-1.6-5.6-2.6a.2.2 0 0 1 0-.4 30.3 30.3 0 0 0 1.3-.9 42 42 0 0 0 36 0l1 1c.2 0 .2.2 0 .3-1.7 1-3.6 1.9-5.5 2.6a47.2 47.2 0 0 0 3.8 6.3 58.7 58.7 0 0 0 17.8-9.1A59.5 59.5 0 0 0 60 4.9ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.1 0-4 2.9-7.2 6.4-7.2 3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.1-6.4 7.1Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.1 0-4 2.9-7.2 6.4-7.2 3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.1-6.4 7.1Z"
          fill={fill}
        />
      </g>
      <defs>
        <clipPath id="a">
          <path fill="#fff" d="M0 0h71v55H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}

export const Discord = memo(_Discord);
