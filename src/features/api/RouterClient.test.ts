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

const baseToken = {
  chainId: 56,
  address: '0x2222222222222222222222222222222222222222',
  symbol: 'TEST',
  decimals: 18,
  isNative: false,
  isBridgeToken: true,
  isPoolToken: false,
  canBridge: true,
  canSwap: false,
  bridgeSymbols: ['TEST'],
  warpRouteIds: ['TEST/route'],
};

const baseRoute = {
  steps: [],
  output: '100',
  outputMin: '99',
  executionKind: 'warpDirect',
  connection: { symbol: 'TEST', warpRouteId: 'TEST/route' },
  gas: { originGas: '1', destGas: '1' },
  tx: null,
  approval: null,
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
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
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
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
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

describe('RouterClient.maxQuote', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('requests a max quote without an input amount', async () => {
    const response = {
      amount: '900',
      routes: [],
      expiresAt: Math.floor(Date.now() / 1000) + 30,
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(response)));

    await expect(
      new RouterClient('https://router.test').maxQuote({
        srcChain: 1,
        dstChain: 42161,
        srcToken: '0x0000000000000000000000000000000000000000',
        dstToken: '0x0000000000000000000000000000000000000000',
        sender: '0x1111111111111111111111111111111111111111',
        recipient: '0x2222222222222222222222222222222222222222',
        slippageBps: 100,
        senderPubKey: '0xabcd',
      }),
    ).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://router.test/v1/quote/max',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          srcChain: 1,
          dstChain: 42161,
          srcToken: '0x0000000000000000000000000000000000000000',
          dstToken: '0x0000000000000000000000000000000000000000',
          sender: '0x1111111111111111111111111111111111111111',
          recipient: '0x2222222222222222222222222222222222222222',
          slippageBps: 100,
          senderPubKey: '0xabcd',
        }),
        signal: expect.any(AbortSignal),
      }),
    );
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

    expect(fetchMock).toHaveBeenCalledWith(
      'https://router.test/v1/tokens?chain=ethereum',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test('hides tokens available only through denied routes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          baseToken,
          { ...baseToken, symbol: 'HIDDEN', warpRouteIds: ['NES/bsc'] },
          { ...baseToken, symbol: 'SHARED', warpRouteIds: ['NES/bsc', 'TEST/route'] },
        ]),
      ),
    );

    await expect(new RouterClient('https://router.test', ['NES/bsc']).tokens()).resolves.toEqual({
      tokens: [
        baseToken,
        { ...baseToken, symbol: 'SHARED', warpRouteIds: ['NES/bsc', 'TEST/route'] },
      ],
    });
  });
});

describe('RouterClient route denylist', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('hides denied available-route tokens', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          direction: 'fromSource',
          tokens: [baseToken, { ...baseToken, symbol: 'HIDDEN', warpRouteIds: ['NES/bsc'] }],
        }),
      ),
    );

    await expect(
      new RouterClient('https://router.test', ['NES/bsc']).availableRoutes({
        srcChain: 56,
        srcToken: baseToken.address,
      }),
    ).resolves.toEqual({ direction: 'fromSource', tokens: [baseToken] });
  });

  test('hides denied quote routes and their rejections', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          routes: [
            baseRoute,
            {
              ...baseRoute,
              connection: { symbol: 'NES', warpRouteId: 'NES/bsc' },
            },
          ],
          expiresAt: 1,
          rejections: [
            {
              code: 'NO_ROUTE',
              message: 'hidden',
              srcChain: 56,
              dstChain: 41444,
              srcToken: baseToken.address,
              dstToken: baseToken.address,
              amount: '1',
              warpRouteId: 'NES/bsc',
            },
          ],
        }),
      ),
    );

    await expect(
      new RouterClient('https://router.test', ['NES/bsc']).quote({
        srcChain: 56,
        dstChain: 41444,
        srcToken: baseToken.address,
        dstToken: baseToken.address,
        amount: 1n,
        sender: '0x1111111111111111111111111111111111111111',
      }),
    ).resolves.toEqual({ routes: [baseRoute], expiresAt: 1, rejections: [] });
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
