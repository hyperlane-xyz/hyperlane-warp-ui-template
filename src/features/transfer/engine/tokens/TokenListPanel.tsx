import { ChainName } from '@hyperlane-xyz/sdk';
import { useEffect, useRef } from 'react';

import { SearchInput } from '../../../../components/input/SearchInput';
import type { ChainInfo } from '../../../chains/hooks';
import { MobileChainQuickSelect } from '../../../chains/MobileChainQuickSelect';
import { TokenList } from './TokenList';
import type { TokenSelectionMode, UiToken } from './types';

const preferredChains = ['ethereum', 'arbitrum', 'base', 'optimism'];

interface TokenListPanelProps {
  selectionMode: TokenSelectionMode;
  searchQuery: string;
  onSearchChange: (s: string) => void;
  chainFilter: ChainName | null;
  onSelect: (token: UiToken) => void;
  counterpartToken?: UiToken;
  recipient?: string;
  availableRouteTokens: UiToken[];
  hasAvailableRoutesResult: boolean;
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainInfo | null) => void;
  onMoreChainsClick: () => void;
}

export function TokenListPanel({
  selectionMode,
  searchQuery,
  onSearchChange,
  chainFilter,
  onSelect,
  counterpartToken,
  recipient,
  availableRouteTokens,
  hasAvailableRoutesResult,
  selectedChain,
  onSelectChain,
  onMoreChainsClick,
}: TokenListPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="token-picker-modal flex min-w-0 flex-1 flex-col bg-white">
      <div className="shrink-0 md:p-4">
        <SearchInput
          inputRef={inputRef}
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search Name, Symbol, or Contract Address"
          aria-label="Search tokens"
        />
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
        recipient={recipient}
        availableRouteTokens={availableRouteTokens}
        hasAvailableRoutesResult={hasAvailableRoutesResult}
      />
    </div>
  );
}
