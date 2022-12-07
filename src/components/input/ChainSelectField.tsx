import { Field } from 'formik';
import Image from 'next/image';
import { ComponentProps, useState } from 'react';

import ChevronIcon from '../../images/icons/chevron-down.svg';
import { getChainDisplayName } from '../../utils/chains';
import { ChainIcon } from '../icons/ChainIcon';

import { ChainSelectModal } from './ChainSelectModal';

type Props = ComponentProps<typeof Field> & { label: string };

export function ChainSelectField(props: Props) {
  return <Field as={ChainSelectCircle} {...props} />;
}

function ChainSelectCircle({ value, name, label, onChange, onBlur }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center justify-center rounded-full bg-gray-100 h-[6.5rem] w-[6.5rem] p-1.5">
        <div className="flex items-end h-12">
          <ChainIcon chainId={value} size={36} />
        </div>
        <label htmlFor={name} className="mt-2.5 text-sm text-gray-500 uppercase">
          {label}
        </label>
      </div>
      <button
        type="button"
        name={name}
        className="w-36 px-2.5 py-2 relative -top-1.5 flex items-center justify-between text-sm bg-white hover:bg-gray-50 active:bg-gray-100 rounded border border-gray-400 focus:border-blue-500 focus:outline-none transition-colors duration-500"
        onClick={openModal}
      >
        <div className="flex items-center">
          <ChainIcon chainId={value} size={14} />
          <span className="ml-2">{getChainDisplayName(value)}</span>
        </div>
        <Image src={ChevronIcon} width={12} height={8} alt="" />
      </button>
      <ChainSelectModal isOpen={isModalOpen} close={closeModal} />
    </div>
  );
}
