import { useField, useFormikContext } from 'formik';
import Image from 'next/image';
import { useState } from 'react';

import { ChainLogo } from '../../components/icons/ChainLogo';
import ChevronIcon from '../../images/icons/chevron-down.svg';
import { RoutesMap } from '../tokens/routes/types';
import { TransferFormValues } from '../transfer/types';

import { ChainSelectListModal } from './ChainSelectModal';
import { getChainDisplayName } from './utils';

type Props = {
  name: string;
  label: string;
  caip2Ids: Caip2Id[];
  onChange?: (id: Caip2Id) => void;
  disabled?: boolean;
  selectedCaip2Id: Caip2Id;
  tokenRoutes: RoutesMap;
};

export function ChainSelectField({
  name,
  label,
  caip2Ids,
  onChange,
  disabled,
  selectedCaip2Id,
  tokenRoutes,
}: Props) {
  const [field, , helpers] = useField<Caip2Id>(name);
  const { setFieldValue } = useFormikContext<TransferFormValues>();

  const handleChange = (newChainId: Caip2Id) => {
    helpers.setValue(newChainId);
    // Reset other fields on chain change
    setFieldValue('tokenCaip19Id', '');
    setFieldValue('recipientAddress', '');
    setFieldValue('amount', '');
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
          <ChainLogo caip2Id={field.value} size={34} />
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
          <ChainLogo caip2Id={field.value} size={14} />
          <span className="ml-2">{getChainDisplayName(field.value, true)}</span>
        </div>
        <Image src={ChevronIcon} width={12} height={8} alt="" />
      </button>
      <ChainSelectListModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        caip2Ids={caip2Ids}
        onSelect={handleChange}
        selectedCaip2Id={selectedCaip2Id}
        tokenRoutes={tokenRoutes}
      />
    </div>
  );
}

const styles = {
  base: 'w-36 px-2.5 py-2 relative -top-1.5 flex items-center justify-between text-sm bg-white rounded border border-gray-400 outline-none transition-colors duration-500',
  enabled: 'hover:bg-gray-50 active:bg-gray-100 focus:border-blue-500',
  disabled: 'bg-gray-150 cursor-default',
};
