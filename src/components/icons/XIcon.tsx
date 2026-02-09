import { DefaultIconProps } from '@hyperlane-xyz/widgets';
import { memo } from 'react';
import { Color } from '../../styles/Color';

function _XIcon({ color, ...props }: DefaultIconProps) {
  return (
    <svg viewBox="0 0 19 17" xmlns="http://www.w3.org/2000/svg" fill="none" {...props}>
      <path
        d="M14.4386 0H17.2498L11.1081 7.01958L18.3333 16.5716H12.676L8.24503 10.7784L3.17496 16.5716H0.362027L6.9312 9.06341L0 0H5.80092L9.80616 5.29528L14.4386 0ZM13.4519 14.889H15.0097L4.9545 1.59428H3.28288L13.4519 14.889Z"
        fill={color || Color.primary[500]}
      />
    </svg>
  );
}

export const XIcon = memo(_XIcon);
