import { describe, expect, it } from 'vitest';

import type { FastRoute } from '../config/routes';
import type { McRoute } from '../config/multichain';
import { chainStatus, convertDecimals, DEFAULT_SOURCES, pickerChains, pickOption, receivesGas, tokenOptions, type LaneSources } from './lanes';

const eth = (address: string) => ({ address, standard: 'EvmHypNative', tokenType: 'native', symbol: 'ETH', name: 'Ether', decimals: 18, collateralAddress: null });
const classic: FastRoute[] = [
  { id: 'ETH/arbitrumsepolia-gullychaintestnet-native', symbol: 'ETH', tokens: { arbitrumsepolia: eth('0xa'), gullychaintestnet: eth('0xb') } as never },
  { id: 'GETH/arbitrumsepolia-gullychaintestnet', symbol: 'GETH', legacy: true, tokens: { arbitrumsepolia: eth('0xc'), gullychaintestnet: eth('0xd') } as never },
];
const tok = (address: string | null, tokenType: string, symbol: string, decimals: number, collateralAddress: string | null = null) => ({
  address,
  standard: address ? 'x' : null,
  tokenType,
  symbol,
  name: symbol,
  decimals,
  collateralAddress,
});
const usdc: McRoute = {
  id: 'USDC/arbitrumsepolia-basesepolia-bsctestnet-gullychaintestnet-sepolia',
  key: 'USDC',
  symbol: 'USDC',
  name: 'USD Coin',
  deployed: true,
  tokens: {
    gullychaintestnet: tok('0x01', 'collateral', 'USDC', 6, '0x65Ba'),
    arbitrumsepolia: tok('0x02', 'collateral', 'USDC', 6, '0x75fa'),
    bsctestnet: tok(null, 'collateral', 'USDC', 18, '0x6454'), // leg not deployed yet
  },
};
const sol: McRoute = {
  id: 'SOL/gullychaintestnet-solanadevnet',
  key: 'SOL',
  symbol: 'SOL',
  name: 'Solana',
  deployed: false,
  tokens: { gullychaintestnet: tok(null, 'synthetic', 'SOL', 9), solanadevnet: tok(null, 'native', 'SOL', 9) },
};
const src: LaneSources = { classic, defaultClassicId: classic[0].id, multichain: [usdc, sol], canonicalChains: ['arbitrumsepolia'] };

describe('route availability', () => {
  it('Arbitrum Sepolia: live native ETH (classic, with the Cheapest lane) first, then multi-chain USDC', () => {
    const o = tokenOptions('arbitrumsepolia', 'deposit', src);
    expect(o.map((x) => [x.id, x.source, x.live, x.canonical])).toEqual([
      [classic[0].id, 'classic', true, true],
      [usdc.id, 'multichain', true, false],
    ]);
    expect(o[0].from).toBe('arbitrumsepolia');
    expect(o[0].to).toBe('gullychaintestnet');
  });

  it('never offers a retired classic route', () => {
    expect(tokenOptions('arbitrumsepolia', 'deposit', src).some((x) => x.id === classic[1].id)).toBe(false);
  });

  it('a leg without a router is "Coming soon", both directions', () => {
    const d = tokenOptions('bsctestnet', 'deposit', src);
    expect(d).toHaveLength(1);
    expect(d[0].live).toBe(false);
    const w = tokenOptions('bsctestnet', 'withdraw', src);
    expect(w[0].from).toBe('gullychaintestnet');
    expect(w[0].send.decimals).toBe(6);
    expect(w[0].receive.decimals).toBe(18);
    expect(chainStatus('bsctestnet', src)).toBe('soon');
  });

  it('planned Solana route: visible, not live; chains with no route are hidden', () => {
    expect(chainStatus('solanadevnet', src)).toBe('soon');
    expect(chainStatus('arbitrumsepolia', src)).toBe('live');
    expect(chainStatus('basesepolia', src)).toBe('none');
    expect(tokenOptions('solanadevnet', 'deposit', src)[0].send.chain).toBe('solanadevnet');
  });

  it('picks the wanted token, else the first live one', () => {
    const o = tokenOptions('arbitrumsepolia', 'deposit', src);
    expect(pickOption(o, usdc.id)?.id).toBe(usdc.id);
    expect(pickOption(o, 'nope')?.id).toBe(classic[0].id);
    expect(pickOption(tokenOptions('solanadevnet', 'deposit', src))?.id).toBe(sol.id);
    expect(pickOption([])).toBeUndefined();
  });

  it('gas on arrival only for tokens that are not native on the destination', () => {
    expect(receivesGas(tokenOptions('arbitrumsepolia', 'deposit', src)[0])).toBe(true);
    expect(receivesGas(tokenOptions('arbitrumsepolia', 'deposit', src)[1])).toBe(false);
  });

  it('converts decimals 1:1 (BSC USDC 18 <-> 6)', () => {
    expect(convertDecimals(1_500_000_000_000_000_000n, 18, 6)).toBe(1_500_000n);
    expect(convertDecimals(1_500_000n, 6, 18)).toBe(1_500_000_000_000_000_000n);
    expect(convertDecimals(7n, 9, 9)).toBe(7n);
  });

  it('the generated routes.json: ETH with Arbitrum Sepolia is live, the manifest chains are listed', () => {
    const arb = tokenOptions('arbitrumsepolia', 'deposit', DEFAULT_SOURCES);
    expect(arb[0].source).toBe('classic');
    expect(arb[0].live).toBe(true);
    const chains = pickerChains(DEFAULT_SOURCES);
    expect(chains[0]).toBe('arbitrumsepolia');
    for (const c of ['sepolia', 'basesepolia', 'bsctestnet', 'solanadevnet'] as const) expect(chains).toContain(c);
    expect(tokenOptions('solanadevnet', 'deposit', DEFAULT_SOURCES).map((o) => o.send.symbol).sort()).toEqual(['SOL', 'USDC']);
  });
});
