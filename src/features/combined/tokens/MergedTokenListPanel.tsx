import { ChainName } from '@hyperlane-xyz/sdk';
import { useEffect, useRef } from 'react';

import { SearchInput } from '../../../components/input/SearchInput';
import type { ChainInfo } from '../../chains/hooks';
import { MobileChainQuickSelect } from '../../chains/MobileChainQuickSelect';
import type { TokenSelectionMode } from '../../swap/tokens/types';
import type { CombinedToken } from '../types';
import { MergedTokenList } from './MergedTokenList';

const preferredChains = ['ethereum', 'arbitrum', 'base', 'optimism'];

interface MergedTokenListPanelProps {
  selectionMode: TokenSelectionMode;
  searchQuery: string;
  onSearchChange: (s: string) => void;
  chainFilter: ChainName | null;
  onSelect: (token: CombinedToken) => void;
  counterpartToken?: CombinedToken;
  extraTokens?: CombinedToken[];
  recipient?: string;
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainInfo | null) => void;
  onMoreChainsClick: () => void;
}

export function MergedTokenListPanel({
  selectionMode,
  searchQuery,
  onSearchChange,
  chainFilter,
  onSelect,
  counterpartToken,
  extraTokens,
  recipient,
  selectedChain,
  onSelectChain,
  onMoreChainsClick,
}: MergedTokenListPanelProps) {
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
      <MergedTokenList
        selectionMode={selectionMode}
        searchQuery={searchQuery}
        chainFilter={chainFilter}
        onSelect={onSelect}
        counterpartToken={counterpartToken}
        extraTokens={extraTokens}
        recipient={recipient}
      />
    </div>
  );
}
