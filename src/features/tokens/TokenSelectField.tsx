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

  // Keep local state in sync with formik state
  useEffect(() => {
    if (!values[name]) setToken(undefined);
    else if (values[name] !== token?.tokenCaip19Id) {
      setToken(undefined);
      setFieldValue(name, '');
    }
  }, [name, token, values, setFieldValue]);

  const handleChange = (newToken: TokenMetadata) => {
    // Set the token address value in formik state
    setFieldValue(name, newToken.tokenCaip19Id);
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
      <TokenButton token={token} name={name} disabled={disabled} onClick={onClick} />
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

// Use this instead when the token field should be auto-set based on the chain
export function AutomaticTokenField({
  name,
  originCaip2Id,
  destinationCaip2Id,
  tokenRoutes,
}: Props) {
  const { setFieldValue } = useFormikContext<TransferFormValues>();
  // Keep local state for token details, but let formik manage field value
  const [token, setToken] = useState<TokenMetadata | undefined>(undefined);

  // Derive token state from origin and dest
  useEffect(() => {
    const routes = getTokenRoutes(originCaip2Id, destinationCaip2Id, tokenRoutes);
    const tokenCaip19Id = routes.length ? routes[0].baseTokenCaip19Id : undefined;
    setFieldValue(name, tokenCaip19Id);
    setToken(tokenCaip19Id ? getToken(tokenCaip19Id) : undefined);
  }, [name, originCaip2Id, destinationCaip2Id, tokenRoutes, setFieldValue]);

  return <TokenButton token={token} name={name} disabled={true} isAutomatic={true} />;
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
