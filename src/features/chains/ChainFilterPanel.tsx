import { ChainName } from '@hyperlane-xyz/sdk';
import { ProtocolType, toTitleCase } from '@hyperlane-xyz/utils';
import { ArrowIcon, ChevronIcon, FunnelIcon, PencilIcon, XIcon } from '@hyperlane-xyz/widgets';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SearchInput } from '../../components/input/SearchInput';
import {
  ChainFilterState,
  FilterTestnet,
  SortOrder,
  SortState,
  defaultFilterState,
  defaultSortState,
  isFilterActive,
  sortOptions,
} from './chainFilterSort';
import { ChainList } from './ChainList';
import { ChainInfo } from './hooks';

interface ChainFilterPanelProps {
  searchQuery: string;
  onSearchChange: (s: string) => void;
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainInfo | null) => void;
  onEditChain?: (chainName: string) => void;
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
  const [filterState, setFilterState] = useState<ChainFilterState>(defaultFilterState);
  const [sortState, setSortState] = useState<SortState>(defaultSortState);

  const handleChainClick = (chain: ChainInfo | null) => {
    if (isEditMode && chain && onEditChain) {
      onEditChain(chain.name);
    } else {
      onSelectChain(chain);
    }
  };

  const hasActiveFilter = isFilterActive(filterState);
  const isNonDefaultSort =
    sortState.sortBy !== defaultSortState.sortBy ||
    sortState.sortOrder !== defaultSortState.sortOrder;

  return (
    <div className="flex w-full flex-col rounded-sm bg-gray-100 md:w-[282px]">
      <div className="relative shrink-0 px-4 py-4">
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

      {/* Toolbar: label + filter/sort/edit icons */}
      <div className="flex items-center justify-between px-4 pb-2">
        <h3 className="font-secondary text-sm font-normal text-black">Chain Selection</h3>
        <div className="flex items-center gap-1">
          <FilterButton
            filterState={filterState}
            onChange={setFilterState}
            isActive={hasActiveFilter}
          />
          <SortButton sortState={sortState} onChange={setSortState} isActive={isNonDefaultSort} />
          <button
            type="button"
            onClick={() => setIsEditMode((prev) => !prev)}
            title={isEditMode ? 'Exit edit mode' : 'Edit chain metadata'}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-gray-200"
          >
            <PencilIcon width={14} height={14} color={isEditMode ? '#9A0DFF' : '#6b7280'} />
          </button>
        </div>
      </div>

      <ChainList
        searchQuery={searchQuery}
        selectedChain={selectedChain}
        onSelectChain={handleChainClick}
        isEditMode={isEditMode}
        filterState={filterState}
        sortState={sortState}
      />
    </div>
  );
}

// ── Filter dropdown ─────────────────────────────────────────────────
function FilterButton({
  filterState,
  onChange,
  isActive,
}: {
  filterState: ChainFilterState;
  onChange: (s: ChainFilterState) => void;
  isActive: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setIsOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        title="Filter chains"
        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-gray-200"
      >
        <FunnelIcon width={14} height={14} color={isActive ? '#9A0DFF' : '#6b7280'} />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Filters</span>
            {isActive && (
              <button
                type="button"
                onClick={() => onChange(defaultFilterState)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
              >
                <XIcon width={8} height={8} />
                Clear
              </button>
            )}
          </div>

          {/* Type filter */}
          <div className="mb-3">
            <label className="mb-1.5 block text-xs text-gray-500">Type</label>
            <div className="flex gap-1">
              {Object.values(FilterTestnet).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    onChange({ ...filterState, type: filterState.type === opt ? undefined : opt })
                  }
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    filterState.type === opt
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {toTitleCase(opt)}
                </button>
              ))}
            </div>
          </div>

          {/* Protocol filter */}
          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Protocol</label>
            <div className="flex flex-wrap gap-1">
              {Object.values(ProtocolType).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...filterState,
                      protocol: filterState.protocol === opt ? undefined : opt,
                    })
                  }
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    filterState.protocol === opt
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {toTitleCase(opt)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sort dropdown ───────────────────────────────────────────────────
function SortButton({
  sortState,
  onChange,
  isActive,
}: {
  sortState: SortState;
  onChange: (s: SortState) => void;
  isActive: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setIsOpen(false));

  const toggleOrder = () => {
    onChange({
      ...sortState,
      sortOrder: sortState.sortOrder === SortOrder.Asc ? SortOrder.Desc : SortOrder.Asc,
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        title={`Sort: ${toTitleCase(sortState.sortBy)} (${sortState.sortOrder})`}
        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-gray-200"
      >
        <ArrowIcon
          direction={sortState.sortOrder === SortOrder.Asc ? 'n' : 's'}
          width={14}
          height={14}
          color={isActive ? '#9A0DFF' : '#6b7280'}
        />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-md">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5">
            <span className="text-xs font-medium text-gray-500">Sort by</span>
            <button
              type="button"
              onClick={toggleOrder}
              title="Toggle sort order"
              className="rounded p-0.5 hover:bg-gray-100"
            >
              <ArrowIcon
                direction={sortState.sortOrder === SortOrder.Asc ? 'n' : 's'}
                width={12}
                height={12}
              />
            </button>
          </div>
          {sortOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange({ sortBy: opt, sortOrder: sortState.sortOrder });
                setIsOpen(false);
              }}
              className={`w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-gray-100 ${
                sortState.sortBy === opt ? 'font-medium text-primary-500' : 'text-gray-700'
              }`}
            >
              {toTitleCase(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Hook: close on outside click ────────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handlerRef.current();
      }
    },
    [ref],
  );

  useEffect(() => {
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onPointerDown]);
}
