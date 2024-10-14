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
    <div className="flex-[4]">
      <button
        type="button"
        name={field.name}
        className={`${styles.base} ${disabled ? styles.disabled : styles.enabled}`}
        onClick={onClick}
      >
        <div className="flex items-center gap-3">
          <div className="max-w-[1.4rem] sm:max-w-fit">
            <ChainLogo chainName={field.value} size={32} />
          </div>
          <div className="flex flex-col items-start gap-1">
            <label htmlFor={name} className="text-xs text-gray-600">
              {label}
            </label>
            {getChainDisplayName(field.value, true)}
          </div>
        </div>
        <Image src={ChevronIcon} width={12} height={8} alt="" />
      </button>
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
  base: 'px-2 py-1.5 w-full flex items-center justify-between text-sm bg-white rounded-lg border border-primary-300 outline-none transition-colors duration-500',
  enabled: 'hover:bg-gray-100 active:scale-95 focus:border-primary-500',
  disabled: 'bg-gray-150 cursor-default',
};
