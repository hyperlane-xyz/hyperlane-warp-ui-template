import { useFormikContext } from 'formik';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { TokenIcon } from '../../components/icons/TokenIcon';
import ChevronIcon from '../../images/icons/chevron-down.svg';
import { isNonFungibleToken } from '../caip/tokens';
import { TransferFormValues } from '../transfer/types';

import { TokenListModal } from './TokenListModal';
import { getToken } from './metadata';
import { RoutesMap } from './routes/types';
import { getTokenRoutes } from './routes/utils';
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
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  // Keep local state for token details, but let formik manage field value
  const [token, setToken] = useState<TokenMetadata | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutomaticSelection, setIsAutomaticSelection] = useState(false);

  // Keep local state in sync with formik state
  useEffect(() => {
    const routes = getTokenRoutes(originCaip2Id, destinationCaip2Id, tokenRoutes);
    let newFieldValue: TokenCaip19Id | undefined = undefined;
    let newToken: TokenMetadata | undefined = undefined;
    let newIsAutomatic = true;
    if (routes.length === 1) {
      newFieldValue = routes[0].baseTokenCaip19Id;
      newToken = getToken(newFieldValue);
    } else if (routes.length > 1) {
      newFieldValue = values[name] || routes[0].baseTokenCaip19Id;
      newToken = getToken(newFieldValue!);
      newIsAutomatic = false;
    }
    setToken(newToken);
    setFieldValue(name, newFieldValue || '');
    setIsAutomaticSelection(newIsAutomatic);
  }, [name, token, values, originCaip2Id, destinationCaip2Id, tokenRoutes, setFieldValue]);

  const onSelectToken = (newToken: TokenMetadata) => {
    // Set the token address value in formik state
    setFieldValue(name, newToken.tokenCaip19Id);
    // reset amount after change token
    setFieldValue('amount', '');
    // Update local state
    setToken(newToken);
    // Update nft state in parent
    setIsNft(!!isNonFungibleToken(newToken.tokenCaip19Id));
  };

  const onClickField = () => {
    if (!disabled && !isAutomaticSelection) setIsModalOpen(true);
  };

  return (
    <>
      <TokenButton
        token={token}
        name={name}
        disabled={isAutomaticSelection || disabled}
        onClick={onClickField}
        isAutomatic={isAutomaticSelection}
      />
      <TokenListModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        onSelect={onSelectToken}
        originCaip2Id={originCaip2Id}
        destinationCaip2Id={destinationCaip2Id}
        tokenRoutes={tokenRoutes}
      />
    </>
  );
}

function TokenButton({
  token,
  name,
  disabled,
  onClick,
  isAutomatic,
}: {
  token?: TokenMetadata;
  name: string;
  disabled?: boolean;
  onClick?: () => void;
  isAutomatic?: boolean;
}) {
  return (
    <button
      type="button"
      name={name}
      className={`${styles.base} ${disabled ? styles.disabled : styles.enabled}`}
      onClick={onClick}
    >
      <div className="flex items-center">
        {token && <TokenIcon token={token} size={20} />}
        <span className={`ml-2 ${!token?.symbol && 'text-slate-400'}`}>
          {token?.symbol || (isAutomatic ? 'No routes available' : 'Select Token')}
        </span>
      </div>
      {!isAutomatic && <Image src={ChevronIcon} width={12} height={8} alt="" />}
    </button>
  );
}

const styles = {
  base: 'mt-1.5 w-full px-2.5 py-2 flex items-center justify-between text-sm rounded-full border border-mint-300 outline-none transition-colors duration-500',
  enabled: 'hover:bg-gray-50 active:bg-gray-100 focus:border-mint-500',
  disabled: 'bg-gray-100 cursor-default',
};
