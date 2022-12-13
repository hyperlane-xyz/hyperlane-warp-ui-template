import { useField } from 'formik';
import Image from 'next/image';
import { useState } from 'react';

import { ChainIcon } from '../../components/icons/ChainIcon';
import ChevronIcon from '../../images/icons/chevron-down.svg';
import { getChainDisplayName } from '../../utils/chains';

import { ChainSelectModal } from './ChainSelectModal';

type Props = {
  name: string;
  label: string;
  onChange?: (chainId: number) => void;
};

export function ChainSelectField({ name, label, onChange }: Props) {
  const [field, , helpers] = useField<number>(name);

  const handleChange = (newChainId: number) => {
    helpers.setValue(newChainId);
    if (onChange) onChange(newChainId);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center justify-center rounded-full bg-gray-100 h-[6.5rem] w-[6.5rem] p-1.5">
        <div className="flex items-end h-12">
          <ChainIcon chainId={field.value} size={34} />
        </div>
        <label htmlFor={name} className="mt-2.5 text-sm text-gray-500 uppercase">
          {label}
        </label>
      </div>
      <button
        type="button"
        name={field.name}
        className="w-36 px-2.5 py-2 relative -top-1.5 flex items-center justify-between text-sm bg-white hover:bg-gray-50 active:bg-gray-100 rounded border border-gray-400 focus:border-blue-500 focus:outline-none transition-colors duration-500"
        onClick={() => setIsModalOpen(true)}
      >
        <div className="flex items-center">
          <ChainIcon chainId={field.value} size={14} />
          <span className="ml-2">{getChainDisplayName(field.value, true)}</span>
        </div>
        <Image src={ChevronIcon} width={12} height={8} alt="" />
      </button>
      <ChainSelectModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        onSelect={handleChange}
      />
    </div>
  );
}
