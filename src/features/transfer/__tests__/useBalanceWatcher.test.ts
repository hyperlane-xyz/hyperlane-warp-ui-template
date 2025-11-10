import { TokenAmount } from '@hyperlane-xyz/sdk';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecipientBalanceWatcher } from '../useBalanceWatcher';

const { mockToastSuccess } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
}));

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: {
    success: mockToastSuccess,
  },
}));

describe('useRecipientBalanceWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToastSuccess.mockClear();
  });

  it('should not show toast when recipient is undefined', () => {
    const mockToken = {
      equals: vi.fn().mockReturnValue(true),
    } as any;

    const balance1 = { amount: 100n, token: mockToken } as TokenAmount;
    const balance2 = { amount: 200n, token: mockToken } as TokenAmount;

    const { rerender } = renderHook(
      ({ recipient, balance }) => useRecipientBalanceWatcher(recipient, balance),
      {
        initialProps: { recipient: undefined, balance: balance1 },
      },
    );

    rerender({ recipient: undefined, balance: balance2 });

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('should not show toast when balance is undefined', () => {
    const { rerender } = renderHook(
      ({ recipient, balance }) => useRecipientBalanceWatcher(recipient, balance),
      {
        initialProps: { recipient: '0x123', balance: undefined },
      },
    );

    rerender({ recipient: '0x123', balance: undefined });

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('should not show toast when previous balance is undefined', () => {
    const mockToken = {
      equals: vi.fn().mockReturnValue(true),
    } as any;

    const balance = { amount: 200n, token: mockToken } as TokenAmount;

    const { rerender } = renderHook(
      ({ recipient, balance }: { recipient: string; balance: TokenAmount | undefined }) =>
        useRecipientBalanceWatcher(recipient, balance),
      {
        initialProps: { recipient: '0x123', balance: undefined } as {
          recipient: string;
          balance: TokenAmount | undefined;
        },
      },
    );

    rerender({ recipient: '0x123', balance } as {
      recipient: string;
      balance: TokenAmount | undefined;
    });

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('should not show toast when recipient changes', () => {
    const mockToken = {
      equals: vi.fn().mockReturnValue(true),
    } as any;

    const balance1 = { amount: 100n, token: mockToken } as TokenAmount;
    const balance2 = { amount: 200n, token: mockToken } as TokenAmount;

    const { rerender } = renderHook(
      ({ recipient, balance }) => useRecipientBalanceWatcher(recipient, balance),
      {
        initialProps: { recipient: '0x123', balance: balance1 },
      },
    );

    rerender({ recipient: '0x456', balance: balance2 });

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('should not show toast when tokens are different', () => {
    const mockToken1 = {
      equals: vi.fn().mockReturnValue(false),
    } as any;

    const mockToken2 = {
      equals: vi.fn().mockReturnValue(false),
    } as any;

    const balance1 = { amount: 100n, token: mockToken1 } as TokenAmount;
    const balance2 = { amount: 200n, token: mockToken2 } as TokenAmount;

    const { rerender } = renderHook(
      ({ recipient, balance }) => useRecipientBalanceWatcher(recipient, balance),
      {
        initialProps: { recipient: '0x123', balance: balance1 },
      },
    );

    rerender({ recipient: '0x123', balance: balance2 });

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('should not show toast when balance decreases', () => {
    const mockToken = {
      equals: vi.fn().mockReturnValue(true),
    } as any;

    const balance1 = { amount: 200n, token: mockToken } as TokenAmount;
    const balance2 = { amount: 100n, token: mockToken } as TokenAmount;

    const { rerender } = renderHook(
      ({ recipient, balance }) => useRecipientBalanceWatcher(recipient, balance),
      {
        initialProps: { recipient: '0x123', balance: balance1 },
      },
    );

    rerender({ recipient: '0x123', balance: balance2 });

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('should not show toast when balance stays the same', () => {
    const mockToken = {
      equals: vi.fn().mockReturnValue(true),
    } as any;

    const balance1 = { amount: 100n, token: mockToken } as TokenAmount;
    const balance2 = { amount: 100n, token: mockToken } as TokenAmount;

    const { rerender } = renderHook(
      ({ recipient, balance }) => useRecipientBalanceWatcher(recipient, balance),
      {
        initialProps: { recipient: '0x123', balance: balance1 },
      },
    );

    rerender({ recipient: '0x123', balance: balance2 });

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('should show toast when balance increases for same recipient and token', () => {
    const mockToken = {
      equals: vi.fn().mockReturnValue(true),
    } as any;

    const balance1 = { amount: 100n, token: mockToken } as TokenAmount;
    const balance2 = { amount: 200n, token: mockToken } as TokenAmount;

    const { rerender } = renderHook(
      ({ recipient, balance }) => useRecipientBalanceWatcher(recipient, balance),
      {
        initialProps: { recipient: '0x123', balance: balance1 },
      },
    );

    rerender({ recipient: '0x123', balance: balance2 });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Recipient has received funds, transfer complete!',
    );
  });

  it('should update previous balance reference after showing toast', () => {
    const mockToken = {
      equals: vi.fn().mockReturnValue(true),
    } as any;

    const balance1 = { amount: 100n, token: mockToken } as TokenAmount;
    const balance2 = { amount: 200n, token: mockToken } as TokenAmount;
    const balance3 = { amount: 300n, token: mockToken } as TokenAmount;

    const { rerender } = renderHook(
      ({ recipient, balance }) => useRecipientBalanceWatcher(recipient, balance),
      {
        initialProps: { recipient: '0x123', balance: balance1 },
      },
    );

    // First increase - should show toast
    rerender({ recipient: '0x123', balance: balance2 });
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);

    // Second increase - should show toast again
    rerender({ recipient: '0x123', balance: balance3 });
    expect(mockToastSuccess).toHaveBeenCalledTimes(2);
  });

  it('should handle multiple balance changes correctly', () => {
    const mockToken = {
      equals: vi.fn().mockReturnValue(true),
    } as any;

    const balances = [
      { amount: 100n, token: mockToken } as TokenAmount,
      { amount: 150n, token: mockToken } as TokenAmount,
      { amount: 200n, token: mockToken } as TokenAmount,
      { amount: 180n, token: mockToken } as TokenAmount,
      { amount: 250n, token: mockToken } as TokenAmount,
    ];

    const { rerender } = renderHook(
      ({ recipient, balance }) => useRecipientBalanceWatcher(recipient, balance),
      {
        initialProps: { recipient: '0x123', balance: balances[0] },
      },
    );

    // First increase: 100 -> 150
    rerender({ recipient: '0x123', balance: balances[1] });
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);

    // Second increase: 150 -> 200
    rerender({ recipient: '0x123', balance: balances[2] });
    expect(mockToastSuccess).toHaveBeenCalledTimes(2);

    // Decrease: 200 -> 180 (no toast)
    rerender({ recipient: '0x123', balance: balances[3] });
    expect(mockToastSuccess).toHaveBeenCalledTimes(2);

    // Third increase: 180 -> 250
    rerender({ recipient: '0x123', balance: balances[4] });
    expect(mockToastSuccess).toHaveBeenCalledTimes(3);
  });
});
