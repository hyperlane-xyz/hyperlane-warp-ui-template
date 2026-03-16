import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useIsApproveRequired, useIsUSDCBridgeFeeApproveRequired } from '../approval';

const { isApproveRequiredAdapterMock } = vi.hoisted(() => {
  const isApproveRequiredAdapterMock = vi.fn(() => Promise.resolve(true));
  return { isApproveRequiredAdapterMock };
});

vi.mock('../hooks', () => {
  const actual = vi.importActual<any>('../hooks');
  return {
    ...actual,
    useWarpCore: vi
      .fn()
      .mockReturnValue({ tokens: [], isApproveRequired: vi.fn().mockReturnValue(true) }),
  };
});

vi.mock('@hyperlane-xyz/widgets', () => {
  return {
    useAccountAddressForChain: vi.fn().mockReturnValue('0xowneraddress'),
    useTokenMetadata: vi.fn().mockReturnValue({ name: 'Test Token', symbol: 'TT' }),
  };
});

vi.mock('../../chains/hooks', () => ({
  useMultiProvider: vi.fn().mockReturnValue({}),
}));

vi.mock('@hyperlane-xyz/sdk', async () => {
  const actual = await vi.importActual<typeof import('@hyperlane-xyz/sdk')>('@hyperlane-xyz/sdk');
  return {
    ...actual,
    EvmTokenAdapter: vi.fn(() => ({
      isApproveRequired: isApproveRequiredAdapterMock,
    })),
  };
});

vi.mock('../../../consts/config', () => ({
  config: {
    enablePruvOriginFeeUSDC: true,
    pruvOriginFeeUSDC: { sepolia: 0.75, 'dest-chain': 1.25 },
    pruvUSDCMetadata: { address: '0xUSDC', decimals: 6 },
  },
}));

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

describe('useIsApproveRequired', () => {
  // Add your tests here
  it('approve required data should return false when no token provided', async () => {
    const { result } = renderHook(() => useIsApproveRequired(undefined, '100'), {
      wrapper: createWrapper(),
    });
    // Initial state
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.isApproveRequired).toBe(false);

    // Wait for query to resolve
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isApproveRequired).toBe(false);
  });
  it('approve required data should return true', async () => {
    const { result } = renderHook(
      () =>
        useIsApproveRequired(
          {
            addressOrDenom: '0xtoken',
            amount: vi.fn(),
          } as any,
          '100',
        ),
      {
        wrapper: createWrapper(),
      },
    );
    // Initial state
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.isApproveRequired).toBe(false);

    // Wait for query to resolve
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isApproveRequired).toBe(true);
  });
});

describe('useIsUSDCBridgeFeeApproveRequired', () => {
  it('returns false when no spender address provided', async () => {
    const { result } = renderHook(
      () => useIsUSDCBridgeFeeApproveRequired('pruv-origin', 'sepolia', undefined, true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isUSDCApproveRequired).toBe(false);
  });

  it('returns true when USDC allowance is insufficient for bridge fee', async () => {
    isApproveRequiredAdapterMock.mockResolvedValue(true);

    const { result } = renderHook(
      () => useIsUSDCBridgeFeeApproveRequired('pruv-origin', 'sepolia', '0xspender', true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isUSDCApproveRequired).toBe(true);
    expect(isApproveRequiredAdapterMock).toHaveBeenCalledWith(
      '0xowneraddress',
      '0xspender',
      '750000', // 0.75 * 10^6
    );
  });

  it('returns false when USDC allowance is sufficient for bridge fee', async () => {
    isApproveRequiredAdapterMock.mockResolvedValue(false);

    const { result } = renderHook(
      () => useIsUSDCBridgeFeeApproveRequired('pruv-origin', 'sepolia', '0xspender', true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isUSDCApproveRequired).toBe(false);
  });

  it('returns false when disabled', async () => {
    const { result } = renderHook(
      () => useIsUSDCBridgeFeeApproveRequired('pruv-origin', 'sepolia', '0xspender', false),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isUSDCApproveRequired).toBe(false);
    expect(isApproveRequiredAdapterMock).not.toHaveBeenCalled();
  });

  it('returns false when destination has no bridge fee configured', async () => {
    const { result } = renderHook(
      () => useIsUSDCBridgeFeeApproveRequired('pruv-origin', 'unknown-chain', '0xspender', true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isUSDCApproveRequired).toBe(false);
  });
});
