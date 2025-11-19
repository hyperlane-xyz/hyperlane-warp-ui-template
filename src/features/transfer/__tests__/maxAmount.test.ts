import { TokenAmount } from '@hyperlane-xyz/sdk';
import { getAccountAddressAndPubKey } from '@hyperlane-xyz/widgets';
import { useMutation } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { toast } from 'react-toastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../../utils/logger';
import { useMultiProvider } from '../../chains/hooks';
import { isMultiCollateralLimitExceeded } from '../../limits/utils';
import { useWarpCore } from '../../tokens/hooks';
import { useFetchMaxAmount } from '../maxAmount';

vi.mock('../../chains/hooks');
vi.mock('../../tokens/hooks');
vi.mock('../../limits/utils');
vi.mock('@tanstack/react-query');
vi.mock('@hyperlane-xyz/sdk', async () => {
  const actual = await vi.importActual<typeof import('@hyperlane-xyz/sdk')>('@hyperlane-xyz/sdk');
  return {
    ...actual,
    TokenAmount: vi
      .fn()
      .mockImplementation((amount: unknown, token: unknown) => ({ amount, token })),
  };
});
vi.mock('@hyperlane-xyz/widgets', () => ({
  getAccountAddressAndPubKey: vi.fn(),
}));
vi.mock('react-toastify', () => ({
  toast: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('../../../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useFetchMaxAmount', () => {
  const mockMultiProvider = {
    getProvider: vi.fn(),
  };

  const mockWarpCore = {
    getMaxAmount: vi.fn(),
  };

  const mockMutateAsync = vi.fn();
  const mockMutation = {
    mutateAsync: mockMutateAsync,
    isPending: false,
    isError: false,
    error: null,
    data: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMultiProvider).mockReturnValue(mockMultiProvider as any);
    vi.mocked(useWarpCore).mockReturnValue(mockWarpCore as any);
    vi.mocked(useMutation).mockReturnValue(mockMutation as any);
  });

  it('should return hook with fetchMaxAmount and isLoading properties', () => {
    const { result } = renderHook(() => useFetchMaxAmount());

    expect(result.current).toHaveProperty('fetchMaxAmount');
    expect(result.current).toHaveProperty('isLoading');
    expect(typeof result.current.fetchMaxAmount).toBe('function');
    expect(typeof result.current.isLoading).toBe('boolean');
  });

  it('should initialize with isLoading as false', () => {
    const { result } = renderHook(() => useFetchMaxAmount());

    expect(result.current.isLoading).toBe(false);
  });

  it('should call useMultiProvider hook', () => {
    renderHook(() => useFetchMaxAmount());

    expect(useMultiProvider).toHaveBeenCalled();
  });

  it('should call useWarpCore hook', () => {
    renderHook(() => useFetchMaxAmount());

    expect(useWarpCore).toHaveBeenCalled();
  });

  it('should call useMutation with correct configuration', () => {
    renderHook(() => useFetchMaxAmount());

    expect(useMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
      }),
    );
  });

  it('should return mutateAsync as fetchMaxAmount', () => {
    const { result } = renderHook(() => useFetchMaxAmount());

    expect(result.current.fetchMaxAmount).toBe(mockMutateAsync);
  });

  it('should return isPending as isLoading', () => {
    const updatedMutation = {
      ...mockMutation,
      isPending: true,
    };
    vi.mocked(useMutation).mockReturnValue(updatedMutation as any);

    const { result } = renderHook(() => useFetchMaxAmount());

    expect(result.current.isLoading).toBe(true);
  });

  it('should handle mutation with valid parameters', async () => {
    const mockParams = {
      accounts: {
        evm: { address: '0x123' },
      },
      balance: { amount: '1000', decimals: 18 },
      origin: 'ethereum',
      destination: 'polygon',
    };

    mockMutateAsync.mockResolvedValue({ maxAmount: '500' });

    const { result } = renderHook(() => useFetchMaxAmount());

    await act(async () => {
      const response = await result.current.fetchMaxAmount(mockParams as any);
      expect(response).toEqual({ maxAmount: '500' });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(mockParams);
  });

  it('should handle mutation errors gracefully', async () => {
    const mockError = new Error('Failed to fetch max amount');
    mockMutateAsync.mockRejectedValue(mockError);

    const { result } = renderHook(() => useFetchMaxAmount());

    await act(async () => {
      try {
        await result.current.fetchMaxAmount({} as any);
      } catch (error) {
        expect(error).toBe(mockError);
      }
    });
  });

  it('should update isLoading state during mutation', async () => {
    const { result, rerender } = renderHook(() => useFetchMaxAmount());

    // Initial state
    expect(result.current.isLoading).toBe(false);

    // Simulate loading state
    vi.mocked(useMutation).mockReturnValue({
      ...mockMutation,
      isPending: true,
    } as any);

    rerender();

    expect(result.current.isLoading).toBe(true);

    // Simulate completed state
    vi.mocked(useMutation).mockReturnValue({
      ...mockMutation,
      isPending: false,
    } as any);

    rerender();

    expect(result.current.isLoading).toBe(false);
  });

  it('should handle multiple sequential calls', async () => {
    mockMutateAsync
      .mockResolvedValueOnce({ maxAmount: '500' })
      .mockResolvedValueOnce({ maxAmount: '750' });

    const { result } = renderHook(() => useFetchMaxAmount());

    const params1 = {
      accounts: {},
      balance: { amount: '1000', decimals: 18 },
      origin: 'ethereum',
      destination: 'polygon',
    };

    const params2 = {
      accounts: {},
      balance: { amount: '2000', decimals: 18 },
      origin: 'ethereum',
      destination: 'arbitrum',
    };

    await act(async () => {
      const response1 = await result.current.fetchMaxAmount(params1 as any);
      expect(response1).toEqual({ maxAmount: '500' });

      const response2 = await result.current.fetchMaxAmount(params2 as any);
      expect(response2).toEqual({ maxAmount: '750' });
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
  });

  it('should maintain hook state across re-renders', () => {
    const { result, rerender } = renderHook(() => useFetchMaxAmount());

    const firstResult = result.current;

    rerender();

    // The hook should return the same mutation object reference
    expect(result.current.fetchMaxAmount).toBe(firstResult.fetchMaxAmount);
  });
});

describe('fetchMaxAmount mutationFn', () => {
  const mockMultiProvider = {
    tryGetChainMetadata: vi.fn(),
  };

  const mockWarpCore = {
    getMaxTransferAmount: vi.fn(),
  };

  const baseParams = {
    accounts: {} as Record<string, unknown>,
    balance: { id: 'balance' },
    origin: 'ethereum',
    destination: 'arbitrum',
  } as any;

  let capturedMutationFn: ((params: unknown) => Promise<unknown>) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedMutationFn = undefined;
    vi.mocked(useMultiProvider).mockReturnValue(mockMultiProvider as any);
    vi.mocked(useWarpCore).mockReturnValue(mockWarpCore as any);
    vi.mocked(useMutation).mockImplementation((options: any) => {
      capturedMutationFn = options.mutationFn;
      return {
        mutateAsync: options.mutationFn,
        isPending: false,
      } as any;
    });
  });

  it('returns the existing balance when account address is unavailable', async () => {
    vi.mocked(getAccountAddressAndPubKey).mockReturnValue({ address: undefined } as any);

    renderHook(() => useFetchMaxAmount());

    const result = await capturedMutationFn!(baseParams);

    expect(result).toBe(baseParams.balance);
    expect(mockWarpCore.getMaxTransferAmount).not.toHaveBeenCalled();
  });

  it('returns warpCore max amount when available', async () => {
    const mockMaxAmount = { id: 'maxAmount', token: { symbol: 'TOKEN' }, amount: BigInt(100) };
    vi.mocked(getAccountAddressAndPubKey).mockReturnValue({
      address: '0x1234',
      publicKey: Promise.resolve('pubkey'),
    } as any);
    mockWarpCore.getMaxTransferAmount.mockResolvedValue(mockMaxAmount as any);
    vi.mocked(isMultiCollateralLimitExceeded).mockReturnValue(null);

    renderHook(() => useFetchMaxAmount());

    const result = await capturedMutationFn!({
      ...baseParams,
      balance: { id: 'balance' },
    });

    expect(mockWarpCore.getMaxTransferAmount).toHaveBeenCalledWith({
      balance: baseParams.balance,
      destination: baseParams.destination,
      sender: '0x1234',
      senderPubKey: 'pubkey',
    });
    expect(result).toEqual(mockMaxAmount);
  });

  it('returns TokenAmount capped by multi collateral limit', async () => {
    const mockedTokenAmountInstance = { id: 'token-amount' };
    const mockToken = { symbol: 'MOCK', decimals: 6 };
    const mockLimit = BigInt(1_000_000);

    vi.mocked(getAccountAddressAndPubKey).mockReturnValue({
      address: '0x5678',
      publicKey: Promise.resolve('pub'),
    } as any);
    mockWarpCore.getMaxTransferAmount.mockResolvedValue({
      token: mockToken,
      amount: BigInt(2_000_000),
    } as any);
    vi.mocked(isMultiCollateralLimitExceeded).mockReturnValue(mockLimit);
    vi.mocked(TokenAmount).mockReturnValue(mockedTokenAmountInstance as any);

    renderHook(() => useFetchMaxAmount());

    const result = await capturedMutationFn!(baseParams);

    expect(TokenAmount).toHaveBeenCalledWith(mockLimit, mockToken);
    expect(result).toBe(mockedTokenAmountInstance);
  });

  it('logs and shows toast on errors, returning undefined', async () => {
    vi.mocked(getAccountAddressAndPubKey).mockImplementation(() => {
      throw new Error('account failure');
    });
    mockMultiProvider.tryGetChainMetadata.mockReturnValue({ displayName: 'Ethereum' } as any);

    renderHook(() => useFetchMaxAmount());

    const result = await capturedMutationFn!(baseParams);

    expect(logger.warn).toHaveBeenCalled();
    expect(toast.warn).toHaveBeenCalledWith(
      'Cannot simulate transfer, Ethereum native balance may be insufficient.',
    );
    expect(result).toBeUndefined();
  });
});
