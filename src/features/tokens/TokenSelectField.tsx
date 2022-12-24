import { useField, useFormikContext } from 'formik';
import Image from 'next/image';
import { useState } from 'react';

import { TokenIcon } from '../../components/icons/TokenIcon';
import ChevronIcon from '../../images/icons/chevron-down.svg';
import { TransferFormValues } from '../transfer/types';

import { TokenSelectModal } from './TokenSelectModal';
import { ListedToken } from './types';

type Props = {
  name: string;
  chainFieldName: string;
  disabled?: boolean;
};

export function TokenSelectField({ name, chainFieldName, disabled }: Props) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const [field, , helpers] = useField<Address>(name);
  const sourceChainId = values[chainFieldName] as number;

  // Keep local state for token details, but let formik manage field value
  const [token, setToken] = useState<ListedToken | undefined>(undefined);

  const handleChange = (newToken: ListedToken) => {
    // Set the token address value in formik state
    helpers.setValue(newToken.address);
    // And also set the collateral address
    setFieldValue('hypCollateralAddress', newToken.hypCollateralAddresses[0]);
    setToken(newToken);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);

  const onClick = () => {
    if (!disabled) setIsModalOpen(true);
  };

  return (
    <>
      <button
        type="button"
        name={field.name}
        className={`${styles.base} ${disabled ? styles.disabled : styles.enabled}`}
        onClick={onClick}
      >
        <div className="flex items-center">
          <TokenIcon token={token} size={20} />
          <span className="ml-3">{token?.symbol || 'Select Token'}</span>
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

const styles = {
  base: 'mt-1.5 w-full px-2.5 py-2 flex items-center justify-between text-sm bg-white rounded border border-gray-400 outline-none transition-colors duration-500',
  enabled: 'hover:bg-gray-50 active:bg-gray-100 focus:border-blue-500',
  disabled: 'bg-gray-150 cursor-default',
};
