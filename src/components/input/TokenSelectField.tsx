import { useField } from 'formik';
import Image from 'next/image';
import { useState } from 'react';

import ChevronIcon from '../../images/icons/chevron-down.svg';
import { TokenIcon } from '../icons/TokenIcon';

import { TokenSelectModal } from './TokenSelectModal';

type Props = {
  name: string;
  onChange?: (tokenAddress: Address) => void;
};

export function TokenSelectField({ name, onChange }: Props) {
  const [field, , helpers] = useField<Address>(name);

  const handleChange = (newTokenAddress: Address) => {
    helpers.setValue(newTokenAddress);
    if (onChange) onChange(newTokenAddress);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        name={field.name}
        className="mt-1.5 w-full px-2.5 py-2 flex items-center justify-between text-sm bg-white hover:bg-gray-50 active:bg-gray-100 rounded border border-gray-400 focus:border-blue-500 focus:outline-none transition-colors duration-500"
        onClick={() => setIsModalOpen(true)}
      >
        <div className="flex items-center">
          <TokenIcon tokenAddress={field.value} size={20} />
          <span className="ml-2">{field.value || 'Select Token'}</span>
        </div>
        <Image src={ChevronIcon} width={12} height={8} alt="" />
      </button>
      <TokenSelectModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        onSelect={handleChange}
      />
    </>
  );
}
