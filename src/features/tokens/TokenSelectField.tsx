import { IToken } from '@hyperlane-xyz/sdk';
import { ChevronIcon } from '@hyperlane-xyz/widgets';
import { useField, useFormikContext } from 'formik';
import { useEffect, useState } from 'react';
import { TokenIcon } from '../../components/icons/TokenIcon';

import { WARP_QUERY_PARAMS } from '../../consts/args';
import { updateQueryParam, updateQueryParams } from '../../utils/queryParams';
import { TransferFormValues } from '../transfer/types';
import { TokenListModal } from './TokenListModal';
import { getIndexForToken, getTokenByIndex, getTokenIndexFromChains, useWarpCore } from './hooks';

type Props = {
  name: string;
  disabled?: boolean;
  setIsNft: (value: boolean) => void;
};

export function TokenSelectField({ name, disabled, setIsNft }: Props) {
  const { values, setValues } = useFormikContext<TransferFormValues>();
  const [field, , helpers] = useField<number | undefined>(name);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutomaticSelection, setIsAutomaticSelection] = useState(false);

  const warpCore = useWarpCore();

  const { origin, destination } = values;
  useEffect(() => {
    const tokensWithRoute = warpCore.getTokensForRoute(origin, destination);
    setIsAutomaticSelection(tokensWithRoute.length <= 1);
  }, [warpCore, origin, destination, helpers]);

  const onSelectToken = (newToken: IToken) => {
    // Set the token address value in formik state
    helpers.setValue(getIndexForToken(warpCore, newToken));
    updateQueryParam(WARP_QUERY_PARAMS.TOKEN, newToken.addressOrDenom);
    // Update nft state in parent
    setIsNft(newToken.isNft());
  };

  const onClickField = () => {
    if (!disabled) setIsModalOpen(true);
  };

  // Set the token and origin from the selected field and the destination
  // chain from the the first connection in the token
  const onSelectUnsupportedRoute = (token: IToken, origin: string) => {
    if (!token.connections) return;
    const destination = token.connections[0].token.chainName;

    setValues({
      ...values,
      origin,
      destination,
      tokenIndex: getTokenIndexFromChains(warpCore, token.addressOrDenom, origin, destination),
    });
    updateQueryParams({
      [WARP_QUERY_PARAMS.ORIGIN]: origin,
      [WARP_QUERY_PARAMS.DESTINATION]: destination,
      [WARP_QUERY_PARAMS.TOKEN]: token.addressOrDenom,
    });
  };

  return (
    <>
      <TokenButton
        token={getTokenByIndex(warpCore, field.value)}
        disabled={disabled}
        onClick={onClickField}
        isAutomatic={isAutomaticSelection}
      />
      <TokenListModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        onSelect={onSelectToken}
        origin={values.origin}
        destination={values.destination}
        onSelectUnsupportedRoute={onSelectUnsupportedRoute}
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
      <ChevronIcon width={12} height={8} direction="s" />
    </button>
  );
}

const styles = {
  base: 'mt-1.5 w-full px-2.5 py-2.5 flex items-center justify-between text-sm rounded-lg border border-primary-300 outline-none transition-colors duration-500',
  enabled: 'hover:bg-gray-100 active:scale-95 focus:border-primary-500',
  disabled: 'bg-gray-100 cursor-default',
};
