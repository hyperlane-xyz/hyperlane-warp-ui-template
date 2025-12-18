import { ChainName, Token } from '@hyperlane-xyz/sdk';
import { Modal, SearchIcon } from '@hyperlane-xyz/widgets';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { TextInput } from '../../components/input/TextField';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { useCollateralGroups, useTokens } from './hooks';
import { TokenChainIcon } from './TokenChainIcon';
import { getCollateralKey, getTokenKey } from './utils';

type SelectionMode = 'origin' | 'destination';

interface Props {
  isOpen: boolean;
  close: () => void;
  onSelect: (token: Token) => void;
  selectionMode: SelectionMode;
  /** The currently selected token on the counterpart side (destination when selecting origin, origin when selecting destination) */
  counterpartToken?: Token;
}

export function UnifiedTokenChainModal({
  isOpen,
  close,
  onSelect,
  selectionMode,
  counterpartToken,
}: Props) {
  const [chainSearch, setChainSearch] = useState('');
  const [tokenSearch, setTokenSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState<ChainName | null>(null);

  const onClose = () => {
    close();
    setChainSearch('');
    setTokenSearch('');
    setSelectedChain(null);
  };

  const onSelectAndClose = (token: Token) => {
    onSelect(token);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} close={onClose} panelClassname="p-0 max-w-[56rem] overflow-hidden">
      <div className="flex h-[600px]">
        {/* Left panel - Chain filter */}
        <ChainFilterPanel
          searchQuery={chainSearch}
          onSearchChange={setChainSearch}
          selectedChain={selectedChain}
          onSelectChain={setSelectedChain}
        />

        {/* Right panel - Token list */}
        <TokenListPanel
          selectionMode={selectionMode}
          searchQuery={tokenSearch}
          onSearchChange={setTokenSearch}
          chainFilter={selectedChain}
          onSelect={onSelectAndClose}
          counterpartToken={counterpartToken}
        />
      </div>
    </Modal>
  );
}

// ============================================
// Chain Filter Panel
// ============================================

function ChainFilterPanel({
  searchQuery,
  onSearchChange,
  selectedChain,
  onSelectChain,
}: {
  searchQuery: string;
  onSearchChange: (s: string) => void;
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainName | null) => void;
}) {
  return (
    <div className="flex w-56 flex-col border-r border-gray-200 bg-gray-50">
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Filter by Chain</h3>
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search chains..."
        />
      </div>
      <ChainList
        searchQuery={searchQuery}
        selectedChain={selectedChain}
        onSelectChain={onSelectChain}
      />
    </div>
  );
}

function ChainList({
  searchQuery,
  selectedChain,
  onSelectChain,
}: {
  searchQuery: string;
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainName | null) => void;
}) {
  const multiProvider = useMultiProvider();
  const tokens = useTokens();

  const chains = useMemo(() => {
    // Get unique chains that have tokens
    const chainSet = new Set(tokens.map((t) => t.chainName));

    // Build chain info with display names for sorting
    const chainInfos = Array.from(chainSet).map((chainName) => ({
      name: chainName,
      displayName: getChainDisplayName(multiProvider, chainName),
    }));

    // Sort alphabetically by display name
    chainInfos.sort((a, b) => a.displayName.localeCompare(b.displayName));

    // Filter by search query
    const q = searchQuery?.trim().toLowerCase();
    if (!q) return chainInfos;

    return chainInfos.filter(
      (chain) =>
        chain.displayName.toLowerCase().includes(q) || chain.name.toLowerCase().includes(q),
    );
  }, [searchQuery, tokens, multiProvider]);

  return (
    <div className="flex-1 overflow-auto">
      {/* All Chains option */}
      <ChainButton
        isSelected={selectedChain === null}
        onClick={() => onSelectChain(null)}
        icon={
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-[10px] font-bold text-white">
            ALL
          </div>
        }
        label="All Chains"
      />

      {/* Individual chains */}
      {chains.map((chain) => (
        <ChainButton
          key={chain.name}
          isSelected={selectedChain === chain.name}
          onClick={() => onSelectChain(chain.name)}
          icon={<ChainLogo chainName={chain.name} size={28} />}
          label={chain.displayName}
        />
      ))}

      {chains.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-gray-500">No chains found</div>
      )}
    </div>
  );
}

function ChainButton({
  isSelected,
  onClick,
  icon,
  label,
}: {
  isSelected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 border-l-2 px-4 py-2.5 transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50 text-blue-700'
          : 'border-transparent text-gray-700 hover:bg-gray-100'
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="truncate text-sm font-medium">{label}</span>
    </button>
  );
}

// ============================================
// Token List Panel
// ============================================

function TokenListPanel({
  selectionMode,
  searchQuery,
  onSearchChange,
  chainFilter,
  onSelect,
  counterpartToken,
}: {
  selectionMode: SelectionMode;
  searchQuery: string;
  onSearchChange: (s: string) => void;
  chainFilter: ChainName | null;
  onSelect: (token: Token) => void;
  counterpartToken?: Token;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus token search on mount
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-white">
      <div className="shrink-0 border-b border-gray-200 px-4 py-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Select Token</h3>
        <SearchInput
          inputRef={inputRef}
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search by name, symbol, or address..."
        />
      </div>
      <TokenList
        selectionMode={selectionMode}
        searchQuery={searchQuery}
        chainFilter={chainFilter}
        onSelect={onSelect}
        counterpartToken={counterpartToken}
      />
    </div>
  );
}

/**
 * Fast route checking using pre-computed collateral groups
 */
function checkTokenHasRoute(
  displayedToken: Token,
  counterpartToken: Token,
  selectionMode: SelectionMode,
  collateralGroups: Map<string, Token[]>,
): boolean {
  const counterpartCollateralKey = getCollateralKey(counterpartToken);

  if (selectionMode === 'origin') {
    // Check if displayed origin token can reach the counterpart destination
    const originCollateralKey = getCollateralKey(displayedToken);
    const originGroup = collateralGroups.get(originCollateralKey) || [];

    // Check if any token in origin's collateral group connects to destination's collateral group
    return originGroup.some((originToken) => {
      const destConnection = originToken.getConnectionForChain(counterpartToken.chainName);
      if (!destConnection?.token) return false;
      return getCollateralKey(destConnection.token) === counterpartCollateralKey;
    });
  } else {
    // Check if displayed destination token can be reached from counterpart origin
    const originCollateralKey = getCollateralKey(counterpartToken);
    const originGroup = collateralGroups.get(originCollateralKey) || [];
    const destCollateralKey = getCollateralKey(displayedToken);

    // Check if any token in origin's collateral group connects to destination's collateral group
    return originGroup.some((originToken) => {
      const destConnection = originToken.getConnectionForChain(displayedToken.chainName);
      if (!destConnection?.token) return false;
      return getCollateralKey(destConnection.token) === destCollateralKey;
    });
  }
}

function TokenList({
  selectionMode,
  searchQuery,
  chainFilter,
  onSelect,
  counterpartToken,
}: {
  selectionMode: SelectionMode;
  searchQuery: string;
  chainFilter: ChainName | null;
  onSelect: (token: Token) => void;
  counterpartToken?: Token;
}) {
  const multiProvider = useMultiProvider();
  const allTokens = useTokens();

  // Pre-computed collateral groups from store (computed at app startup)
  const collateralGroups = useCollateralGroups();

  // Deferred state for route map - allows UI to render immediately
  const [tokenRouteMap, setTokenRouteMap] = useState<Map<string, boolean> | null>(null);
  const [, startTransition] = useTransition();

  // Compute route map in a transition (non-blocking)
  useEffect(() => {
    if (!counterpartToken) {
      setTokenRouteMap(null);
      return;
    }

    startTransition(() => {
      const routeMap = new Map<string, boolean>();

      for (const token of allTokens) {
        const key = getTokenKey(token);
        const hasRoute = checkTokenHasRoute(token, counterpartToken, selectionMode, collateralGroups);
        routeMap.set(key, hasRoute);
      }

      setTokenRouteMap(routeMap);
    });
  }, [allTokens, counterpartToken, selectionMode, collateralGroups]);

  const { tokens, totalCount, isLimited } = useMemo(() => {
    const q = searchQuery?.trim().toLowerCase();

    // Filter by chain
    const chainFiltered = chainFilter
      ? allTokens.filter((t) => t.chainName === chainFilter)
      : allTokens;

    // Filter by search query
    const filtered = chainFiltered.filter((t) => {
      if (!q) return true;
      const chainDisplayName = getChainDisplayName(multiProvider, t.chainName).toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        t.addressOrDenom.toLowerCase().includes(q) ||
        chainDisplayName.includes(q)
      );
    });

    // Sort: tokens with routes first, then by symbol, then by chain name
    const sorted = [...filtered].sort((a, b) => {
      // If we have route info, sort tokens with routes first
      if (tokenRouteMap) {
        const aHasRoute = tokenRouteMap.get(getTokenKey(a)) ?? true;
        const bHasRoute = tokenRouteMap.get(getTokenKey(b)) ?? true;

        if (aHasRoute && !bHasRoute) return -1;
        if (!aHasRoute && bHasRoute) return 1;
      }

      // Then sort alphabetically by symbol
      const symbolCompare = a.symbol.localeCompare(b.symbol);
      if (symbolCompare !== 0) return symbolCompare;
      return a.chainName.localeCompare(b.chainName);
    });

    // Limit display when no filters applied (for performance with large token lists)
    const hasFilter = !!q || chainFilter !== null;
    const maxDisplay = 50;
    const isLimited = !hasFilter && sorted.length > maxDisplay;
    const displayTokens = isLimited ? sorted.slice(0, maxDisplay) : sorted;

    return {
      tokens: displayTokens,
      totalCount: sorted.length,
      isLimited,
    };
  }, [searchQuery, chainFilter, allTokens, multiProvider, tokenRouteMap]);

  if (tokens.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-gray-500">
        <div className="text-base font-medium">No tokens found</div>
        <div className="mt-2 text-sm">Try a different search or chain filter</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-3 py-2">
      {tokens.map((token) => {
        const tokenKey = getTokenKey(token);
        // If no counterpart selected (tokenRouteMap is null), all tokens have routes
        const hasRoute = tokenRouteMap ? (tokenRouteMap.get(tokenKey) ?? true) : true;

        return (
          <TokenButton
            key={tokenKey}
            token={token}
            onSelect={onSelect}
            hasRoute={hasRoute}
          />
        );
      })}

      {isLimited && (
        <div className="mx-1 mb-3 mt-2 rounded-lg bg-blue-50 p-3 text-center">
          <p className="text-sm text-blue-800">
            Showing {tokens.length} of {totalCount} tokens
          </p>
          <p className="mt-1 text-xs text-blue-600">
            Use search or select a chain to see more
          </p>
        </div>
      )}
    </div>
  );
}

function TokenButton({
  token,
  onSelect,
  hasRoute,
}: {
  token: Token;
  onSelect: (token: Token) => void;
  /** Whether this token has a valid route to/from the counterpart. False = grayed appearance */
  hasRoute: boolean;
}) {
  const multiProvider = useMultiProvider();
  const chainDisplayName = getChainDisplayName(multiProvider, token.chainName);

  // Truncate address for display
  const shortAddress = token.addressOrDenom
    ? `${token.addressOrDenom.slice(0, 6)}...${token.addressOrDenom.slice(-4)}`
    : 'Native';

  return (
    <button
      type="button"
      className={`group mb-1.5 flex w-full items-center rounded-lg border border-transparent px-3 py-2.5 transition-all hover:border-gray-200 hover:bg-gray-50 ${
        !hasRoute ? 'opacity-40' : ''
      }`}
      onClick={() => onSelect(token)}
    >
      <TokenChainIcon token={token} size={36} />

      <div className="ml-3 min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${hasRoute ? 'text-gray-900' : 'text-gray-500'}`}>
            {token.symbol || 'Unknown'}
          </span>
          <span className="text-xs text-gray-500">{chainDisplayName}</span>
        </div>
        <div className="mt-0.5 truncate text-xs text-gray-500">{token.name || 'Unknown Token'}</div>
      </div>

      <div className="ml-2 shrink-0 text-right">
        <div className="font-mono text-[10px] text-gray-400">{shortAddress}</div>
      </div>
    </button>
  );
}

// ============================================
// Shared Components
// ============================================

function SearchInput({
  inputRef,
  value,
  onChange,
  placeholder,
}: {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <SearchIcon
        width={16}
        height={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50"
      />
      <TextInput
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        name="search"
        className="w-full pl-9 all:border-gray-300 all:py-2 all:text-sm all:focus:border-blue-400"
        autoComplete="off"
      />
    </div>
  );
}
