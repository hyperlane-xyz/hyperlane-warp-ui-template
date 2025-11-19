import { IToken, TokenAmount } from '@hyperlane-xyz/sdk';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@hyperlane-xyz/widgets', () => ({
  useAccounts: vi.fn(),
  getAccountAddressAndPubKey: vi.fn(),
}));

vi.mock('../../chains/hooks', () => ({
  useMultiProvider: vi.fn(),
}));

vi.mock('../../tokens/hooks', () => ({
  useWarpCore: vi.fn(),
  getTokenByIndex: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

import { getAccountAddressAndPubKey, useAccounts } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import { useMultiProvider } from '../../chains/hooks';
import { getTokenByIndex, useWarpCore } from '../../tokens/hooks';
import { TransferFormValues } from '../types';
import { useFeeQuotes } from '../useFeeQuotes';

describe('useFeeQuotes', () => {
  const mockMultiProvider = { getChainName: vi.fn() };
  const mockWarpCore = {
    estimateTransferRemoteFees: vi.fn(),
  };
  const mockAccounts = [{ address: '0x123' }];
  const mockSender = '0x123';
  const mockSenderPubKey = Promise.resolve('0xpubkey');
  const mockToken = { symbol: 'USDC', decimals: 6 } as IToken;
  const mockInterchainQuote = new TokenAmount(100n, mockToken);
  const mockLocalQuote = new TokenAmount(50n, mockToken);

  beforeEach(() => {
    vi.clearAllMocks();
    (useMultiProvider as any).mockReturnValue(mockMultiProvider);
    (useWarpCore as any).mockReturnValue(mockWarpCore);
    (useAccounts as any).mockReturnValue({ accounts: mockAccounts });
    (getAccountAddressAndPubKey as any).mockReturnValue({
      address: mockSender,
      publicKey: mockSenderPubKey,
    });
    (getTokenByIndex as any).mockReturnValue(mockToken);
  });

  it('should return loading, error, and fees properties', () => {
    (useQuery as any).mockReturnValue({
      isLoading: false,
      isError: false,
      data: null,
    });

    const { result } = renderHook(() =>
      useFeeQuotes(
        {
          origin: 'ethereum',
          destination: 'polygon',
          tokenIndex: 0,
          amount: '100',
          recipient: '0x123',
        },
        true,
      ),
    );

    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('isError');
    expect(result.current).toHaveProperty('fees');
  });

  it('should call useQuery with correct parameters', () => {
    (useQuery as any).mockReturnValue({
      isLoading: false,
      isError: false,
      data: null,
    });

    renderHook(() =>
      useFeeQuotes(
        {
          origin: 'ethereum',
          destination: 'polygon',
          tokenIndex: 0,
          amount: '100',
          recipient: '0x123',
        },
        true,
      ),
    );

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['useFeeQuotes', 'polygon', 0, mockSender, mockSenderPubKey],
        queryFn: expect.any(Function),
        enabled: true,
        refetchInterval: 15_000,
      }),
    );
  });

  it('should return loading state from useQuery', () => {
    (useQuery as any).mockReturnValue({
      isLoading: true,
      isError: false,
      data: null,
    });

    const { result } = renderHook(() =>
      useFeeQuotes(
        {
          origin: 'ethereum',
          destination: 'polygon',
          tokenIndex: 0,
          amount: '100',
          recipient: '0x123',
        },
        true,
      ),
    );

    expect(result.current.isLoading).toBe(true);
  });

  it('should return error state from useQuery', () => {
    (useQuery as any).mockReturnValue({
      isLoading: false,
      isError: true,
      data: null,
    });

    const { result } = renderHook(() =>
      useFeeQuotes(
        {
          origin: 'ethereum',
          destination: 'polygon',
          tokenIndex: 0,
          amount: '100',
          recipient: '0x123',
        },
        true,
      ),
    );

    expect(result.current.isError).toBe(true);
  });

  it('should return fee quotes data', () => {
    const mockFeeData = {
      interchainQuote: mockInterchainQuote,
      localQuote: mockLocalQuote,
    };
    (useQuery as any).mockReturnValue({
      isLoading: false,
      isError: false,
      data: mockFeeData,
    });

    const { result } = renderHook(() =>
      useFeeQuotes(
        {
          origin: 'ethereum',
          destination: 'polygon',
          tokenIndex: 0,
          amount: '100',
          recipient: '0x123',
        },
        true,
      ),
    );

    expect(result.current.fees).toEqual(mockFeeData);
  });

  it('should disable query when enabled is false', () => {
    (useQuery as any).mockReturnValue({
      isLoading: false,
      isError: false,
      data: null,
    });

    renderHook(() =>
      useFeeQuotes(
        {
          origin: 'ethereum',
          destination: 'polygon',
          tokenIndex: 0,
          amount: '100',
          recipient: '0x123',
        },
        false,
      ),
    );

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });

  it('should handle missing tokenIndex', () => {
    (useQuery as any).mockReturnValue({
      isLoading: false,
      isError: false,
      data: null,
    });

    const { result } = renderHook(() =>
      useFeeQuotes(
        {
          origin: 'ethereum',
          destination: 'polygon',
          tokenIndex: undefined,
          amount: '100',
          recipient: '0x123',
        },
        true,
      ),
    );

    expect(result.current.fees).toBeNull();
  });

  it('should call getAccountAddressAndPubKey with correct parameters', () => {
    (useQuery as any).mockReturnValue({
      isLoading: false,
      isError: false,
      data: null,
    });

    renderHook(() =>
      useFeeQuotes(
        {
          origin: 'ethereum',
          destination: 'polygon',
          tokenIndex: 0,
          amount: '100',
          recipient: '0x123',
        },
        true,
      ),
    );

    expect(getAccountAddressAndPubKey).toHaveBeenCalledWith(
      mockMultiProvider,
      'ethereum',
      mockAccounts,
    );
  });

  it('should use correct refetch interval', () => {
    (useQuery as any).mockReturnValue({
      isLoading: false,
      isError: false,
      data: null,
    });

    renderHook(() =>
      useFeeQuotes(
        {
          origin: 'ethereum',
          destination: 'polygon',
          tokenIndex: 0,
          amount: '100',
          recipient: '0x123',
        },
        true,
      ),
    );

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        refetchInterval: 15_000,
      }),
    );
  });

  it('should handle multiple sequential calls with different parameters', () => {
    (useQuery as any).mockReturnValue({
      isLoading: false,
      isError: false,
      data: null,
    });

    const { rerender } = renderHook(
      ({ params, enabled }) => useFeeQuotes(params as TransferFormValues, enabled),
      {
        initialProps: {
          params: { origin: 'ethereum', destination: 'polygon', tokenIndex: 0 },
          enabled: true,
        },
      },
    );

    expect(useQuery).toHaveBeenCalledTimes(1);

    rerender({
      params: { origin: 'ethereum', destination: 'arbitrum', tokenIndex: 1 },
      enabled: true,
    });

    expect(useQuery).toHaveBeenCalledTimes(2);
    expect(useQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryKey: ['useFeeQuotes', 'arbitrum', 1, mockSender, mockSenderPubKey],
      }),
    );
  });
});
