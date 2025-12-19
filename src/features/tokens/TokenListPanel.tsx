import { Token } from '@hyperlane-xyz/sdk';
import { useEffect, useRef } from 'react';
import { SearchInput } from '../../components/input/SearchInput';
import { TokenList } from './TokenList';
import { TokenSelectionMode } from './types';

interface TokenListPanelProps {
  selectionMode: TokenSelectionMode;
  searchQuery: string;
  onSearchChange: (s: string) => void;
  chainFilter: ChainName | null;
  onSelect: (token: Token) => void;
  counterpartToken?: Token;
}

export function TokenListPanel({
  selectionMode,
  searchQuery,
  onSearchChange,
  chainFilter,
  onSelect,
  counterpartToken,
}: TokenListPanelProps) {
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
