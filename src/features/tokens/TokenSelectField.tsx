import { Token } from '@hyperlane-xyz/sdk';
import { ChevronIcon } from '@hyperlane-xyz/widgets';
import { useField, useFormikContext } from 'formik';
import { useState } from 'react';
import { WARP_QUERY_PARAMS } from '../../consts/args';
import { updateQueryParams } from '../../utils/queryParams';
import { trackTokenSelectionEvent } from '../analytics/utils';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { TransferFormValues } from '../transfer/types';
import { getTokenByKey, useTokens } from './hooks';
import { TokenChainIcon } from './TokenChainIcon';
import { TokenSelectionMode } from './types';
import { UnifiedTokenChainModal } from './UnifiedTokenChainModal';
import { getTokenKey } from './utils';

type Props = {
  name: string;
  label?: string;
  selectionMode: TokenSelectionMode;
  disabled?: boolean;
  setIsNft?: (value: boolean) => void;
  showLabel?: boolean;
};

export function TokenSelectField({
  name,
  label,
  selectionMode,
  disabled,
  setIsNft,
  showLabel = true,
}: Props) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const [field, , helpers] = useField<string | undefined>(name);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const multiProvider = useMultiProvider();
  const tokens = useTokens();

  // Get the current token
  const token = getTokenByKey(tokens, field.value);

  // Get the counterpart token (destination when selecting origin, origin when selecting destination)
  const counterpartToken =
    selectionMode === 'origin'
      ? getTokenByKey(tokens, values.destinationTokenKey)
      : getTokenByKey(tokens, values.originTokenKey);

  const onSelectToken = (newToken: Token) => {
    const newTokenKey = getTokenKey(newToken);
    helpers.setValue(newTokenKey);

    // Track analytics - derive origin and destination from current tokens
    const originToken = getTokenByKey(tokens, values.originTokenKey);
    const destToken = getTokenByKey(tokens, values.destinationTokenKey);
    const origin = selectionMode === 'origin' ? newToken.chainName : originToken?.chainName || '';
    const destination =
      selectionMode === 'destination' ? newToken.chainName : destToken?.chainName || '';
    trackTokenSelectionEvent(newToken, origin, destination, multiProvider);

    // Update URL query params based on selection mode
    if (selectionMode === 'origin') {
      setFieldValue('amount', '');
      updateQueryParams({
        [WARP_QUERY_PARAMS.ORIGIN]: newToken.chainName,
        [WARP_QUERY_PARAMS.ORIGIN_TOKEN]: newToken.symbol,
      });
    } else {
      updateQueryParams({
        [WARP_QUERY_PARAMS.DESTINATION]: newToken.chainName,
        [WARP_QUERY_PARAMS.DESTINATION_TOKEN]: newToken.symbol,
      });
    }

    // Update NFT state if callback provided
    if (setIsNft) {
      setIsNft(newToken.isNft());
    }
  };

  const onClickField = () => {
    if (!disabled) setIsModalOpen(true);
  };

  return (
    <>
      <div className="flex flex-col">
        {showLabel && label && (
          <label htmlFor={name} className="mb-1 pl-0.5 text-sm text-gray-600">
            {label}
          </label>
        )}
        <TokenButton
          token={token}
          disabled={disabled}
          onClick={onClickField}
          multiProvider={multiProvider}
        />
      </div>

      <UnifiedTokenChainModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        onSelect={onSelectToken}
        selectionMode={selectionMode}
        counterpartToken={counterpartToken}
      />
    </>
  );
}

function TokenButton({
  token,
  disabled,
  onClick,
  multiProvider,
}: {
  token?: Token;
  disabled?: boolean;
  onClick: () => void;
  multiProvider: ReturnType<typeof useMultiProvider>;
}) {
  const chainDisplayName = token ? getChainDisplayName(multiProvider, token.chainName) : '';

  return (
    <button
      type="button"
      className={`${styles.base} ${disabled ? styles.disabled : styles.enabled}`}
      onClick={onClick}
      disabled={disabled}
    >
      {token ? (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <TokenChainIcon token={token} size={44} />
          <div className="flex min-w-0 flex-col items-start">
            <span className="text-lg font-semibold text-gray-900">{token.symbol}</span>
            <span className="text-sm text-gray-500">{chainDisplayName}</span>
          </div>
        </div>
      ) : (
        <span className="text-sm text-gray-400">Select token</span>
      )}
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-400 bg-white drop-shadow-button">
        <ChevronIcon width={14} height={10} direction="e" className="text-gray-600" />
      </div>
    </button>
  );
}

const styles = {
  base: 'w-full py-3 flex items-center justify-between transition-all',
  enabled: '',
  disabled: 'cursor-not-allowed opacity-60',
};
