import { useField, useFormikContext } from 'formik';
import Image from 'next/image';
import { useState } from 'react';

import { ChainLogo } from '../../components/icons/ChainLogo';
import ChevronIcon from '../../images/icons/chevron-down.svg';
import { TransferFormValues } from '../transfer/types';

import { ChainSelectListModal } from './ChainSelectModal';
import { getChainDisplayName } from './utils';

type Props = {
  name: string;
  label: string;
  chains: ChainName[];
  onChange?: (id: ChainName) => void;
  disabled?: boolean;
};

export function ChainSelectField({ name, label, chains, onChange, disabled }: Props) {
  const [field, , helpers] = useField<ChainName>(name);
  const { setFieldValue } = useFormikContext<TransferFormValues>();

  const handleChange = (newChainId: ChainName) => {
    helpers.setValue(newChainId);
    // Reset other fields on chain change
    setFieldValue('recipient', '');
    setFieldValue('amount', '');
    setFieldValue('tokenIndex', undefined);
    if (onChange) onChange(newChainId);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);

  const onClick = () => {
    if (!disabled) setIsModalOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-center gap-2">
        <ChainLogo chainName={field.value} size={36} />
        <div className="flex flex-col gap-1">
          <label htmlFor={name} className="pl-2 text-xs text-gray-700 uppercase">
            {label}
          </label>
          <button
            type="button"
            name={field.name}
            className={`${styles.base} ${disabled ? styles.disabled : styles.enabled}`}
            onClick={onClick}
          >
            {getChainDisplayName(field.value, true)}
            <Image src={ChevronIcon} width={12} height={8} alt="" />
          </button>
        </div>
      </div>
      <ChainSelectListModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        chains={chains}
        onSelect={handleChange}
      />
    </div>
  );
}

const styles = {
  base: 'w-36 px-3 py-1.5 flex items-center justify-between text-sm bg-white rounded-full border border-primary-300 outline-none transition-colors duration-500',
  enabled: 'hover:bg-gray-50 active:bg-gray-100 focus:border-primary-500',
  disabled: 'bg-gray-150 cursor-default',
};
