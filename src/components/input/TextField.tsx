import clsx from 'clsx';
import { Field, FieldAttributes } from 'formik';
import { ChangeEvent, InputHTMLAttributes, Ref, forwardRef } from 'react';

export function TextField({ className, ...props }: FieldAttributes<unknown>) {
  return <Field className={clsx(defaultClassName, className)} {...props} />;
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  onChange: (v: string) => void;
};

export const TextInput = forwardRef(function _TextInput(
  { onChange, className, ...props }: InputProps,
  ref: Ref<HTMLInputElement>,
) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e?.target?.value || '');
  };
  return (
    <input
      ref={ref}
      type="text"
      autoComplete="off"
      onChange={handleChange}
      className={clsx(defaultClassName, className)}
      {...props}
    />
  );
});

const defaultClassName =
  'mt-1.5 px-2.5 py-2.5 text-sm rounded-lg border border-primary-300 focus:border-primary-500 disabled:bg-gray-150 outline-none transition-all duration-300';
