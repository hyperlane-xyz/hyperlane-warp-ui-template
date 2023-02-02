import { useField } from 'formik';
import Image from 'next/image';
import { useState } from 'react';

import { ChainLogo } from '@hyperlane-xyz/widgets';

import ChevronIcon from '../../images/icons/chevron-down.svg';

import { ChainSelectListModal } from './ChainSelectModal';
import { getChainDisplayName } from './metadata';

type Props = {
  name: string;
  label: string;
  chainIds: number[];
  onChange?: (chainId: number) => void;
  disabled?: boolean;
};

export function ChainSelectField({ name, label, chainIds, onChange, disabled }: Props) {
  const [field, , helpers] = useField<number>(name);

  const handleChange = (newChainId: number) => {
    helpers.setValue(newChainId);
    if (onChange) onChange(newChainId);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);

  const onClick = () => {
    if (!disabled) setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center justify-center rounded-full bg-gray-100 h-[5.5rem] w-[5.5rem] p-1.5">
        <div className="flex items-end h-11">
          <ChainLogo chainId={field.value} size={34} />
        </div>
        <label htmlFor={name} className="mt-2 mb-1 text-sm text-gray-500 uppercase">
          {label}
        </label>
      </div>
      <button
        type="button"
        name={field.name}
        className={`${styles.base} ${disabled ? styles.disabled : styles.enabled}`}
        onClick={onClick}
      >
        <div className="flex items-center">
          <ChainLogo chainId={field.value} size={14} />
          <span className="ml-2">{getChainDisplayName(field.value, true)}</span>
        </div>
        <Image src={ChevronIcon} width={12} height={8} alt="" />
      </button>
      <ChainSelectListModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        chainIds={chainIds}
        onSelect={handleChange}
      />
    </div>
  );
}

const styles = {
  base: 'w-36 px-2.5 py-2 relative -top-1.5 flex items-center justify-between text-sm bg-white rounded border border-gray-400 outline-none transition-colors duration-500',
  enabled: 'hover:bg-gray-50 active:bg-gray-100 focus:border-blue-500',
  disabled: 'bg-gray-150 cursor-default',
};
