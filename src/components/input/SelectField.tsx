import { Field, FieldAttributes } from 'formik';

import { useIsSsr } from '../../utils/ssr';

export function SelectField(
  props: FieldAttributes<{
    placeholder;
    options: Array<{ value: string; display: string }>;
  }>,
) {
  // To silence hydration error due to differing options on server
  const isSSr = useIsSsr();
  if (isSSr) return null;

  const { options, placeholder, ...passThruProps } = props;
  return (
    <Field
      as="select"
      className="w-100 mt-2 p-2 text-sm invalid:text-gray-400 border border-color-gray-800 rounded focus:outline-none"
      {...passThruProps}
    >
      <option value="" disabled selected>
        {placeholder}
      </option>
      {options.map((o, i) => (
        <option key={`option-${i}`} value={o.value}>
          {o.display}
        </option>
      ))}
    </Field>
  );
}
