import { useField, useFormikContext } from 'formik';
import { useState } from 'react';

import { ChevronLargeIcon } from '../../../components/icons/ChevronLargeIcon';
import { TokenChainIcon } from '../../../components/icons/TokenChainIcon';
import { WARP_QUERY_PARAMS } from '../../../consts/args';
import { updateQueryParams } from '../../../utils/queryParams';
import { useMultiProvider } from '../../chains/hooks';
import { getChainDisplayName } from '../../chains/utils';
import { shouldClearAddress } from '../../transfer/utils';
import type { UnifiedFormValues } from '../types';
import { getUnifiedTokenQueryRef } from './queryParams';
import type { UnifiedToken } from './types';
import { UnifiedTokenChainModal } from './UnifiedTokenChainModal';

type Props = {
  name: keyof Pick<UnifiedFormValues, 'originTokenKey' | 'destinationTokenKey'>;
  selectionMode: 'origin' | 'destination';
  tokenMap: Map<string, UnifiedToken>;
  disabled?: boolean;
  engineEnabled: boolean;
};

export function TokenSelectField({
  name,
  selectionMode,
  tokenMap,
  disabled,
  engineEnabled,
}: Props) {
  const { values, setFieldValue } = useFormikContext<UnifiedFormValues>();
  const [{ value: tokenKey }, , { setValue: setTokenKey }] = useField<string | undefined>(name);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const selectedToken = tokenKey ? tokenMap.get(tokenKey) : undefined;
  const counterpartKey =
    selectionMode === 'origin' ? values.destinationTokenKey : values.originTokenKey;
  const counterpartToken = counterpartKey ? tokenMap.get(counterpartKey) : undefined;
  const multiProvider = useMultiProvider();

  const handleSelectToken = (token: UnifiedToken) => {
    setTokenKey(token.key);
    if (selectionMode === 'origin') setFieldValue('amount', '');
    if (
      selectionMode === 'destination' &&
      shouldClearAddress(multiProvider, values.recipient, token.chainName)
    ) {
      setFieldValue('recipient', '');
    }

    updateQueryParams({
      [selectionMode === 'origin' ? WARP_QUERY_PARAMS.ORIGIN : WARP_QUERY_PARAMS.DESTINATION]:
        token.chainName,
      [selectionMode === 'origin'
        ? WARP_QUERY_PARAMS.ORIGIN_TOKEN
        : WARP_QUERY_PARAMS.DESTINATION_TOKEN]: getUnifiedTokenQueryRef(token),
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
        engineEnabled={engineEnabled}
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
  token?: UnifiedToken;
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
