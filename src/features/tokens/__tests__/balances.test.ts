import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDestinationNativeBalance,
  useBalance,
  useDestinationBalance,
  useOriginBalance,
} from '../balances';

const { mockWarpCore } = vi.hoisted(() => {
  const mockTokens: any[] = [
    {
      name: 'Token A',
      symbol: 'TOKA',
      chainName: 'chain1',
      addressOrDenom: '0xtoken1',
      getBalance: vi.fn().mockResolvedValue({ amount: '2000' }),
      getConnectionForChain: vi.fn().mockReturnValue({
        token: {
          getBalance: vi.fn().mockResolvedValue({ amount: '2000' }),
          chainName: 'chain2',
          addressOrDenom: '0xtoken1-chain2',
        },
      }),
      connections: [
        {
          token: {
            getBalance: vi.fn().mockResolvedValue({ amount: '2000' }),
            chainName: 'chain2',
            addressOrDenom: '0xtoken1-chain2',
          },
        },
      ],
    },
    {
      name: 'Token B',
      symbol: 'TOKB',
      chainName: 'chain1',
      addressOrDenom: '0xtoken2',
      connections: [
        {
          token: {
            chainName: 'chain2',
            addressOrDenom: '0xtoken2-chain2',
          },
        },
      ],
    },
  ];

  const mockWarpCore = {
    tokens: mockTokens,
    findToken: vi.fn(),
    getTokensForRoute: vi.fn(),
  } as any;

  return {
    mockWarpCore,
  };
});

vi.mock('@hyperlane-xyz/widgets', () => {
  return {
    useAccountAddressForChain: vi.fn().mockReturnValue('0xtoken1'),
  };
});

vi.mock('../../store', () => ({
  useStore: (selector: (state: any) => unknown) => selector({ warpCore: mockWarpCore }),
}));

// Create a wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) => {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

vi.mock('@hyperlane-xyz/utils', async () => {
  const actual = await vi.importActual<any>('@hyperlane-xyz/utils');
  return {
    ...actual,
    isValidAddress: vi.fn().mockReturnValue(true),
  };
});

vi.mock('../chains/hooks', () => ({
  useMultiProvider: () => ({
    getChainMetadata: vi.fn().mockReturnValue({ nativeToken: { addressOrDenom: '0xtoken1' } }),
  }),
}));

vi.mock('@hyperlane-xyz/sdk', async () => {
  const actual = await vi.importActual<any>('@hyperlane-xyz/sdk');
  return {
    ...actual,
    Token: {
      ...actual.Token,
      FromChainMetadataNativeToken: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useBalance', () => {
  it('returns balance data when available', async () => {
    const mockToken = {
      addressOrDenom: '0xtokenaddress',
      protocol: 'ethereum',
      getBalance: vi.fn().mockResolvedValue({ amount: '1000' }),
    };
    const { result } = renderHook(
      () => useBalance('ethereum', mockToken as any, '0xowneraddress'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.balance).toEqual({ amount: '1000' });
  });

  it('handles error when fetching balance', async () => {
    const mockToken = {
      addressOrDenom: '0xtokenaddress',
      protocol: 'ethereum',
      getBalance: vi.fn().mockRejectedValue(new Error('Failed to fetch balance')),
    };
    const { result } = renderHook(
      () => useBalance('ethereum', mockToken as any, '0xowneraddress'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(result.current.balance).toBeUndefined();
  });
});

describe('useOriginBalance', () => {
  it('returns origin balance data when available', async () => {
    const { result } = renderHook(
      () => useOriginBalance({ origin: 'chain1', tokenIndex: 0 } as any),
      {
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.balance).toEqual({ amount: '2000' });
  });

  it('handles error when fetching origin balance', async () => {
    const { result } = renderHook(
      () => useOriginBalance({ origin: 'ethereum', tokenIndex: 3 } as any),
      {
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.balance).toBeUndefined();
  });
});

describe('useDestinationBalance', () => {
  it('returns destination balance data when available', async () => {
    const { result } = renderHook(
      () =>
        useDestinationBalance({
          destination: 'chain2',
          tokenIndex: 0,
          recipient: '0xrecipientaddress',
        } as any),
      {
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.balance).toEqual({ amount: '2000' });
  });

  it('handles error when fetching destination balance', async () => {
    const { result } = renderHook(
      () =>
        useDestinationBalance({
          destination: 'chain3',
          tokenIndex: 3,
          recipient: '0xrecipientaddress',
        } as any),
      {
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.balance).toBeUndefined();
  });
});

describe('getDestinationNativeBalance', () => {
  afterEach(() => {
    vi.restoreAllMocks(); // Auto cleanup after each test
  });

  it('returns native balance when available', async () => {
    const mockMultiProvider = {
      tryGetChainMetadata: vi.fn().mockReturnValue({
        displayName: 'test',
        name: 'test',
        nativeToken: { addressOrDenom: '0xnative' },
      }),
      getChainMetadata: vi.fn().mockReturnValue({
        displayName: 'test',
        name: 'test',
        nativeToken: { addressOrDenom: '0xnative' },
      }),
    };

    const mockNativeToken = {
      addressOrDenom: '0xnative',
      chainName: 'chain1',
      getBalance: vi.fn().mockResolvedValue({ amount: '2000' }),
    };

    const Token = await import('@hyperlane-xyz/sdk').then((mod) => mod.Token);
    vi.spyOn(Token, 'FromChainMetadataNativeToken').mockReturnValue(mockNativeToken as any);

    const result = getDestinationNativeBalance(
      mockMultiProvider as any,
      { destination: 'chain1', recipient: '0xrecipientaddress' } as any,
    );
    await waitFor(() => expect(result).resolves.toBe('2000'));
  });

  it('handles error when fetching native balance', async () => {
    const mockMultiProvider = {
      tryGetChainMetadata: vi.fn().mockReturnValue({
        displayName: 'test',
        name: 'test',
        nativeToken: { addressOrDenom: '0xnative' },
      }),
      getChainMetadata: vi.fn().mockReturnValue({
        displayName: 'test',
        name: 'test',
        nativeToken: { addressOrDenom: '0xnative' },
      }),
    };

    const Token = await import('@hyperlane-xyz/sdk').then((mod) => mod.Token);
    vi.spyOn(Token, 'FromChainMetadataNativeToken').mockRejectedValue(new Error('Something wrong'));

    const result = getDestinationNativeBalance(
      mockMultiProvider as any,
      { destination: 'chain1', recipient: '0xrecipientaddress' } as any,
    );
    await waitFor(() => expect(result).resolves.toBeUndefined());
  });
});
