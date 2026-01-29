import { ChevronIcon } from '@hyperlane-xyz/widgets';
import { SearchInput } from '../../components/input/SearchInput';
import { ChainList } from './ChainList';
import { ChainInfo } from './hooks';

interface ChainFilterPanelProps {
  searchQuery: string;
  onSearchChange: (s: string) => void;
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainInfo | null) => void;
  /** Mobile only: show back button */
  showBackButton?: boolean;
  onBack?: () => void;
}

export function ChainFilterPanel({
  searchQuery,
  onSearchChange,
  selectedChain,
  onSelectChain,
  showBackButton,
  onBack,
}: ChainFilterPanelProps) {
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
      <div className="px-4 pb-2">
        <h3 className="font-secondary text-sm font-normal text-black">Chain Selection</h3>
      </div>
      <ChainList
        searchQuery={searchQuery}
        selectedChain={selectedChain}
        onSelectChain={onSelectChain}
      />
    </div>
  );
}
