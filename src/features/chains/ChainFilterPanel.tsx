import { SearchInput } from '../../components/input/SearchInput';
import { ChainList } from './ChainList';

interface ChainFilterPanelProps {
  searchQuery: string;
  onSearchChange: (s: string) => void;
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainName | null) => void;
}

export function ChainFilterPanel({
  searchQuery,
  onSearchChange,
  selectedChain,
  onSelectChain,
}: ChainFilterPanelProps) {
  return (
    <div className="flex w-56 flex-col border-r border-gray-200 bg-gray-50">
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Filter by Chain</h3>
        <SearchInput value={searchQuery} onChange={onSearchChange} placeholder="Search chains..." />
      </div>
      <ChainList
        searchQuery={searchQuery}
        selectedChain={selectedChain}
        onSelectChain={onSelectChain}
      />
    </div>
  );
}
