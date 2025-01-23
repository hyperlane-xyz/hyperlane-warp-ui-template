import { IToken } from '@hyperlane-xyz/sdk';
import { tryParseAmount } from '@hyperlane-xyz/utils';
import { ChevronIcon } from '@hyperlane-xyz/widgets';
import { useField, useFormikContext } from 'formik';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { TokenIcon } from '../../components/icons/TokenIcon';
import { TransferFormValues } from '../transfer/types';
import { TokenListModal } from './TokenListModal';
import { getIndexForToken, getTokenByIndex, useWarpCore } from './hooks';

type Props = {
  name: string;
  disabled?: boolean;
  setIsNft: (value: boolean) => void;
};

export function TokenSelectField({ name, disabled, setIsNft }: Props) {
  const { values } = useFormikContext<TransferFormValues>();
  const [field, , helpers] = useField<number | undefined>(name);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutomaticSelection, setIsAutomaticSelection] = useState(false);
  const { query } = useRouter();

  const warpCore = useWarpCore();

  const { origin, destination } = values;
  useEffect(() => {
    const tokensWithRoute = warpCore.getTokensForRoute(origin, destination);
    let newFieldValue: number | undefined;
    let newIsAutomatic: boolean;

    // Use token from persistance
    if (query.token && typeof query.token === 'string') {
      // Check if tokenIndex exists
      const tokenIndex = tryParseAmount(query.token)?.toNumber();
      if (tokenIndex !== undefined) {
        const token = warpCore.tokens[tokenIndex];
        newFieldValue = token ? tokenIndex : undefined;
      }
    }
    // No tokens available for this route
    else if (tokensWithRoute.length === 0) {
      newFieldValue = undefined;
    }
    // Exactly one found
    else if (tokensWithRoute.length === 1) {
      newFieldValue = getIndexForToken(warpCore, tokensWithRoute[0]);
      // Multiple possibilities
    } else {
      newFieldValue = undefined;
    }

    if (tokensWithRoute.length <= 1) newIsAutomatic = true;
    else newIsAutomatic = false;

    helpers.setValue(newFieldValue);
    setIsAutomaticSelection(newIsAutomatic);
  }, [warpCore, origin, destination, helpers, query.token]);

  const onSelectToken = (newToken: IToken) => {
    // Set the token address value in formik state
    helpers.setValue(getIndexForToken(warpCore, newToken));
    // Update nft state in parent
    setIsNft(newToken.isNft());
  };

  const onClickField = () => {
    if (!disabled && !isAutomaticSelection) setIsModalOpen(true);
  };

  return (
    <>
      <TokenButton
        token={getTokenByIndex(warpCore, field.value)}
        disabled={isAutomaticSelection || disabled}
        onClick={onClickField}
        isAutomatic={isAutomaticSelection}
      />
      <TokenListModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        onSelect={onSelectToken}
        origin={values.origin}
        destination={values.destination}
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
  token?: IToken;
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
      {!isAutomatic && <ChevronIcon width={12} height={8} direction="s" />}
    </button>
  );
}

const styles = {
  base: 'mt-1.5 w-full px-2.5 py-2.5 flex items-center justify-between text-sm rounded-lg border border-primary-300 outline-none transition-colors duration-500',
  enabled: 'hover:bg-gray-100 active:scale-95 focus:border-primary-500',
  disabled: 'bg-gray-100 cursor-default',
};
