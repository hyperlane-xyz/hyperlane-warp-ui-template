import { ChevronIcon } from '@hyperlane-xyz/widgets';
import { SearchInput } from '../../components/input/SearchInput';
import { ChainList } from './ChainList';

interface ChainFilterPanelProps {
  searchQuery: string;
  onSearchChange: (s: string) => void;
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainName | null) => void;
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
    <div className="flex w-full flex-col border-r border-gray-200 bg-gray-50 md:w-56">
      <div className="flex shrink-0 items-center border-b border-gray-200 bg-white px-4 py-4">
        <div className="flex gap-2">
          {/* Back button only shown on mobile */}
          {showBackButton && (
            <button
              type="button"
              onClick={onBack}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 md:hidden"
            >
              <ChevronIcon direction="w" width={14} height={14} />
            </button>
          )}
        </div>
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search chains..."
          aria-label="Search chains"
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
