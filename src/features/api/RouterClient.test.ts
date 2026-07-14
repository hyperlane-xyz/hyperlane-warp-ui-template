import { afterEach, describe, expect, test, vi } from 'vitest';

import { RouterClient } from './RouterClient';
import { ChainsResponseSchema } from './types';

const baseChain = {
  id: 1,
  name: 'Ethereum',
  chainName: 'ethereum',
  protocol: 'ethereum',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  universalRouter: '0x1111111111111111111111111111111111111111',
  dex: null,
  canSwap: true,
  canExecute: true,
  supportsNative: true,
};

describe('RouterClient.availableRoutes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('serializes source-side query params', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          direction: 'fromSource',
          tokens: [],
        }),
      ),
    );

    await new RouterClient('https://router.test').availableRoutes({
      srcChain: 1,
      srcToken: '0x1111111111111111111111111111111111111111',
      dstChain: null,
      dstToken: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://router.test/v1/available-routes?srcChain=1&srcToken=0x1111111111111111111111111111111111111111',
    );
  });

  test('serializes destination-side query params', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          direction: 'toDestination',
          tokens: [],
        }),
      ),
    );

    await new RouterClient('https://router.test').availableRoutes({
      srcChain: null,
      srcToken: null,
      dstChain: 'stride-1',
      dstToken: 'uusdc',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://router.test/v1/available-routes?dstChain=stride-1&dstToken=uusdc',
    );
  });

  test('rejects malformed side selection before calling the engine', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const client = new RouterClient('https://router.test');

    expect(() => client.availableRoutes({ srcChain: 1 })).toThrow('srcChain and srcToken together');
    expect(() =>
      client.availableRoutes({
        srcChain: 1,
        srcToken: '0x1111111111111111111111111111111111111111',
        dstChain: 10,
        dstToken: '0x2222222222222222222222222222222222222222',
      }),
    ).toThrow('exactly one source or destination token');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('RouterClient.tokens', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('serializes string chain selectors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          chain: null,
          tokens: [],
        }),
      ),
    );

    await new RouterClient('https://router.test').tokens({ chain: 'ethereum' });

    expect(fetchMock).toHaveBeenCalledWith('https://router.test/v1/tokens?chain=ethereum');
  });
});

describe('ChainsResponseSchema', () => {
  test('accepts non-EVM universal router identifiers', () => {
    expect(() =>
      ChainsResponseSchema.parse({
        chains: [
          {
            ...baseChain,
            id: 1399811149,
            name: 'Solana',
            chainName: 'solanamainnet',
            protocol: 'sealevel',
            nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
            universalRouter: 'ComputeBudget111111111111111111111111111111',
          },
        ],
      }),
    ).not.toThrow();
  });

  test('keeps permit2 constrained to EVM hex addresses', () => {
    expect(() =>
      ChainsResponseSchema.parse({
        chains: [
          {
            ...baseChain,
            permit2: 'ComputeBudget111111111111111111111111111111',
          },
        ],
      }),
    ).toThrow();
  });
});
