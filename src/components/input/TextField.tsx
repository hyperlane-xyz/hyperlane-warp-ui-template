import { Field, FieldAttributes } from 'formik';

export function TextField({ classes, ...props }: FieldAttributes<{ classes: string }>) {
  return (
    <Field
      className={`mt-1.5 px-2.5 py-2 text-sm rounded border border-gray-400 focus:border-blue-500 focus:outline-none transition-colors ${classes}`}
      {...props}
    />
  );
}
