import { SVGProps } from 'react';

// TODO: Replace with DefaultIconProps in widgets lib
export type IconProps = SVGProps<SVGSVGElement> & {
  color?: string;
};
