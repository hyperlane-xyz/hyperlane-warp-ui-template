import { isValidAddress } from '@hyperlane-xyz/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useFormikContext } from 'formik';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';

import { ChevronLargeIcon } from '../../components/icons/ChevronLargeIcon';
import { TokenChainIcon } from '../../components/icons/TokenChainIcon';
import { WARP_QUERY_PARAMS } from '../../consts/args';
<<<<<<< HEAD
import { updateQueryParam, updateQueryParams } from '../../utils/queryParams';
import { trackTokenSelectionEvent } from '../analytics/utils';
import { useMultiProvider } from '../chains/hooks';
import { TransferFormValues } from '../transfer/types';
import { TokenListModal } from './TokenListModal';
import { getIndexForToken, getTokenByIndex, getTokenIndexFromChains, useWarpCore } from './hooks';
=======
import { logger } from '../../utils/logger';
import { updateQueryParams } from '../../utils/queryParams';
import { trackTokenSelectionEvent } from '../analytics/utils';
import { useChains } from '../api/hooks';
import { routerClient } from '../api/RouterClient';
import { ChainEditModal } from '../chains/ChainEditModal';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { useStore } from '../store';
import type { TransferFormValues } from '../transfer/engine/types';
import {
  AVAILABLE_ROUTES_STALE_TIME,
  getAvailableRoutesQuery,
  getAvailableRoutesQueryKey,
  getTokenByKeyFromMap,
  useTokenByKeyMap,
} from './hooks';
import type { TokenSelectionMode, UiToken } from './types';
import { tokenDiscoveryToUi } from './types';
import { UnifiedTokenChainModal } from './UnifiedTokenChainModal';
import { getRoutePrefillToken, tokenKey } from './utils';
>>>>>>> origin/main

type Props = {
  selectionMode: TokenSelectionMode;
  hasSelectedDestinationTokenRef: MutableRefObject<boolean>;
  disabled?: boolean;
};

// Reads source/destination token from form state via two paired fields
// (chainId + tokenAddress) and writes both atomically when the user
// picks one in the modal.
export function TokenSelectField({
  selectionMode,
  hasSelectedDestinationTokenRef,
  disabled,
}: Props) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChain, setEditingChain] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const tokenMap = useTokenByKeyMap();
  const multiProvider = useMultiProvider();
  const { data: chainsResp } = useChains();
  const syncTokens = useStore((s) => s.syncTokens);
  const latestOriginSelectionRef = useRef<string | undefined>(undefined);
  const latestCounterpartKeyRef = useRef<string | undefined>(undefined);
  const latestRecipientRef = useRef(values.recipient);

<<<<<<< HEAD
  const warpCore = useWarpCore();
  const multiProvider = useMultiProvider();
=======
  const isOrigin = selectionMode === 'origin';
  const chainField = isOrigin ? 'srcChain' : 'dstChain';
  const tokenField = isOrigin ? 'srcToken' : 'dstToken';
  const counterpartChainField = isOrigin ? 'dstChain' : 'srcChain';
  const counterpartTokenField = isOrigin ? 'dstToken' : 'srcToken';
>>>>>>> origin/main

  const selectedKey =
    values[chainField] != null && values[tokenField]
      ? tokenKey(values[chainField], values[tokenField])
      : undefined;
  const counterpartKey =
    values[counterpartChainField] != null && values[counterpartTokenField]
      ? tokenKey(values[counterpartChainField], values[counterpartTokenField])
      : undefined;

  const selectedToken = getTokenByKeyFromMap(tokenMap, selectedKey);
  const counterpartToken = getTokenByKeyFromMap(tokenMap, counterpartKey);
  useEffect(() => {
    latestCounterpartKeyRef.current = counterpartKey;
  }, [counterpartKey]);
  useEffect(() => {
    latestRecipientRef.current = values.recipient;
  }, [values.recipient]);
  const chainIdToName = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of chainsResp?.chains ?? []) map.set(c.id, c.chainName);
    return map;
  }, [chainsResp]);

<<<<<<< HEAD
  const onSelectToken = (newToken: IToken) => {
    // Set the token address value in formik state
    helpers.setValue(getIndexForToken(warpCore, newToken));

    // token selection event
    trackTokenSelectionEvent(newToken, origin, destination, multiProvider);

    updateQueryParam(WARP_QUERY_PARAMS.TOKEN, newToken.symbol);
    // Update nft state in parent
    setIsNft(newToken.isNft());
=======
  const handleSelectToken = (token: UiToken) => {
    setFieldValue(chainField, token.chainId);
    setFieldValue(tokenField, token.address);
    trackTokenSelectionEvent(
      selectionMode,
      isOrigin ? token : counterpartToken,
      isOrigin ? counterpartToken : token,
    );
    if (!isOrigin) hasSelectedDestinationTokenRef.current = true;
    if (isOrigin) {
      // Reset amount when origin changes (warp UI does the same).
      setFieldValue('amount', '');
      latestOriginSelectionRef.current = tokenKey(token.chainId, token.address);
      if (!hasSelectedDestinationTokenRef.current) {
        void prefillBestDestinationToken({
          originToken: token,
          currentDestinationToken: counterpartToken,
          hasSelectedDestinationTokenRef,
          latestRecipientRef,
          chainIdToName,
          multiProvider,
          queryClient,
          syncTokens,
          latestOriginSelectionRef,
          latestCounterpartKeyRef,
          counterpartKeyAtRequestStart: counterpartKey,
          setFieldValue,
        });
      }
    } else if (shouldClearAddress(multiProvider, values.recipient, token.chainName)) {
      setFieldValue('recipient', '');
    }
    // Persist to URL so deep-linking matches the picked tokens.
    // Transfer-side contract is chainName-address (see useFormInitialValues).
    updateQueryParams({
      [isOrigin ? WARP_QUERY_PARAMS.ORIGIN : WARP_QUERY_PARAMS.DESTINATION]: token.chainName,
      [isOrigin ? WARP_QUERY_PARAMS.ORIGIN_TOKEN : WARP_QUERY_PARAMS.DESTINATION_TOKEN]:
        token.address,
    });
>>>>>>> origin/main
  };

  const open = () => {
    if (!disabled) setIsModalOpen(true);
  };

<<<<<<< HEAD
  // Set the token and origin from the selected field and the destination
  // chain from the the first connection in the token
  const onSelectUnsupportedRoute = (token: IToken, origin: string) => {
    if (!token.connections) return;
    const destination = token.connections[0].token.chainName;

    // token selection event
    trackTokenSelectionEvent(token, token.chainName, destination, multiProvider);

    setValues({
      ...values,
      origin,
      destination,
      tokenIndex: getTokenIndexFromChains(warpCore, token.addressOrDenom, origin, destination),
    });
    updateQueryParams({
      [WARP_QUERY_PARAMS.ORIGIN]: origin,
      [WARP_QUERY_PARAMS.DESTINATION]: destination,
      [WARP_QUERY_PARAMS.TOKEN]: token.symbol,
    });
=======
  const handleEditBack = () => {
    setEditingChain(null);
    setIsModalOpen(true);
>>>>>>> origin/main
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
        onEditChain={setEditingChain}
      />
      {editingChain && (
        <ChainEditModal
          isOpen={!!editingChain}
          close={() => setEditingChain(null)}
          onClickBack={handleEditBack}
          chainName={editingChain}
        />
      )}
    </>
  );
}

async function prefillBestDestinationToken({
  originToken,
  currentDestinationToken,
  hasSelectedDestinationTokenRef,
  latestRecipientRef,
  chainIdToName,
  multiProvider,
  queryClient,
  syncTokens,
  latestOriginSelectionRef,
  latestCounterpartKeyRef,
  counterpartKeyAtRequestStart,
  setFieldValue,
}: {
  originToken: UiToken;
  currentDestinationToken?: UiToken;
  hasSelectedDestinationTokenRef: MutableRefObject<boolean>;
  latestRecipientRef: MutableRefObject<string>;
  chainIdToName: Map<number, string>;
  multiProvider: ReturnType<typeof useMultiProvider>;
  queryClient: ReturnType<typeof useQueryClient>;
  syncTokens: (tokens: UiToken[]) => void;
  latestOriginSelectionRef: MutableRefObject<string | undefined>;
  latestCounterpartKeyRef: MutableRefObject<string | undefined>;
  counterpartKeyAtRequestStart?: string;
  setFieldValue: (field: string, value: unknown, shouldValidate?: boolean) => void;
}) {
  const query = getAvailableRoutesQuery('destination', originToken);
  if (!query) return;

  try {
    const result = await queryClient.fetchQuery({
      queryKey: getAvailableRoutesQueryKey('destination', query),
      queryFn: ({ signal }) => routerClient.availableRoutes(query, { signal }),
      staleTime: AVAILABLE_ROUTES_STALE_TIME,
    });
    if (latestOriginSelectionRef.current !== tokenKey(originToken.chainId, originToken.address)) {
      return;
    }
    if (latestCounterpartKeyRef.current !== counterpartKeyAtRequestStart) return;
    if (hasSelectedDestinationTokenRef.current) return;

    const routeTokens = result.tokens.flatMap((token) => {
      if (token.decimals == null) return [];
      const chainName = chainIdToName.get(token.chainId);
      return chainName ? [tokenDiscoveryToUi(token, chainName)] : [];
    });
    if (routeTokens.length) syncTokens(routeTokens);

    const prefillToken = getRoutePrefillToken(routeTokens, currentDestinationToken);
    if (!prefillToken) return;

    setFieldValue('dstChain', prefillToken.chainId);
    setFieldValue('dstToken', prefillToken.address);
    const recipient = latestRecipientRef.current;
    if (shouldClearAddress(multiProvider, recipient, prefillToken.chainName)) {
      setFieldValue('recipient', '');
    }
    updateQueryParams({
      [WARP_QUERY_PARAMS.DESTINATION]: prefillToken.chainName,
      [WARP_QUERY_PARAMS.DESTINATION_TOKEN]: prefillToken.address,
    });
  } catch (err) {
    logger.warn('Destination prefill failed', err);
  }
}

function shouldClearAddress(
  multiProvider: ReturnType<typeof useMultiProvider>,
  recipient: string,
  chainName: string,
) {
  const protocol = multiProvider.tryGetProtocol(chainName);
  return !!recipient && !!protocol && !isValidAddress(recipient, protocol);
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
