import { PropsWithChildren, ReactElement } from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps {
  type?: 'submit' | 'reset' | 'button';
  color?: 'white' | 'primary' | 'accent' | 'green' | 'red' | 'gray'; // defaults to primary
  bold?: boolean;
  className?: string;
  icon?: ReactElement;
}

export function SolidButton(
  props: PropsWithChildren<ButtonProps & React.HTMLProps<HTMLButtonElement>>,
) {
  const {
    type,
    onClick,
    color: _color,
    className,
    bold,
    icon,
    disabled,
    title,
    ...passThruProps
  } = props;
  const color = _color ?? 'primary';

  const base =
    'flex items-center justify-center rounded-lg transition-all duration-500 active:scale-95';
  let baseColors, onHover;
  if (color === 'primary') {
    baseColors = 'bg-primary-500 text-white';
    onHover = 'hover:bg-primary-600';
  } else if (color === 'accent') {
    baseColors = cn(
      'relative before:absolute before:-z-10 isolate overflow-hidden',
      'bg-[linear-gradient(104.99deg,#FFC555_-21.89%,#FB4AB9_87.44%)] text-white',
      'before:inset-0 before:transition-colors',
    );
    onHover = cn('hover:before:bg-gray-350');
  } else if (color === 'green') {
    baseColors = 'bg-green-500 text-white';
    onHover = 'hover:bg-green-600';
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
  const allClasses = `${base} ${baseColors} ${onHover} ${onDisabled} ${weight} ${className}`;

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
