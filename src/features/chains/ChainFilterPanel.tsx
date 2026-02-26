import { ChevronIcon, PencilIcon } from '@hyperlane-xyz/widgets';
import { useState } from 'react';
import { SearchInput } from '../../components/input/SearchInput';
import { ChainList } from './ChainList';
import { ChainInfo } from './hooks';

interface ChainFilterPanelProps {
  searchQuery: string;
  onSearchChange: (s: string) => void;
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainInfo | null) => void;
  /** Called when user clicks a chain in edit mode */
  onEditChain?: (chainName: string) => void;
  /** Mobile only: show back button */
  showBackButton?: boolean;
  onBack?: () => void;
}

export function ChainFilterPanel({
  searchQuery,
  onSearchChange,
  selectedChain,
  onSelectChain,
  onEditChain,
  showBackButton,
  onBack,
}: ChainFilterPanelProps) {
  const [isEditMode, setIsEditMode] = useState(false);

  const handleChainClick = (chain: ChainInfo | null) => {
    if (isEditMode && chain && onEditChain) {
      onEditChain(chain.name);
    } else {
      onSelectChain(chain);
    }
  };

  return (
    <div className="flex w-full flex-col rounded-sm bg-gray-100 md:w-[282px]">
      <div className="relative shrink-0 px-4 py-4">
        {/* Back button only shown on mobile */}
        {showBackButton && (
          <button
            type="button"
            onClick={onBack}
            className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 md:hidden"
          >
            <ChevronIcon direction="w" width={14} height={14} />
          </button>
        )}
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search Chains"
          aria-label="Search chains"
        />
      </div>
      <div className="flex items-center justify-between px-4 pb-2">
        <h3 className="font-secondary text-sm font-normal text-black">Chain Selection</h3>
        <button
          type="button"
          onClick={() => setIsEditMode((prev) => !prev)}
          title={isEditMode ? 'Exit edit mode' : 'Edit chain metadata'}
          className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-gray-200"
        >
          <PencilIcon width={14} height={14} color={isEditMode ? '#9A0DFF' : '#6b7280'} />
        </button>
      </div>
      <ChainList
        searchQuery={searchQuery}
        selectedChain={selectedChain}
        onSelectChain={handleChainClick}
        isEditMode={isEditMode}
      />
    </div>
  );
}
