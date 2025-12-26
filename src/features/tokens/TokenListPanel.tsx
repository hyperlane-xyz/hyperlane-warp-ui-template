import { ChainName, Token } from '@hyperlane-xyz/sdk';
import { useEffect, useRef } from 'react';
import { SearchInput } from '../../components/input/SearchInput';
import { MobileChainQuickSelect } from '../chains/MobileChainQuickSelect';
import { TokenList } from './TokenList';
import { TokenSelectionMode } from './types';

const preferredChains = ['ethereum', 'solanamainnet', 'arbitrum', 'base'];

interface TokenListPanelProps {
  selectionMode: TokenSelectionMode;
  searchQuery: string;
  onSearchChange: (s: string) => void;
  chainFilter: ChainName | null;
  onSelect: (token: Token) => void;
  counterpartToken?: Token;
  /** Mobile chain selection props */
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainName | null) => void;
  onMoreChainsClick: () => void;
}

export function TokenListPanel({
  selectionMode,
  searchQuery,
  onSearchChange,
  chainFilter,
  onSelect,
  counterpartToken,
  selectedChain,
  onSelectChain,
  onMoreChainsClick,
}: TokenListPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus token search on mount
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-white">
      <div className="shrink-0 px-4 py-4">
        <SearchInput
          inputRef={inputRef}
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search Name, Symbol, or Contract Address"
          aria-label="Search tokens"
        />
        {/* Mobile chain quick select (hidden on desktop) */}
        <div className="mt-3 md:hidden">
          <MobileChainQuickSelect
            selectedChain={selectedChain}
            onSelectChain={onSelectChain}
            onMoreClick={onMoreChainsClick}
            preferredChains={preferredChains}
          />
        </div>
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
