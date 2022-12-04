import { Field } from 'formik';
import { ComponentProps } from 'react';

export function TextField(props: ComponentProps<typeof Field>) {
  return (
    <Field
      className="w-100 mt-2 p-2 text-sm border border-color-gray-800 rounded focus:outline-none"
      {...props}
    />
  );
}
