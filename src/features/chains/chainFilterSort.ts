import { ProtocolType } from '@hyperlane-xyz/utils';
import { ChainInfo } from './hooks';

// ── Sort ────────────────────────────────────────────────────────────
export enum ChainSortBy {
  Name = 'name',
  ChainId = 'chain id',
  Protocol = 'protocol',
}

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

export interface SortState {
  sortBy: ChainSortBy;
  sortOrder: SortOrder;
}

export const defaultSortState: SortState = {
  sortBy: ChainSortBy.Name,
  sortOrder: SortOrder.Asc,
};

// ── Filter ──────────────────────────────────────────────────────────
export enum FilterTestnet {
  Testnet = 'testnet',
  Mainnet = 'mainnet',
}

export interface ChainFilterState {
  type?: FilterTestnet;
  protocol?: ProtocolType;
}

export const defaultFilterState: ChainFilterState = {
  type: undefined,
  protocol: undefined,
};

export function isFilterActive(filter: ChainFilterState): boolean {
  return filter.type !== undefined || filter.protocol !== undefined;
}

export const sortOptions = [ChainSortBy.Name, ChainSortBy.ChainId, ChainSortBy.Protocol];

// ── Combined search + filter + sort (mirrors widgets' chainSearch) ──
export function chainSearch({
  data,
  query,
  sort,
  filter,
}: {
  data: ChainInfo[];
  query: string;
  sort: SortState;
  filter: ChainFilterState;
}): ChainInfo[] {
  const q = query.trim().toLowerCase();
  return (
    data
      // Query search
      .filter(
        (chain) =>
          !q ||
          chain.name.toLowerCase().includes(q) ||
          chain.displayName.toLowerCase().includes(q) ||
          chain.chainId.toString().includes(q),
      )
      // Filter options
      .filter((chain) => {
        let included = true;
        if (filter.type) {
          included &&= chain.isTestnet === (filter.type === FilterTestnet.Testnet);
        }
        if (filter.protocol) {
          included &&= chain.protocol === filter.protocol;
        }
        return included;
      })
      // Sort options
      .sort((c1, c2) => {
        // Disabled chains always at the bottom
        if (c1.disabled && !c2.disabled) return 1;
        if (!c1.disabled && c2.disabled) return -1;

        if (sort.sortBy === ChainSortBy.ChainId) {
          const result = Number(c1.chainId) - Number(c2.chainId);
          return sort.sortOrder === SortOrder.Asc ? result : -result;
        }

        let v1 = c1.name;
        let v2 = c2.name;
        if (sort.sortBy === ChainSortBy.Protocol) {
          v1 = c1.protocol;
          v2 = c2.protocol;
        }
        return sort.sortOrder === SortOrder.Asc ? v1.localeCompare(v2) : v2.localeCompare(v1);
      })
  );
}
