import { Token } from '@hyperlane-xyz/sdk';
import { useField, useFormikContext } from 'formik';
import { useState } from 'react';
import { ChevronLargeIcon } from '../../components/icons/ChevronLargeIcon';
import { WARP_QUERY_PARAMS } from '../../consts/args';
<<<<<<< HEAD
import { updateQueryParam, updateQueryParams } from '../../utils/queryParams';
import { trackTokenSelectionEvent } from '../analytics/utils';
import { useMultiProvider } from '../chains/hooks';
=======
import { updateQueryParams } from '../../utils/queryParams';
import { trackTokenSelectionEvent, trackUnsupportedRouteEvent } from '../analytics/utils';
import { ChainEditModal } from '../chains/ChainEditModal';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
>>>>>>> origin/main
import { TransferFormValues } from '../transfer/types';
import { shouldClearAddress } from '../transfer/utils';
import { getTokenByKeyFromMap, useCollateralGroups, useTokenByKeyMap, useTokens } from './hooks';
import { TokenChainIcon } from './TokenChainIcon';
import { TokenSelectionMode } from './types';
import { UnifiedTokenChainModal } from './UnifiedTokenChainModal';
import { checkTokenHasRoute, getTokenKey } from './utils';

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
  const [{ value: tokenKey }, , { setValue: setTokenKey }] = useField<string | undefined>(name);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChain, setEditingChain] = useState<string | null>(null);
  const collateralGroups = useCollateralGroups();
  const tokens = useTokens();

<<<<<<< HEAD
  const warpCore = useWarpCore();
  const multiProvider = useMultiProvider();

  const { origin, destination } = values;
  useEffect(() => {
    const tokensWithRoute = warpCore.getTokensForRoute(origin, destination);
    setIsAutomaticSelection(tokensWithRoute.length <= 1);
  }, [warpCore, origin, destination, helpers]);

  const onSelectToken = (newToken: IToken) => {
    // Set the token address value in formik state
    helpers.setValue(getIndexForToken(warpCore, newToken));

    // token selection event
    trackTokenSelectionEvent(newToken, origin, destination, multiProvider);

    updateQueryParam(WARP_QUERY_PARAMS.TOKEN, newToken.symbol);
    // Update nft state in parent
    setIsNft(newToken.isNft());
=======
  const handleEditBack = () => {
    setEditingChain(null);
    setIsModalOpen(true);
>>>>>>> origin/main
  };

  const multiProvider = useMultiProvider();
  const tokenMap = useTokenByKeyMap();

  // Get the current token
  const selectedToken = getTokenByKeyFromMap(tokenMap, tokenKey);

  // Get the counterpart token (destination when selecting origin, origin when selecting destination)
  const counterpartToken =
    selectionMode === 'origin'
      ? getTokenByKeyFromMap(tokenMap, values.destinationTokenKey)
      : getTokenByKeyFromMap(tokenMap, values.originTokenKey);

  const handleSelectToken = (newToken: Token) => {
    const newTokenKey = getTokenKey(newToken);
    setTokenKey(newTokenKey);

    // Track analytics - derive origin and destination from current tokens
    const originToken =
      selectionMode === 'origin' ? newToken : getTokenByKeyFromMap(tokenMap, values.originTokenKey);
    const destToken =
      selectionMode === 'destination'
        ? newToken
        : getTokenByKeyFromMap(tokenMap, values.destinationTokenKey);

    trackTokenSelectionEvent(selectionMode, originToken, destToken, multiProvider);

    // Update URL query params based on selection mode
    if (selectionMode === 'origin') {
      setFieldValue('amount', '');

      // Auto-select destination if current one has no route from new origin
      const hasValidRoute = destToken && checkTokenHasRoute(newToken, destToken, collateralGroups);
      const queryParams: Record<string, string> = {
        [WARP_QUERY_PARAMS.ORIGIN]: newToken.chainName,
        [WARP_QUERY_PARAMS.ORIGIN_TOKEN]: newToken.symbol,
      };

      if (!hasValidRoute) {
        const firstDest = tokens.find(
          (t) =>
            t.chainName !== newToken.chainName && checkTokenHasRoute(newToken, t, collateralGroups),
        );
        if (firstDest) {
          setFieldValue('destinationTokenKey', getTokenKey(firstDest));
          queryParams[WARP_QUERY_PARAMS.DESTINATION] = firstDest.chainName;
          queryParams[WARP_QUERY_PARAMS.DESTINATION_TOKEN] = firstDest.symbol;
          // Clear recipient if new destination protocol doesn't match
          if (shouldClearAddress(multiProvider, values.recipient, firstDest.chainName)) {
            setFieldValue('recipient', '');
          }
        }
      }

      updateQueryParams(queryParams);
    } else {
      // When destination changes, validate and clear custom recipient if protocol changed
      const shouldClearRecipient = shouldClearAddress(
        multiProvider,
        values.recipient,
        newToken.chainName,
      );
      if (shouldClearRecipient) setFieldValue('recipient', '');

      // fire an event for unsupported route
      // this will only happen for destination selection
      // the origin selection will always pick a routable token pair by default
      if (originToken) {
        const tokenHasRoute = checkTokenHasRoute(originToken, newToken, collateralGroups);
        if (!tokenHasRoute) trackUnsupportedRouteEvent(originToken, newToken, multiProvider);
      }

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

  const openTokenSelectModal = () => {
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
  };

=======
>>>>>>> origin/main
  return (
    <>
      <div className="flex flex-col">
        {showLabel && label && <span className="mb-1 pl-0.5 text-sm text-gray-600">{label}</span>}
        <TokenButton
          token={selectedToken}
          disabled={disabled}
          onClick={openTokenSelectModal}
          multiProvider={multiProvider}
          testId={`token-select-${selectionMode}`}
        />
      </div>

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

function TokenButton({
  token,
  disabled,
  onClick,
  multiProvider,
  testId,
}: {
  token?: Token;
  disabled?: boolean;
  onClick: () => void;
  multiProvider: ReturnType<typeof useMultiProvider>;
  testId?: string;
}) {
  const chainDisplayName = token ? getChainDisplayName(multiProvider, token.chainName) : '';

  return (
    <button
      type="button"
      className={`${styles.base} ${disabled ? styles.disabled : styles.enabled}`}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
    >
      {token ? (
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <TokenChainIcon token={token} size={36} />
          <div className="flex min-w-0 flex-col items-start">
            <span className="font-secondary text-lg font-normal text-gray-900">{token.symbol}</span>
            <span className="text-sm text-gray-900">{chainDisplayName}</span>
          </div>
        </div>
      ) : (
        <span className="text-sm text-gray-400">Select token</span>
      )}
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-400 bg-white drop-shadow-button transition-colors duration-150 group-hover:bg-gray-50">
        <ChevronLargeIcon width={14} height={18} />
      </div>
    </button>
  );
}

const styles = {
  base: 'w-full py-2 flex items-center justify-between transition-all rounded-xl px-1.5 border duration-150 border-gray-400/25 shadow-sm group',
  enabled: 'hover:bg-gray-50 cursor-pointer',
  disabled: 'cursor-not-allowed opacity-60',
};
