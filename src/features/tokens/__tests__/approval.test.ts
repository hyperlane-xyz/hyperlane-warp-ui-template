import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useIsApproveRequired } from '../approval';

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
