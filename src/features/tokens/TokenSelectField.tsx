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
import { useDestinationTokens, useOriginTokens } from './hooks';
import { TokenChainIcon } from './TokenChainIcon';
import { UnifiedTokenChainModal } from './UnifiedTokenChainModal';
import { getTokenKey } from './utils';

type Props = {
  name: string;
  label: string;
  selectionMode: 'origin' | 'destination';
  disabled?: boolean;
  setIsNft?: (value: boolean) => void;
};

export function TokenSelectField({ name, label, selectionMode, disabled, setIsNft }: Props) {
  const { values } = useFormikContext<TransferFormValues>();
  const [field, , helpers] = useField<string | undefined>(name);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const multiProvider = useMultiProvider();
  const originTokens = useOriginTokens();
  const destinationTokens = useDestinationTokens();

  // Get the current token from the appropriate array based on selection mode
  const tokens = selectionMode === 'origin' ? originTokens : destinationTokens;
  const token = getTokenByKey(tokens, field.value);

  const onSelectToken = (newToken: Token) => {
    const newTokenKey = getTokenKey(newToken);
    helpers.setValue(newTokenKey);

    // Track analytics - derive origin and destination from current tokens
    const originToken = getTokenByKey(originTokens, values.originTokenKey);
    const destToken = getTokenByKey(destinationTokens, values.destinationTokenKey);
    const origin = selectionMode === 'origin' ? newToken.chainName : originToken?.chainName || '';
    const destination =
      selectionMode === 'destination' ? newToken.chainName : destToken?.chainName || '';
    trackTokenSelectionEvent(newToken, origin, destination, multiProvider);

    // Update URL query params based on selection mode
    if (selectionMode === 'origin') {
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
        <label htmlFor={name} className="mb-1 pl-0.5 text-sm text-gray-600">
          {label}
        </label>
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
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <TokenChainIcon token={token} size={24} />
          <div className="flex min-w-0 flex-col items-start">
            <span className="text-sm font-medium text-gray-900">{token.symbol}</span>
            <span className="text-xs text-gray-500">{chainDisplayName}</span>
          </div>
        </div>
      ) : (
        <span className="text-sm text-gray-400">Select token</span>
      )}
      <ChevronIcon width={12} height={8} direction="s" className="ml-2 opacity-60" />
    </button>
  );
}

// Helper to get token from array by key
function getTokenByKey(tokens: Token[], key: string | undefined): Token | undefined {
  if (!key) return undefined;
  return tokens.find((t) => getTokenKey(t) === key);
}

const styles = {
  base: 'w-full px-3 py-2.5 flex items-center justify-between rounded-lg border border-gray-300 bg-white transition-all',
  enabled: 'hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
  disabled: 'bg-gray-100 cursor-not-allowed opacity-60',
};
