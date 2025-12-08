import { ChainName, Token } from '@hyperlane-xyz/sdk';
import { Modal, SearchIcon } from '@hyperlane-xyz/widgets';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { TextInput } from '../../components/input/TextField';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { useDestinationTokens, useOriginTokens } from './hooks';
import { TokenChainIcon } from './TokenChainIcon';

type SelectionMode = 'origin' | 'destination';

interface Props {
  isOpen: boolean;
  close: () => void;
  onSelect: (token: Token) => void;
  selectionMode: SelectionMode;
}

export function UnifiedTokenChainModal({ isOpen, close, onSelect, selectionMode }: Props) {
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
          selectionMode={selectionMode}
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
        />
      </div>
    </Modal>
  );
}

// ============================================
// Chain Filter Panel
// ============================================

function ChainFilterPanel({
  selectionMode,
  searchQuery,
  onSearchChange,
  selectedChain,
  onSelectChain,
}: {
  selectionMode: SelectionMode;
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
        selectionMode={selectionMode}
        searchQuery={searchQuery}
        selectedChain={selectedChain}
        onSelectChain={onSelectChain}
      />
    </div>
  );
}

function ChainList({
  selectionMode,
  searchQuery,
  selectedChain,
  onSelectChain,
}: {
  selectionMode: SelectionMode;
  searchQuery: string;
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainName | null) => void;
}) {
  const multiProvider = useMultiProvider();
  const originTokens = useOriginTokens();
  const destinationTokens = useDestinationTokens();

  const chains = useMemo(() => {
    const tokens = selectionMode === 'origin' ? originTokens : destinationTokens;

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
  }, [selectionMode, searchQuery, originTokens, destinationTokens, multiProvider]);

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
}: {
  selectionMode: SelectionMode;
  searchQuery: string;
  onSearchChange: (s: string) => void;
  chainFilter: ChainName | null;
  onSelect: (token: Token) => void;
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
      />
    </div>
  );
}

function TokenList({
  selectionMode,
  searchQuery,
  chainFilter,
  onSelect,
}: {
  selectionMode: SelectionMode;
  searchQuery: string;
  chainFilter: ChainName | null;
  onSelect: (token: Token) => void;
}) {
  const multiProvider = useMultiProvider();
  const originTokens = useOriginTokens();
  const destinationTokens = useDestinationTokens();

  const { tokens, totalCount, isLimited } = useMemo(() => {
    const allTokens = selectionMode === 'origin' ? originTokens : destinationTokens;
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

    // Sort: by symbol, then by chain name
    const sorted = filtered.sort((a, b) => {
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
  }, [selectionMode, searchQuery, chainFilter, originTokens, destinationTokens, multiProvider]);

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
      {tokens.map((token) => (
        <TokenButton key={`${token.chainName}-${token.addressOrDenom}`} token={token} onSelect={onSelect} />
      ))}

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

function TokenButton({ token, onSelect }: { token: Token; onSelect: (token: Token) => void }) {
  const multiProvider = useMultiProvider();
  const chainDisplayName = getChainDisplayName(multiProvider, token.chainName);

  // Truncate address for display
  const shortAddress = token.addressOrDenom
    ? `${token.addressOrDenom.slice(0, 6)}...${token.addressOrDenom.slice(-4)}`
    : 'Native';

  return (
    <button
      type="button"
      className="group mb-1.5 flex w-full items-center rounded-lg border border-transparent px-3 py-2.5 transition-all hover:border-gray-200 hover:bg-gray-50"
      onClick={() => onSelect(token)}
    >
      <TokenChainIcon token={token} size={36} />

      <div className="ml-3 min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{token.symbol || 'Unknown'}</span>
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
