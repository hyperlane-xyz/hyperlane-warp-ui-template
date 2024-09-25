import { PropsWithChildren, ReactElement } from 'react';

interface ButtonProps {
  type?: 'submit' | 'reset' | 'button';
  color?: 'white' | 'blue' | 'green' | 'red' | 'gray' | 'pink' | 'mint'; // defaults to blue
  bold?: boolean;
  classes?: string;
  icon?: ReactElement;
}

export function SolidButton(
  props: PropsWithChildren<ButtonProps & React.HTMLProps<HTMLButtonElement>>,
) {
  const {
    type,
    onClick,
    color: _color,
    classes,
    bold,
    icon,
    disabled,
    title,
    ...passThruProps
  } = props;
  const color = _color ?? 'blue';

  const base =
    'flex items-center justify-center rounded-full transition-all duration-500 active:scale-95';
  let baseColors, onHover;
  if (color === 'blue') {
    baseColors = 'bg-primary-500 text-white';
    onHover = 'hover:bg-primary-600';
  } else if (color === 'pink') {
    baseColors = 'bg-accent-500 text-white';
    onHover = 'hover:bg-accent-600';
  } else if (color === 'green') {
    baseColors = 'bg-green-500 text-white';
    onHover = 'hover:bg-green-600';
  } else if (color === 'mint') {
    baseColors = 'bg-mint-500 text-white';
    onHover = 'hover:bg-mint-600';
  } else if (color === 'red') {
    baseColors = 'bg-red-600 text-white';
    onHover = 'hover:bg-red-500';
  } else if (color === 'white') {
    baseColors = 'bg-white text-black';
    onHover = 'hover:bg-primary-100';
  } else if (color === 'gray') {
    baseColors = 'bg-gray-100 text-primary-500';
    onHover = 'hover:bg-gray-200';
  }
  const onDisabled = 'disabled:bg-gray-300 disabled:text-gray-500';
  const weight = bold ? 'font-semibold' : '';
  const allClasses = `${base} ${baseColors} ${onHover} ${onDisabled} ${weight} ${classes}`;

  return (
    <button
      onClick={onClick}
      type={type ?? 'button'}
      disabled={disabled ?? false}
      title={title}
      className={allClasses}
      {...passThruProps}
    >
      {icon ? (
        <div className="flex items-center justify-center space-x-1">
          {props.icon}
          {props.children}
        </div>
      ) : (
        <>{props.children}</>
      )}
    </button>
  );
}
