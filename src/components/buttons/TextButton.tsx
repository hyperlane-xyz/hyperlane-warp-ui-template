import { PropsWithChildren } from 'react';

export interface TextButtonProps {
  classes?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  passThruProps?: any;
}

export function TextButton(props: PropsWithChildren<TextButtonProps>) {
  const { classes, onClick, disabled, type, children, passThruProps } = props;

  const base = 'flex place-content-center transition-all';
  const onHover = 'hover:opacity-70';
  const onDisabled = 'disabled:opacity-50';
  const onActive = 'active:opacity-60';
  const allClasses = `${base} ${onHover} ${onDisabled} ${onActive} ${classes}`;

  return (
    <button
      onClick={onClick}
      type={type || 'button'}
      disabled={disabled ?? false}
      className={allClasses}
      {...passThruProps}
    >
      {children}
    </button>
  );
}
