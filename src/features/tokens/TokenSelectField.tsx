import { useField, useFormikContext } from 'formik';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { TokenIcon } from '../../components/icons/TokenIcon';
import ChevronIcon from '../../images/icons/chevron-down.svg';
import { isNonFungibleToken } from '../caip/tokens';
import { TransferFormValues } from '../transfer/types';

import { TokenListModal } from './TokenListModal';
import { RoutesMap } from './routes/types';
import { TokenMetadata } from './types';

type Props = {
  name: string;
  originCaip2Id: ChainCaip2Id;
  destinationCaip2Id: ChainCaip2Id;
  tokenRoutes: RoutesMap;
  disabled?: boolean;
  setIsNft: (value: boolean) => void;
};

export function TokenSelectField({
  name,
  originCaip2Id,
  destinationCaip2Id,
  tokenRoutes,
  disabled,
  setIsNft,
}: Props) {
  const [field, , helpers] = useField<Address>(name);
  const { setFieldValue } = useFormikContext<TransferFormValues>();

  // Keep local state for token details, but let formik manage field value
  const [token, setToken] = useState<TokenMetadata | undefined>(undefined);

  // Keep local state in sync with formik state
  useEffect(() => {
    if (!field.value) setToken(undefined);
    else if (field.value !== token?.tokenCaip19Id) {
      setToken(undefined);
      helpers.setValue('');
    }
  }, [token, field.value, helpers]);

  const handleChange = (newToken: TokenMetadata) => {
    // Set the token address value in formik state
    helpers.setValue(newToken.tokenCaip19Id);
    // reset amount after change token
    setFieldValue('amount', '');
    // Update local state
    setToken(newToken);
    // Update nft state in parent
    setIsNft(!!isNonFungibleToken(newToken.tokenCaip19Id));
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
          <span className={`ml-2 ${!token?.symbol && 'text-slate-400'}`}>
            {token?.symbol || 'Select Token'}
          </span>
        </div>
        <Image src={ChevronIcon} width={12} height={8} alt="" />
      </button>
      <TokenListModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        onSelect={handleChange}
        originCaip2Id={originCaip2Id}
        destinationCaip2Id={destinationCaip2Id}
        tokenRoutes={tokenRoutes}
      />
    </>
  );
}

const styles = {
  base: 'mt-1.5 w-full px-2.5 py-2 flex items-center justify-between text-sm bg-white rounded border border-gray-400 outline-none transition-colors duration-500',
  enabled: 'hover:bg-gray-50 active:bg-gray-100 focus:border-blue-500',
  disabled: 'bg-gray-150 cursor-default',
};
