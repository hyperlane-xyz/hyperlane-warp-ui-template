import { useFormikContext } from 'formik';
import { useState } from 'react';

import { ChevronLargeIcon } from '../../../components/icons/ChevronLargeIcon';
import { TokenChainIcon } from '../../../components/icons/TokenChainIcon';
import { WARP_QUERY_PARAMS } from '../../../consts/args';
import { updateQueryParams } from '../../../utils/queryParams';
import { useMultiProvider } from '../../chains/hooks';
import { getChainDisplayName } from '../../chains/utils';
import type { SwapFormValues } from '../types';
import { getTokenByKeyFromMap, useTokenByKeyMap } from './hooks';
import type { TokenSelectionMode, UiToken } from './types';
import { UnifiedTokenChainModal } from './UnifiedTokenChainModal';

type Props = {
  selectionMode: TokenSelectionMode;
  disabled?: boolean;
};

// Reads source/destination token from form state via two paired fields
// (chainId + tokenAddress) and writes both atomically when the user
// picks one in the modal.
export function TokenSelectField({ selectionMode, disabled }: Props) {
  const { values, setFieldValue } = useFormikContext<SwapFormValues>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const tokenMap = useTokenByKeyMap();
  const multiProvider = useMultiProvider();

  const isOrigin = selectionMode === 'origin';
  const chainField = isOrigin ? 'srcChain' : 'dstChain';
  const tokenField = isOrigin ? 'srcToken' : 'dstToken';
  const counterpartChainField = isOrigin ? 'dstChain' : 'srcChain';
  const counterpartTokenField = isOrigin ? 'dstToken' : 'srcToken';

  const selectedKey =
    values[chainField] != null && values[tokenField]
      ? `${values[chainField]}-${values[tokenField].toLowerCase()}`
      : undefined;
  const counterpartKey =
    values[counterpartChainField] != null && values[counterpartTokenField]
      ? `${values[counterpartChainField]}-${values[counterpartTokenField].toLowerCase()}`
      : undefined;

  const selectedToken = getTokenByKeyFromMap(tokenMap, selectedKey);
  const counterpartToken = getTokenByKeyFromMap(tokenMap, counterpartKey);

  const handleSelectToken = (token: UiToken) => {
    setFieldValue(chainField, token.chainId);
    setFieldValue(tokenField, token.address);
    if (isOrigin) {
      // Reset amount when origin changes (warp UI does the same).
      setFieldValue('amount', '');
    }
    // Persist to URL so deep-linking matches the picked tokens.
    // Swap-side contract is chainName-address (see useFormInitialValues).
    updateQueryParams({
      [isOrigin ? WARP_QUERY_PARAMS.ORIGIN : WARP_QUERY_PARAMS.DESTINATION]: token.chainName,
      [isOrigin ? WARP_QUERY_PARAMS.ORIGIN_TOKEN : WARP_QUERY_PARAMS.DESTINATION_TOKEN]:
        token.address,
    });
  };

  const open = () => {
    if (!disabled) setIsModalOpen(true);
  };

  return (
    <>
      <TokenButton
        token={selectedToken}
        disabled={disabled}
        onClick={open}
        multiProvider={multiProvider}
        testId={`token-select-${selectionMode}`}
      />

      <UnifiedTokenChainModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        onSelect={handleSelectToken}
        selectionMode={selectionMode}
        counterpartToken={counterpartToken}
        recipient={values.recipient}
      />
    </>
  );
}

function TokenButton({
  token,
  disabled,
  onClick,
  multiProvider,
  testId,
}: {
  token?: UiToken;
  disabled?: boolean;
  onClick: () => void;
  multiProvider: ReturnType<typeof useMultiProvider>;
  testId?: string;
}) {
  const chainDisplayName = token ? getChainDisplayName(multiProvider, token.chainName) : '';
  const chainMetadata = token ? multiProvider.tryGetChainMetadata(token.chainName) : null;

  return (
    <button
      type="button"
      className={`${styles.base} ${disabled ? styles.disabled : styles.enabled}`}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      data-chain={token?.chainName}
      data-is-testnet={token ? String(!!chainMetadata?.isTestnet) : undefined}
    >
      {token ? (
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <TokenChainIcon token={token} size={36} />
          <div className="flex min-w-0 flex-col items-start">
            <span className="font-secondary text-lg font-normal text-gray-900 dark:text-foreground-primary">
              {token.symbol}
            </span>
            <span className="text-sm text-gray-900 dark:text-foreground-primary">
              {chainDisplayName}
            </span>
          </div>
        </div>
      ) : (
        <span className="text-sm text-gray-400 dark:text-foreground-secondary">Select token</span>
      )}
      <div className="transfer-token-chevron flex h-10 w-10 items-center justify-center rounded-full border border-gray-400 bg-white drop-shadow-button transition-colors duration-150 group-hover:bg-gray-50 dark:border-primary-300/35 dark:bg-primary-300/15 dark:text-foreground-primary dark:group-hover:bg-primary-300/[0.28] dark:[&_path]:fill-current">
        <ChevronLargeIcon width={14} height={18} />
      </div>
    </button>
  );
}

const styles = {
  base: 'transfer-token-field group flex w-full items-center justify-between rounded-[7px] border border-gray-400/25 px-1.5 py-2 shadow-sm transition-all duration-150 dark:border-primary-300/25 dark:bg-transparent dark:text-foreground-primary',
  enabled:
    'cursor-pointer hover:bg-gray-50 dark:hover:border-primary-300/50 dark:hover:bg-primary-300/[0.08]',
  disabled: 'cursor-not-allowed opacity-60',
};
