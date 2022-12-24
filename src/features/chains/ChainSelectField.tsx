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
  disabled?: boolean;
};

export function ChainSelectField({ name, label, onChange, disabled }: Props) {
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
      <div className="flex flex-col items-center justify-center rounded-full bg-gray-100 h-[6rem] w-[6rem] p-1.5">
        <div className="flex items-end h-11">
          <ChainIcon chainId={field.value} size={32} />
        </div>
        <label htmlFor={name} className="mt-2.5 text-sm text-gray-500 uppercase">
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

const styles = {
  base: 'w-36 px-2.5 py-2 relative -top-1.5 flex items-center justify-between text-sm bg-white rounded border border-gray-400 outline-none transition-colors duration-500',
  enabled: 'hover:bg-gray-50 active:bg-gray-100 focus:border-blue-500',
  disabled: 'bg-gray-150 cursor-default',
};
