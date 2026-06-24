import { useFormikContext } from 'formik';
import { useState } from 'react';

import { ChevronLargeIcon } from '../../../components/icons/ChevronLargeIcon';
import { TokenChainIcon } from '../../../components/icons/TokenChainIcon';
import { WARP_QUERY_PARAMS } from '../../../consts/args';
import { updateQueryParams } from '../../../utils/queryParams';
import { useMultiProvider } from '../../chains/hooks';
import { getChainDisplayName } from '../../chains/utils';
import type { SwapFormValues } from '../../swap/types';
import type { CombinedToken } from '../types';
import { MergedTokenChainModal } from './MergedTokenChainModal';

type SelectionMode = 'origin' | 'destination';

interface Props {
  selectionMode: SelectionMode;
  disabled?: boolean;
  // WarpCore destination tokens to include in the destination picker.
  // Only meaningful when selectionMode === 'destination'.
  extraTokens?: CombinedToken[];
  // The currently selected CombinedToken on this side (resolved by parent).
  selectedToken?: CombinedToken;
  // The counterpart token (for route availability hints).
  counterpartToken?: CombinedToken;
}

// Form field backed by SwapFormValues (srcChain/srcToken or dstChain/dstToken).
// Opens the MergedTokenChainModal that lists both engine + WarpCore tokens.
export function MergedTokenSelectField({
  selectionMode,
  disabled,
  extraTokens,
  selectedToken,
  counterpartToken,
}: Props) {
  const { values, setFieldValue } = useFormikContext<SwapFormValues>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const multiProvider = useMultiProvider();

  const isOrigin = selectionMode === 'origin';

  const handleSelectToken = (token: CombinedToken) => {
    const chainField = isOrigin ? 'srcChain' : 'dstChain';
    const tokenField = isOrigin ? 'srcToken' : 'dstToken';

    setFieldValue(chainField, token.chainId);
    setFieldValue(tokenField, token.address);
    if (isOrigin) setFieldValue('amount', '');

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
      <MergedTokenChainModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        onSelect={handleSelectToken}
        selectionMode={selectionMode}
        counterpartToken={counterpartToken}
        extraTokens={extraTokens}
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
  token?: CombinedToken;
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
      className={`transfer-token-field group flex w-full items-center justify-between rounded-[7px] border border-gray-400/25 px-1.5 py-2 shadow-sm transition-all duration-150 dark:border-primary-300/25 dark:bg-transparent dark:text-foreground-primary ${
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'cursor-pointer hover:bg-gray-50 dark:hover:border-primary-300/50 dark:hover:bg-primary-300/[0.08]'
      }`}
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
