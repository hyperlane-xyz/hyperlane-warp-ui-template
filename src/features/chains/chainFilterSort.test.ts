import { ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, it } from 'vitest';

import {
  ChainSortBy,
  FilterTestnet,
  SortOrder,
  chainSearch,
  defaultFilterState,
  defaultSortState,
} from './chainFilterSort';
import { ChainInfo } from './hooks';

const makeChain = (overrides: Partial<ChainInfo> & { name: string }): ChainInfo => ({
  displayName: overrides.name,
  chainId: 1,
  protocol: ProtocolType.Ethereum,
  isTestnet: false,
  disabled: false,
  ...overrides,
});

const chains: ChainInfo[] = [
  makeChain({ name: 'ethereum', displayName: 'Ethereum', chainId: 1 }),
  makeChain({ name: 'polygon', displayName: 'Polygon', chainId: 137 }),
  makeChain({ name: 'arbitrum', displayName: 'Arbitrum', chainId: 42161 }),
  makeChain({
    name: 'solanamainnet',
    displayName: 'Solana',
    chainId: 1399811149,
    protocol: ProtocolType.Sealevel,
  }),
  makeChain({
    name: 'cosmoshub',
    displayName: 'Cosmos Hub',
    chainId: 'cosmoshub-4',
    protocol: ProtocolType.Cosmos,
  }),
  makeChain({ name: 'sepolia', displayName: 'Sepolia', chainId: 11155111, isTestnet: true }),
  makeChain({ name: 'disabled-chain', displayName: 'Disabled', chainId: 999, disabled: true }),
];

const search = (overrides: {
  query?: string;
  sort?: { sortBy: ChainSortBy; sortOrder: SortOrder };
  filter?: { type?: FilterTestnet; protocol?: ProtocolType };
}) =>
  chainSearch({
    data: chains,
    query: overrides.query ?? '',
    sort: overrides.sort ?? defaultSortState,
    filter: overrides.filter ?? defaultFilterState,
  });

describe('chainSearch', () => {
  describe('query', () => {
    it('returns all chains with empty query', () => {
      expect(search({})).toHaveLength(chains.length);
    });

    it('matches by name', () => {
      const result = search({ query: 'polygon' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('polygon');
    });

    it('matches by displayName case-insensitively', () => {
      const result = search({ query: 'SOLANA' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('solanamainnet');
    });

    it('matches by chainId', () => {
      const result = search({ query: '137' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('polygon');
    });

    it('matches broadly by chainId substring', () => {
      // '1' appears in chainIds: 1, 137, 42161, 1399811149, 11155111, 999 → all except 999
      const result = search({ query: '1' });
      expect(result.map((c) => c.name)).not.toContain('disabled-chain');
      expect(result.length).toBeGreaterThan(1);
    });
  });

  describe('filter', () => {
    it('filters by testnet', () => {
      const result = search({ filter: { type: FilterTestnet.Testnet } });
      expect(result.every((c) => c.isTestnet)).toBe(true);
    });

    it('filters by mainnet', () => {
      const result = search({ filter: { type: FilterTestnet.Mainnet } });
      expect(result.every((c) => !c.isTestnet)).toBe(true);
    });

    it('filters by protocol', () => {
      const result = search({ filter: { protocol: ProtocolType.Sealevel } });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('solanamainnet');
    });

    it('combines type and protocol filters', () => {
      const result = search({
        filter: { type: FilterTestnet.Mainnet, protocol: ProtocolType.Ethereum },
      });
      expect(result.every((c) => !c.isTestnet && c.protocol === ProtocolType.Ethereum)).toBe(true);
    });
  });

  describe('sort', () => {
    it('sorts featured chains first by default', () => {
      const result = search({});
      const names = result.filter((c) => !c.disabled).map((c) => c.name);
      expect(names).toEqual([
        'ethereum',
        'arbitrum',
        'solanamainnet',
        'polygon',
        'cosmoshub',
        'sepolia',
      ]);
    });

    it('sorts by name ascending', () => {
      const result = search({
        sort: { sortBy: ChainSortBy.Name, sortOrder: SortOrder.Asc },
      });
      const names = result.filter((c) => !c.disabled).map((c) => c.name);
      expect(names).toEqual([
        'arbitrum',
        'cosmoshub',
        'ethereum',
        'polygon',
        'sepolia',
        'solanamainnet',
      ]);
    });

    it('sorts by name descending', () => {
      const result = search({
        sort: { sortBy: ChainSortBy.Name, sortOrder: SortOrder.Desc },
      });
      const names = result.filter((c) => !c.disabled).map((c) => c.name);
      expect(names).toEqual([
        'solanamainnet',
        'sepolia',
        'polygon',
        'ethereum',
        'cosmoshub',
        'arbitrum',
      ]);
    });

    it('sorts by chainId ascending', () => {
      const result = search({
        sort: { sortBy: ChainSortBy.ChainId, sortOrder: SortOrder.Asc },
      });
      // Numeric sort: 1 < 137 < 42161 < ... then string IDs like "cosmoshub-4"
      const ids = result.filter((c) => !c.disabled).map((c) => c.chainId.toString());
      expect(ids).toEqual(['1', '137', '42161', '11155111', '1399811149', 'cosmoshub-4']);
    });

    it('sorts by protocol', () => {
      const result = search({
        sort: { sortBy: ChainSortBy.Protocol, sortOrder: SortOrder.Asc },
      });
      const protocols = result.filter((c) => !c.disabled).map((c) => c.protocol);
      expect(protocols).toEqual([
        ProtocolType.Cosmos,
        ProtocolType.Ethereum,
        ProtocolType.Ethereum,
        ProtocolType.Ethereum,
        ProtocolType.Ethereum,
        ProtocolType.Sealevel,
      ]);
    });

    it('sorts disabled chains to the bottom', () => {
      const result = search({});
      const lastChain = result[result.length - 1];
      expect(lastChain.disabled).toBe(true);
      expect(lastChain.name).toBe('disabled-chain');
    });
  });
});
