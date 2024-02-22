import { useFormikContext } from 'formik';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { Token } from '@hyperlane-xyz/sdk';

import { TokenIcon } from '../../components/icons/TokenIcon';
import { getWarpCore } from '../../context/context';
import ChevronIcon from '../../images/icons/chevron-down.svg';
import { TransferFormValues } from '../transfer/types';

import { TokenListModal } from './TokenListModal';

type Props = {
  name: string;
  origin: ChainName;
  destination: ChainName;
  disabled?: boolean;
  setIsNft: (value: boolean) => void;
};

export function TokenSelectField({ name, origin, destination, disabled, setIsNft }: Props) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutomaticSelection, setIsAutomaticSelection] = useState(false);

  useEffect(() => {
    const tokensWithRoute = getWarpCore().getTokensForRoute(origin, destination);
    let newFieldValue: Token | undefined = undefined;
    let newIsAutomatic = false;
    if (tokensWithRoute.length === 1) {
      newFieldValue = tokensWithRoute[0];
      newIsAutomatic = true;
    }
    setFieldValue(name, newFieldValue);
    setIsAutomaticSelection(newIsAutomatic);
  }, [name, values, origin, destination, setFieldValue]);

  const onSelectToken = (newToken: Token) => {
    // Set the token address value in formik state
    setFieldValue(name, newToken);
    // Update nft state in parent
    setIsNft(newToken.isNft());
  };

  const onClickField = () => {
    if (!disabled && !isAutomaticSelection) setIsModalOpen(true);
  };

  return (
    <>
      <TokenButton
        token={values[name]}
        disabled={isAutomaticSelection || disabled}
        onClick={onClickField}
        isAutomatic={isAutomaticSelection}
      />
      <TokenListModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        onSelect={onSelectToken}
        origin={origin}
        destination={destination}
      />
    </>
  );
}

function TokenButton({
  token,
  disabled,
  onClick,
  isAutomatic,
}: {
  token?: Token;
  disabled?: boolean;
  onClick?: () => void;
  isAutomatic?: boolean;
}) {
  return (
    <button
      type="button"
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
  base: 'mt-1.5 w-full px-2.5 py-2 flex items-center justify-between text-sm rounded-full border border-blue-300 outline-none transition-colors duration-500',
  enabled: 'hover:bg-gray-50 active:bg-gray-100 focus:border-blue-500',
  disabled: 'bg-gray-100 cursor-default',
};
