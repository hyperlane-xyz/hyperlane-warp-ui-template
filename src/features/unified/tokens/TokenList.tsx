import { fromWei } from '@hyperlane-xyz/utils';
import { useDebounce } from '@hyperlane-xyz/widgets';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TokenChainIcon } from '../../../components/icons/TokenChainIcon';
import { formatBalance, formatUsd } from '../../../utils/amount';
import { useTokenBalances as useBridgeTokenBalances } from '../../balances/hooks';
import { useDisabledChains, useMultiProvider } from '../../chains/hooks';
import { getChainDisplayName } from '../../chains/utils';
import { useTokenBalances as useSwapTokenBalances } from '../../swap/balances/hooks';
import { useTokenPrices as useSwapTokenPrices } from '../../swap/tokens/useTokenPrice';
import { getTokenKey as getSwapTokenKey } from '../../swap/tokens/utils';
import { useCollateralGroups } from '../../tokens/hooks';
import { useTokenPrices as useBridgeTokenPrices } from '../../tokens/useTokenPrice';
import { getTokenKey as getBridgeTokenKey } from '../../tokens/utils';
import { useUnifiedTokens } from './hooks';
import {
  getVisibleUnifiedTokens,
  sortUnifiedTokensByBalance,
  type UnifiedTokenBalanceInfo,
} from './list';
import { getUnifiedBridgeTokens } from './routes';
import type { UnifiedToken } from './types';

const INITIAL_BALANCE_FETCH_LIMIT = 50;
const BALANCE_FETCH_INCREMENT = 50;
const BALANCE_FETCH_SCROLL_THRESHOLD_PX = 120;

function matchesSearch(
  token: UnifiedToken,
  query: string,
  multiProvider: ReturnType<typeof useMultiProvider>,
): boolean {
  return (
    token.name.toLowerCase().includes(query) ||
    token.symbol.toLowerCase().includes(query) ||
    token.addressOrDenom.toLowerCase().includes(query) ||
    getUnifiedBridgeTokens(token).some(
      (bridgeToken) =>
        bridgeToken.addressOrDenom.toLowerCase().includes(query) ||
        bridgeToken.collateralAddressOrDenom?.toLowerCase().includes(query),
    ) ||
    token.chainName.toLowerCase().includes(query) ||
    getChainDisplayName(multiProvider, token.chainName).toLowerCase().includes(query)
  );
}

interface TokenListProps {
  selectionMode: 'origin' | 'destination';
  searchQuery: string;
  chainFilter: string | null;
  chainIdFilter: number | undefined;
  onSelect: (token: UnifiedToken) => void;
  counterpartToken?: UnifiedToken;
  engineEnabled: boolean;
  recipient?: string;
}

export function TokenList({
  selectionMode,
  searchQuery,
  chainFilter,
  chainIdFilter,
  onSelect,
  counterpartToken,
  engineEnabled,
  recipient,
}: TokenListProps) {
  const multiProvider = useMultiProvider();
  const disabledChains = useDisabledChains();
  const debouncedSearch = useDebounce(searchQuery, 300);
  const trimmedSearch = debouncedSearch?.trim().toLowerCase() || undefined;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [balanceFetchLimit, setBalanceFetchLimit] = useState(INITIAL_BALANCE_FETCH_LIMIT);
  const collateralGroups = useCollateralGroups();

  const { data: fetched, isLoading } = useUnifiedTokens({
    chain: chainIdFilter,
    search: trimmedSearch,
  });

  const allTokens = useMemo(
    () =>
      disabledChains.size > 0 ? fetched.filter((t) => !disabledChains.has(t.chainName)) : fetched,
    [fetched, disabledChains],
  );

  const { tokens: routeSortedTokens, isLimited } = useMemo(() => {
    const filtered = allTokens.filter((token) => {
      if (chainFilter && token.chainName !== chainFilter) return false;
      if (!trimmedSearch) return true;
      return matchesSearch(token, trimmedSearch, multiProvider);
    });

    return getVisibleUnifiedTokens({
      allTokens: filtered,
      counterpartToken,
      selectionMode,
      collateralGroups,
      engineEnabled,
      hasFilter: !!trimmedSearch || !!chainFilter,
    });
  }, [
    allTokens,
    trimmedSearch,
    chainFilter,
    multiProvider,
    counterpartToken,
    selectionMode,
    collateralGroups,
    engineEnabled,
  ]);

  const addressOverride = selectionMode === 'destination' ? recipient : undefined;
  const balanceSourceTokens = useMemo(
    () => routeSortedTokens.slice(0, balanceFetchLimit),
    [routeSortedTokens, balanceFetchLimit],
  );
  const bridgeBalanceTokens = useMemo(
    () =>
      uniqueByKey(
        balanceSourceTokens.flatMap((token) => getUnifiedBridgeTokens(token)),
        getBridgeTokenKey,
      ),
    [balanceSourceTokens],
  );
  const swapBalanceTokens = useMemo(
    () =>
      uniqueByKey(
        balanceSourceTokens.flatMap((token) => (token.swapToken ? [token.swapToken] : [])),
        getSwapTokenKey,
      ),
    [balanceSourceTokens],
  );
  const {
    balances: bridgeBalances,
    isLoading: isBridgeBalanceLoading,
    hasAnyAddress: hasBridgeAddress,
  } = useBridgeTokenBalances(
    bridgeBalanceTokens,
    `unified-picker-${selectionMode}`,
    addressOverride,
  );
  const {
    balances: swapBalances,
    isLoading: isSwapBalanceLoading,
    hasAnyAddress: hasSwapAddress,
  } = useSwapTokenBalances(swapBalanceTokens, chainFilter ?? 'all', addressOverride);
  const { prices: bridgePrices } = useBridgeTokenPrices();
  const { prices: swapPrices } = useSwapTokenPrices();

  const balanceInfo = useMemo(() => {
    const prices = { ...bridgePrices, ...swapPrices };
    return buildUnifiedTokenBalanceInfo({
      tokens: routeSortedTokens,
      bridgeBalances,
      swapBalances,
      prices,
    });
  }, [routeSortedTokens, bridgeBalances, swapBalances, bridgePrices, swapPrices]);

  const tokens = useMemo(
    () =>
      sortUnifiedTokensByBalance({
        tokens: routeSortedTokens,
        balanceInfo,
        counterpartToken,
        selectionMode,
        collateralGroups,
        engineEnabled,
      }),
    [
      routeSortedTokens,
      balanceInfo,
      counterpartToken,
      selectionMode,
      collateralGroups,
      engineEnabled,
    ],
  );

  const isBalanceLoading =
    (isBridgeBalanceLoading && hasBridgeAddress) || (isSwapBalanceLoading && hasSwapAddress);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    setBalanceFetchLimit(INITIAL_BALANCE_FETCH_LIMIT);
  }, [searchQuery, chainFilter, chainIdFilter, selectionMode, counterpartToken?.key]);

  const maybeFetchMoreBalances = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (distanceFromBottom > BALANCE_FETCH_SCROLL_THRESHOLD_PX) return;

      setBalanceFetchLimit((current) =>
        Math.min(current + BALANCE_FETCH_INCREMENT, routeSortedTokens.length),
      );
    },
    [routeSortedTokens.length],
  );

  if (tokens.length === 0) {
    return (
      <div className="token-picker-empty flex flex-1 flex-col items-center justify-center px-4 py-12 text-gray-500">
        <div className="text-base font-medium">
          {isLoading ? 'Loading tokens…' : 'No tokens found'}
        </div>
        {!isLoading && <div className="mt-2 text-sm">Try a different search or chain filter</div>}
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={scrollRef} className="h-full overflow-auto" onScroll={maybeFetchMoreBalances}>
        <div className="token-picker-header sticky top-0 z-10 border-b border-primary-50 bg-white px-4 pb-2 pt-2">
          <h3 className={`${styles.base} text-sm text-black`}>Token Selection</h3>
        </div>
        <div className="py-2 md:px-3">
          {tokens.map((token) => (
            <TokenButton
              key={token.key}
              token={token}
              onSelect={onSelect}
              balanceInfo={balanceInfo.get(token.key)}
              isBalanceLoading={isBalanceLoading}
            />
          ))}

          {isLimited && (
            <div className="token-picker-hint mx-1 mb-3 mt-2 rounded-lg bg-blue-50 px-3 py-4 text-center">
              <p className="text-sm text-blue-600">Search or select a chain to see more tokens</p>
            </div>
          )}
          <div className="h-10" />
        </div>
      </div>
      <div className="token-picker-fade pointer-events-none absolute bottom-0 left-0 right-0 hidden h-12 bg-gradient-to-b from-transparent to-cream-200 md:block" />
    </div>
  );
}

const TokenButton = React.memo(function TokenButton({
  token,
  onSelect,
  balanceInfo,
  isBalanceLoading,
}: {
  token: UnifiedToken;
  onSelect: (token: UnifiedToken) => void;
  balanceInfo?: UnifiedTokenBalanceInfo;
  isBalanceLoading: boolean;
}) {
  const multiProvider = useMultiProvider();
  const chainDisplayName = getChainDisplayName(multiProvider, token.chainName);
  const balance = balanceInfo?.balance;
  const formattedBalance =
    balance != null && balance > 0n ? formatBalance(balance, token.decimals) : null;
  const formattedUsd =
    balanceInfo?.usd != null && balanceInfo.usd > 0 ? formatUsd(balanceInfo.usd) : null;

  return (
    <button
      type="button"
      aria-label={`${token.chainName} ${token.symbol} ${chainDisplayName} ${token.name || 'Unknown Token'}`}
      className="token-picker-row group mb-2 flex h-[60px] w-full items-center rounded-md px-3 transition-colors hover:bg-gray-100"
      onClick={() => onSelect(token)}
    >
      <TokenChainIcon token={token} size={36} />

      <div className="ml-3 min-w-0 flex-1 text-left">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`token-picker-symbol ${styles.base} max-w-[8rem] shrink-0 truncate text-base text-black`}
          >
            {token.symbol || 'Unknown'}
          </span>
          <span className="token-picker-chain-name min-w-0 truncate text-xs text-gray-500">
            {chainDisplayName}
          </span>
        </div>
        <div className={`token-picker-name ${styles.base} mt-0.5 truncate text-xs text-gray-500`}>
          {token.name || 'Unknown Token'}
        </div>
      </div>
      <div className="ml-2 min-w-[4.5rem] shrink-0 text-right">
        {isBalanceLoading && !formattedBalance ? (
          <div className="ml-auto h-4 w-14 animate-pulse rounded bg-gray-100" />
        ) : formattedUsd || formattedBalance ? (
          <>
            {formattedUsd && (
              <div className={`${styles.base} text-sm text-black`}>{formattedUsd}</div>
            )}
            {formattedBalance && (
              <div className={`${styles.base} text-xs text-gray-400`}>{formattedBalance}</div>
            )}
          </>
        ) : null}
      </div>
    </button>
  );
});

function uniqueByKey<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function buildUnifiedTokenBalanceInfo({
  tokens,
  bridgeBalances,
  swapBalances,
  prices,
}: {
  tokens: UnifiedToken[];
  bridgeBalances: Record<string, bigint>;
  swapBalances: Record<string, bigint>;
  prices: Record<string, number>;
}): Map<string, UnifiedTokenBalanceInfo> {
  const result = new Map<string, UnifiedTokenBalanceInfo>();

  for (const token of tokens) {
    const candidates = [
      ...getUnifiedBridgeTokens(token).map((bridgeToken) => ({
        balance: bridgeBalances[getBridgeTokenKey(bridgeToken)],
        decimals: bridgeToken.decimals,
        coinGeckoId: bridgeToken.coinGeckoId,
      })),
      ...(token.swapToken
        ? [
            {
              balance: swapBalances[getSwapTokenKey(token.swapToken)],
              decimals: token.swapToken.decimals,
              coinGeckoId: token.swapToken.coinGeckoId,
            },
          ]
        : []),
    ];

    const selected =
      candidates.find((candidate) => candidate.balance != null && candidate.balance > 0n) ??
      candidates.find((candidate) => candidate.balance != null);
    if (!selected || selected.balance == null) continue;

    const price = selected.coinGeckoId ? prices[selected.coinGeckoId] : undefined;
    const usd =
      price != null
        ? parseFloat(fromWei(selected.balance.toString(), selected.decimals)) * price
        : null;
    result.set(token.key, {
      balance: selected.balance,
      usd,
    });
  }

  return result;
}

const styles = {
  base: 'font-secondary font-normal',
};
