import { Field } from 'formik';
import Image from 'next/image';
import { ComponentProps } from 'react';

import ChevronIcon from '../../images/icons/chevron-down.svg';
import { getChainDisplayName } from '../../utils/chains';
import { ChainIcon } from '../icons/ChainIcon';

type Props = ComponentProps<typeof Field> & { label: string };

export function ChainSelectField(props: Props) {
  return <Field as={ChainSelect} {...props} />;
}

function ChainSelect({ value, name, label, onChange, onBlur }: Props) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center justify-center rounded-full bg-gray-100 h-28 w-28 p-2">
        <div className="flex items-end h-12">
          <ChainIcon chainId={value} size={40} />
        </div>
        <label htmlFor={name} className="mt-2.5 text-sm text-gray-500 uppercase">
          {label}
        </label>
      </div>
      <button
        type="button"
        name={name}
        className="w-36 px-2.5 py-2 relative -top-2 flex items-center justify-between text-sm bg-white hover:bg-gray-50 active:bg-gray-100 rounded border border-gray-400 focus:border-blue-500 focus:outline-none transition-colors duration-500"
      >
        <div className="flex items-center">
          <ChainIcon chainId={value} size={14} />
          <span className="ml-2">{getChainDisplayName(value)}</span>
        </div>
        <Image src={ChevronIcon} width={12} height={8} alt="" />
      </button>
    </div>
  );
}
