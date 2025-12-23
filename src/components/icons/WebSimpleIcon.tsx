import { DefaultIconProps } from '@hyperlane-xyz/widgets';
import { memo } from 'react';
import { Color } from '../../styles/Color';

function _WebSimpleIcon({ color, ...props }: DefaultIconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M0.75 9.75H5.75M0.75 9.75C0.75 14.7206 4.77944 18.75 9.75 18.75M0.75 9.75C0.75 4.77944 4.77944 0.75 9.75 0.75M5.75 9.75H13.75M5.75 9.75C5.75 14.7206 7.54086 18.75 9.75 18.75M5.75 9.75C5.75 4.77944 7.54086 0.75 9.75 0.75M13.75 9.75H18.75M13.75 9.75C13.75 4.77944 11.9591 0.75 9.75 0.75M13.75 9.75C13.75 14.7206 11.9591 18.75 9.75 18.75M18.75 9.75C18.75 4.77944 14.7206 0.75 9.75 0.75M18.75 9.75C18.75 14.7206 14.7206 18.75 9.75 18.75"
        stroke={color || Color.primary[500]}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

export const WebSimpleIcon = memo(_WebSimpleIcon);
