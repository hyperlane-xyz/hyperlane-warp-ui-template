import { ChainName } from '@hyperlane-xyz/sdk';
import { PencilIcon } from '@hyperlane-xyz/widgets';
import { useMemo } from 'react';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { Color } from '../../styles/Color';
import {
  ChainFilterState,
  SortState,
  chainSearch,
  defaultFilterState,
  defaultSortState,
} from './chainFilterSort';
import { ChainInfo, useChainInfos } from './hooks';

interface ChainListProps {
  searchQuery: string;
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainInfo | null) => void;
  isEditMode?: boolean;
  filterState?: ChainFilterState;
  sortState?: SortState;
}

export function ChainList({
  searchQuery,
  selectedChain,
  onSelectChain,
  isEditMode,
  filterState = defaultFilterState,
  sortState = defaultSortState,
}: ChainListProps) {
  const allChains = useChainInfos();

  const chains = useMemo(
    () =>
      chainSearch({ data: allChains, query: searchQuery, sort: sortState, filter: filterState }),
    [searchQuery, allChains, filterState, sortState],
  );

  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="h-full overflow-auto">
        {/* All Chains option - hidden in edit mode */}
        {!isEditMode && (
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
        )}

        {/* Individual chains */}
        {chains.map((chain) => (
          <ChainButton
            key={chain.name}
            isSelected={!isEditMode && selectedChain === chain.name}
            onClick={() => onSelectChain(chain)}
            icon={<ChainLogo chainName={chain.name} size={28} />}
            label={chain.displayName}
            showEditIcon={isEditMode}
            disabled={chain.disabled}
          />
        ))}

        {chains.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">No chains found</div>
        )}
        {/* Spacer for fade effect */}
        <div className="h-10" />
      </div>
      {/* Bottom fade effect */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-b from-transparent to-gray-100" />
    </div>
  );
}

function ChainButton({
  isSelected,
  onClick,
  icon,
  label,
  showEditIcon,
  disabled,
}: {
  isSelected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  showEditIcon?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`${styles.label} flex w-full items-center gap-3 border-l-2 px-4 py-2.5 transition-colors ${
        disabled
          ? 'border-transparent opacity-50'
          : isSelected
            ? 'border-primary-500 bg-primary-500/10 text-primary-700'
            : 'border-transparent text-black hover:bg-gray-200'
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      {showEditIcon && <PencilIcon width={14} height={14} color={Color.gray['500']} />}
    </button>
  );
}

const styles = {
  label: 'font-secondary text-sm font-normal',
};
