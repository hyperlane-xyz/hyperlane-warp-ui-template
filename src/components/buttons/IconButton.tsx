import Image from 'next/image';
import { PropsWithChildren } from 'react';

export interface IconButtonProps {
  width?: number;
  height?: number;
  classes?: string;
  onClick?: () => void;
  disabled?: boolean;
  imgSrc?: any;
  title?: string;
  type?: 'button' | 'submit';
  passThruProps?: any;
}

export function IconButton(props: PropsWithChildren<IconButtonProps>) {
  const {
    width,
    height,
    classes,
    onClick,
    imgSrc,
    disabled,
    title,
    type,
    children,
    passThruProps,
  } = props;

  const base = 'flex items-center justify-center transition-all';
  const onHover = 'hover:opacity-70';
  const onDisabled = 'disabled:opacity-30 disabled:cursor-default';
  const onActive = 'active:opacity-60';
  const allClasses = `${base} ${onHover} ${onDisabled} ${onActive} ${classes}`;

  return (
    <button
      onClick={onClick}
      type={type || 'button'}
      disabled={disabled ?? false}
      title={title}
      className={allClasses}
      {...passThruProps}
    >
      {imgSrc && (
        <Image src={imgSrc} alt={title?.substring(0, 4) || ''} width={width} height={height} />
      )}
      {children}
    </button>
  );
}
