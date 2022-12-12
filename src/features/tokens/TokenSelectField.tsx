import { useField, useFormikContext } from 'formik';
import Image from 'next/image';
import { useState } from 'react';

import { TokenIcon } from '../../components/icons/TokenIcon';
import ChevronIcon from '../../images/icons/chevron-down.svg';
import { TransferFormValues } from '../transfer/types';

import { TokenSelectModal } from './TokenSelectModal';

type Props = {
  name: string;
  chainFieldName: string;
  onChange?: (tokenAddress: Address) => void;
};

export function TokenSelectField({ name, chainFieldName, onChange }: Props) {
  const { values } = useFormikContext<TransferFormValues>();
  const [field, , helpers] = useField<Address>(name);
  const sourceChainId = values[chainFieldName] as number;

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
          <span className="ml-3">{field.value || 'Select Token'}</span>
        </div>
        <Image src={ChevronIcon} width={12} height={8} alt="" />
      </button>
      <TokenSelectModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        onSelect={handleChange}
        sourceChainId={sourceChainId}
      />
    </>
  );
}
