import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransferStatus } from '../types';
import { useTokenTransfer } from '../useTokenTransfer';

const {
  addTransferMock,
  updateTransferStatusMock,
  toastTxSuccessMock,
  toastErrorMock,
  getChainDisplayNameMock,
  getAccountAddressForChainMock,
  tryGetMsgIdMock,
  sendTransactionMock,
  sendMultiTransactionMock,
  populateApproveTxMock,
  isApproveRequiredAdapterMock,
  EvmTokenAdapterMock,
  multiProviderMock,
  warpCoreMock,
  getTokenByIndexMock,
  transactionFns,
  accountsResponse,
  activeChainsResponse,
  config,
  providerTypes,
  warpTxCategories,
} = vi.hoisted(() => {
  const addTransferMock = vi.fn();
  const updateTransferStatusMock = vi.fn();
  const toastTxSuccessMock = vi.fn();
  const toastErrorMock = vi.fn();
  const getChainDisplayNameMock = vi.fn(() => 'OriginChain');
  const getAccountAddressForChainMock = vi.fn(() => '0xsender');
  const tryGetMsgIdMock = vi.fn(() => 'msg-1');
  const sendTransactionMock = vi.fn();
  const sendMultiTransactionMock = vi.fn();
  const populateApproveTxMock = vi.fn(() => Promise.resolve({ to: 'router' }));
  const isApproveRequiredAdapterMock = vi.fn(() => Promise.resolve(true));
  const EvmTokenAdapterMock = vi.fn(() => ({
    populateApproveTx: populateApproveTxMock,
    isApproveRequired: isApproveRequiredAdapterMock,
  }));
  const providerTypes = {
    Ethereum: 'ethereum',
    Starknet: 'starknet',
  } as const;
  const warpTxCategories = {
    Approval: 'approval',
    Transfer: 'transfer',
    Revoke: 'revoke',
  } as const;

  const multiProviderMock = {
    getProvider: vi.fn(() => ({ type: providerTypes.Ethereum })),
    getKnownChainNames: vi.fn(() => ['origin']),
    tryGetExplorerAddressUrl: vi.fn(),
    tryGetExplorerTxUrl: vi.fn(),
    getProviderNetwork: vi.fn(),
  } as any;

  const warpCoreMock = {
    multiProvider: multiProviderMock,
    isDestinationCollateralSufficient: vi.fn(async () => true),
    getTransferRemoteTxs: vi.fn(),
  } as any;

  const getTokenByIndexMock = vi.fn();

  const transactionFns = {
    evm: {
      sendTransaction: sendTransactionMock,
      sendMultiTransaction: sendMultiTransactionMock,
    },
  } as any;

  const accountsResponse = {
    accounts: { evm: { address: '0xsender' } },
  } as any;

  const activeChainsResponse = {
    chains: { evm: { chainName: 'ethereum' } },
  } as any;

  const config = {
    enablePruvOriginFeeUSDC: true,
    pruvOriginFeeUSDC: { 'dest-chain': 1.25 },
    pruvUSDCMetadata: { address: 'usdc-token', decimals: 6 },
    gaslessChains: [],
  } as any;

  return {
    addTransferMock,
    updateTransferStatusMock,
    toastTxSuccessMock,
    toastErrorMock,
    getChainDisplayNameMock,
    getAccountAddressForChainMock,
    tryGetMsgIdMock,
    sendTransactionMock,
    sendMultiTransactionMock,
    populateApproveTxMock,
    isApproveRequiredAdapterMock,
    EvmTokenAdapterMock,
    multiProviderMock,
    warpCoreMock,
    getTokenByIndexMock,
    transactionFns,
    accountsResponse,
    activeChainsResponse,
    config,
    providerTypes,
    warpTxCategories,
  };
});

vi.mock('../../../consts/config', () => ({ config }));

vi.mock('../../store', () => ({
  useStore: (selector: (state: any) => unknown) =>
    selector({
      transfers: [],
      addTransfer: addTransferMock,
      updateTransferStatus: updateTransferStatusMock,
    }),
}));

vi.mock('../../chains/hooks', () => ({
  useMultiProvider: () => multiProviderMock,
}));

vi.mock('../../chains/utils', () => ({
  getChainDisplayName: getChainDisplayNameMock,
}));

vi.mock('../../tokens/hooks', () => ({
  useWarpCore: () => warpCoreMock,
  getTokenByIndex: getTokenByIndexMock,
}));

vi.mock('../utils', () => ({
  tryGetMsgIdFromTransferReceipt: tryGetMsgIdMock,
}));

vi.mock('../../../components/toast/TxSuccessToast', () => ({
  toastTxSuccess: toastTxSuccessMock,
}));

vi.mock('react-toastify', () => ({
  toast: { error: toastErrorMock, warn: vi.fn() },
}));

vi.mock('@hyperlane-xyz/sdk', async () => {
  const actual = await vi.importActual<typeof import('@hyperlane-xyz/sdk')>('@hyperlane-xyz/sdk');
  return {
    ...actual,
    ProviderType: providerTypes,
    WarpTxCategory: warpTxCategories,
    EvmTokenAdapter: EvmTokenAdapterMock,
  };
});

vi.mock('@hyperlane-xyz/utils', async () => {
  const actual =
    await vi.importActual<typeof import('@hyperlane-xyz/utils')>('@hyperlane-xyz/utils');
  return {
    ...actual,
    toTitleCase: (value: string) => value,
    toWei: (value: string) => value,
  };
});

vi.mock('@hyperlane-xyz/widgets', () => ({
  useAccounts: () => accountsResponse,
  useActiveChains: () => activeChainsResponse,
  useTransactionFns: () => transactionFns,
  getAccountAddressForChain: getAccountAddressForChainMock,
}));

vi.mock('wagmi', () => ({
  useConfig: () => ({}),
}));

vi.mock('@wagmi/core', () => ({
  getPublicClient: () => undefined,
}));

describe('useTokenTransfer', () => {
  const originToken = {
    protocol: 'evm',
    symbol: 'TEST',
    decimals: 18,
    chainName: 'pruv-origin',
    addressOrDenom: '0xtoken',
    collateralAddressOrDenom: '0xorigin-collateral',
    isNft: () => false,
    amount: vi.fn(() => ({ amount: 'raw-amount' })),
    getConnectionForChain: vi.fn(() => ({
      token: {
        addressOrDenom: '0xdest-token',
        collateralAddressOrDenom: '0xdest-collateral',
        protocol: 'evm',
        decimals: 18,
        scale: 18,
      },
    })),
  } as any;

  const values = {
    origin: 'pruv-origin',
    destination: 'dest-chain',
    tokenIndex: 0,
    amount: '1.5',
    recipient: '0xrecipient',
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    getTokenByIndexMock.mockReturnValue(originToken);
    warpCoreMock.isDestinationCollateralSufficient.mockResolvedValue(true);
    warpCoreMock.getTransferRemoteTxs.mockResolvedValue([
      {
        category: warpTxCategories.Transfer,
        type: providerTypes.Ethereum,
        transaction: { to: 'router' },
      },
    ]);
    config.enablePruvOriginFeeUSDC = true;
    config.pruvOriginFeeUSDC['dest-chain'] = 1.25;
    isApproveRequiredAdapterMock.mockResolvedValue(true);
  });

  it('executes transfer flow and records transactions', async () => {
    const confirmFirst = vi
      .fn()
      .mockResolvedValue({ type: 'ethers', receipt: { hash: '0xhash1' } });
    const confirmSecond = vi
      .fn()
      .mockResolvedValue({ type: 'ethers', receipt: { hash: '0xhash2' } });
    sendTransactionMock
      .mockResolvedValueOnce({ hash: '0xhash-approval', confirm: confirmFirst })
      .mockResolvedValueOnce({ hash: '0xhash-transfer', confirm: confirmSecond });

    const onDone = vi.fn();
    const { result } = renderHook(() => useTokenTransfer(onDone));

    await act(async () => {
      await result.current.triggerTransactions(values);
    });

    expect(result.current.isLoading).toBe(false);
    expect(addTransferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: values.origin,
        destination: values.destination,
        recipient: values.recipient,
        amount: values.amount,
      }),
    );
    expect(updateTransferStatusMock).toHaveBeenCalledWith(0, TransferStatus.Preparing);
    expect(updateTransferStatusMock).toHaveBeenCalledWith(0, TransferStatus.ConfirmedTransfer, {
      originTxHash: '0xhash-transfer',
      msgId: 'msg-1',
    });
    expect(populateApproveTxMock).toHaveBeenCalled();
    expect(sendTransactionMock).toHaveBeenCalledTimes(2);
    expect(confirmFirst).toHaveBeenCalled();
    expect(confirmSecond).toHaveBeenCalled();
    expect(tryGetMsgIdMock).toHaveBeenCalled();
    expect(toastTxSuccessMock).toHaveBeenCalledWith(
      'approval transaction sent!',
      '0xhash-approval',
      values.origin,
    );
    expect(toastTxSuccessMock).toHaveBeenCalledWith(
      'transfer transaction sent!',
      '0xhash-transfer',
      values.origin,
    );
    expect(onDone).toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('uses multi-transaction sender for starknet batches', async () => {
    config.enablePruvOriginFeeUSDC = false;
    warpCoreMock.getTransferRemoteTxs.mockResolvedValue([
      {
        category: warpTxCategories.Transfer,
        type: providerTypes.Starknet,
        transaction: { id: 1 },
      },
      {
        category: warpTxCategories.Transfer,
        type: providerTypes.Starknet,
        transaction: { id: 2 },
      },
    ]);
    const confirm = vi.fn().mockResolvedValue({ type: 'starknet', receipt: { hash: '0xmulti' } });
    sendMultiTransactionMock.mockResolvedValue({ hash: '0xmulti', confirm });

    const { result } = renderHook(() => useTokenTransfer());

    await act(async () => {
      await result.current.triggerTransactions(values);
    });

    expect(sendMultiTransactionMock).toHaveBeenCalledWith({
      txs: expect.any(Array),
      chainName: values.origin,
      activeChainName: 'ethereum',
    });
    expect(sendTransactionMock).not.toHaveBeenCalled();
    expect(toastTxSuccessMock).toHaveBeenCalledWith(
      'transfer transaction sent!',
      '0xmulti',
      values.origin,
    );
  });

  it('surfaces chain mismatch errors gracefully', async () => {
    const error = new Error('ChainMismatchError: wrong chain');
    sendTransactionMock.mockRejectedValue(error);

    const { result } = renderHook(() => useTokenTransfer());

    await act(async () => {
      await result.current.triggerTransactions(values);
    });

    expect(updateTransferStatusMock).toHaveBeenCalledWith(0, TransferStatus.Failed);
    expect(toastErrorMock).toHaveBeenCalledWith('Wallet must be connected to origin chain', {
      autoClose: 8000,
      ariaLabel: 'Transfer Failed',
      theme: 'colored',
    });
  });

  it('surfaces internal rpc errors during approval as network mismatch', async () => {
    const internalError = {
      message: 'TransactionExecutionError: An internal error was received.',
      cause: { message: 'InternalRpcError: An internal error was received.' },
    };
    sendTransactionMock.mockRejectedValue(internalError);

    const { result } = renderHook(() => useTokenTransfer());

    await act(async () => {
      await result.current.triggerTransactions(values);
    });

    expect(updateTransferStatusMock).toHaveBeenCalledWith(0, TransferStatus.Failed);
    expect(toastErrorMock).toHaveBeenCalledWith(
      'Network mismatch detected, switch wallet to the origin chain and try again.',
      {
        autoClose: 8000,
        ariaLabel: 'Transfer Failed',
        theme: 'colored',
      },
    );
  });

  it('displays timeout message when confirmations timeout', async () => {
    const confirm = vi.fn().mockRejectedValue(new Error('timeout'));
    sendTransactionMock.mockResolvedValueOnce({ hash: '0xhash', confirm });

    const { result } = renderHook(() => useTokenTransfer());

    await act(async () => {
      await result.current.triggerTransactions(values);
    });

    expect(toastErrorMock).toHaveBeenCalledWith(
      'Transaction timed out, OriginChain may be busy. Please try again.',
    );
    expect(updateTransferStatusMock).toHaveBeenCalledWith(0, TransferStatus.Failed);
  });

  it('reports preparation errors when collateral is insufficient', async () => {
    warpCoreMock.isDestinationCollateralSufficient.mockResolvedValue(false);

    const { result } = renderHook(() => useTokenTransfer());

    await act(async () => {
      await result.current.triggerTransactions(values);
    });

    expect(toastErrorMock).toHaveBeenCalledWith(
      'Insufficient collateral on destination for transfer',
    );
    expect(updateTransferStatusMock).toHaveBeenCalledWith(0, TransferStatus.Failed);
  });

  describe('USDC allowance checks for pruv transfers', () => {
    const usdcToken = {
      ...originToken,
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0xusdc-router',
      collateralAddressOrDenom: '0xusdc-collateral',
    } as any;

    it('skips USDC bridge fee approval when allowance is sufficient (non-USDC token)', async () => {
      isApproveRequiredAdapterMock.mockResolvedValue(false);
      const confirmTransfer = vi
        .fn()
        .mockResolvedValue({ type: 'ethers', receipt: { hash: '0xhash-transfer' } });
      sendTransactionMock.mockResolvedValueOnce({
        hash: '0xhash-transfer',
        confirm: confirmTransfer,
      });

      const { result } = renderHook(() => useTokenTransfer());

      await act(async () => {
        await result.current.triggerTransactions(values);
      });

      // Should check allowance with correct args
      expect(isApproveRequiredAdapterMock).toHaveBeenCalledWith(
        '0xsender',
        originToken.addressOrDenom,
        '1250000',
      );
      // Should NOT create approval tx since allowance is sufficient
      expect(populateApproveTxMock).not.toHaveBeenCalled();
      // Only transfer tx sent, no approval
      expect(sendTransactionMock).toHaveBeenCalledTimes(1);
      expect(updateTransferStatusMock).toHaveBeenCalledWith(
        0,
        TransferStatus.ConfirmedTransfer,
        expect.objectContaining({ originTxHash: '0xhash-transfer' }),
      );
    });

    it('adds USDC bridge fee approval when allowance is insufficient (non-USDC token)', async () => {
      isApproveRequiredAdapterMock.mockResolvedValue(true);
      const confirmApproval = vi
        .fn()
        .mockResolvedValue({ type: 'ethers', receipt: { hash: '0xhash-approval' } });
      const confirmTransfer = vi
        .fn()
        .mockResolvedValue({ type: 'ethers', receipt: { hash: '0xhash-transfer' } });
      sendTransactionMock
        .mockResolvedValueOnce({ hash: '0xhash-approval', confirm: confirmApproval })
        .mockResolvedValueOnce({ hash: '0xhash-transfer', confirm: confirmTransfer });

      const { result } = renderHook(() => useTokenTransfer());

      await act(async () => {
        await result.current.triggerTransactions(values);
      });

      expect(isApproveRequiredAdapterMock).toHaveBeenCalled();
      expect(populateApproveTxMock).toHaveBeenCalledWith({
        weiAmountOrId: '1250000',
        recipient: originToken.addressOrDenom,
      });
      expect(sendTransactionMock).toHaveBeenCalledTimes(2);
    });

    it('skips approval when allowance is sufficient (USDC token from pruv)', async () => {
      getTokenByIndexMock.mockReturnValue(usdcToken);
      isApproveRequiredAdapterMock.mockResolvedValue(false);
      const confirmTransfer = vi
        .fn()
        .mockResolvedValue({ type: 'ethers', receipt: { hash: '0xhash-transfer' } });
      sendTransactionMock.mockResolvedValueOnce({
        hash: '0xhash-transfer',
        confirm: confirmTransfer,
      });

      const { result } = renderHook(() => useTokenTransfer());

      await act(async () => {
        await result.current.triggerTransactions(values);
      });

      // Should check allowance for amount + bridgeFee
      expect(isApproveRequiredAdapterMock).toHaveBeenCalledWith(
        '0xsender',
        usdcToken.addressOrDenom,
        '2.75', // toWei mock returns string as-is: parseFloat('1.5') + 1.25 = 2.75
      );
      expect(populateApproveTxMock).not.toHaveBeenCalled();
      expect(sendTransactionMock).toHaveBeenCalledTimes(1);
    });

    it('creates approval with amount+bridgeFee when allowance insufficient (USDC token from pruv)', async () => {
      getTokenByIndexMock.mockReturnValue(usdcToken);
      isApproveRequiredAdapterMock.mockResolvedValue(true);
      const confirmApproval = vi
        .fn()
        .mockResolvedValue({ type: 'ethers', receipt: { hash: '0xhash-approval' } });
      const confirmTransfer = vi
        .fn()
        .mockResolvedValue({ type: 'ethers', receipt: { hash: '0xhash-transfer' } });
      sendTransactionMock
        .mockResolvedValueOnce({ hash: '0xhash-approval', confirm: confirmApproval })
        .mockResolvedValueOnce({ hash: '0xhash-transfer', confirm: confirmTransfer });

      const { result } = renderHook(() => useTokenTransfer());

      await act(async () => {
        await result.current.triggerTransactions(values);
      });

      expect(isApproveRequiredAdapterMock).toHaveBeenCalled();
      // Approval tx should use total amount (amount + bridgeFee)
      expect(populateApproveTxMock).toHaveBeenCalledWith({
        weiAmountOrId: '2.75',
        recipient: usdcToken.addressOrDenom,
      });
      expect(sendTransactionMock).toHaveBeenCalledTimes(2);
    });

    it('removes SDK-added approval tx when allowance is sufficient (USDC token from pruv)', async () => {
      getTokenByIndexMock.mockReturnValue(usdcToken);
      isApproveRequiredAdapterMock.mockResolvedValue(false);
      // SDK returns both approval and transfer txs
      warpCoreMock.getTransferRemoteTxs.mockResolvedValue([
        {
          category: warpTxCategories.Approval,
          type: providerTypes.Ethereum,
          transaction: { to: 'router-approval' },
        },
        {
          category: warpTxCategories.Transfer,
          type: providerTypes.Ethereum,
          transaction: { to: 'router-transfer' },
        },
      ]);
      const confirmTransfer = vi
        .fn()
        .mockResolvedValue({ type: 'ethers', receipt: { hash: '0xhash-transfer' } });
      sendTransactionMock.mockResolvedValueOnce({
        hash: '0xhash-transfer',
        confirm: confirmTransfer,
      });

      const { result } = renderHook(() => useTokenTransfer());

      await act(async () => {
        await result.current.triggerTransactions(values);
      });

      // SDK approval should be removed since allowance is sufficient
      expect(populateApproveTxMock).not.toHaveBeenCalled();
      expect(sendTransactionMock).toHaveBeenCalledTimes(1);
      // Verify only the transfer tx was sent
      expect(sendTransactionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tx: expect.objectContaining({ category: warpTxCategories.Transfer }),
        }),
      );
    });

    it('completes transfer across multiple retries with progressive approvals (non-USDC from pruv)', async () => {
      // Simulates a user who:
      // 1. Approves USDC bridge fee, then stops (failure before token approval)
      // 2. Retries: USDC skipped (already approved), approves token, then stops
      // 3. Retries: both approvals skipped, only transfer needed - succeeds

      const { result } = renderHook(() => useTokenTransfer());

      // --- Attempt 1: USDC bridge fee approval succeeds, user stops before token approval ---
      isApproveRequiredAdapterMock.mockResolvedValue(true); // USDC needs approval
      warpCoreMock.getTransferRemoteTxs.mockResolvedValue([
        {
          category: warpTxCategories.Approval,
          type: providerTypes.Ethereum,
          transaction: { to: 'token-router' },
        },
        {
          category: warpTxCategories.Transfer,
          type: providerTypes.Ethereum,
          transaction: { to: 'router' },
        },
      ]);

      const confirmUSDC = vi
        .fn()
        .mockResolvedValue({ type: 'ethers', receipt: { hash: '0xusdc-approve' } });
      sendTransactionMock
        .mockResolvedValueOnce({ hash: '0xusdc-approve', confirm: confirmUSDC })
        .mockRejectedValueOnce(new Error('User stopped'));

      await act(async () => {
        await result.current.triggerTransactions(values);
      });

      // USDC approval tx was created and sent, then failed on token approval
      expect(populateApproveTxMock).toHaveBeenCalledTimes(1);
      expect(sendTransactionMock).toHaveBeenCalledTimes(2);
      expect(updateTransferStatusMock).toHaveBeenCalledWith(0, TransferStatus.Failed);

      // Reset call counts for next attempt
      sendTransactionMock.mockClear();
      populateApproveTxMock.mockClear();
      updateTransferStatusMock.mockClear();
      addTransferMock.mockClear();

      // --- Attempt 2: USDC already approved (skipped), token approval succeeds, user stops ---
      isApproveRequiredAdapterMock.mockResolvedValue(false); // USDC already approved on-chain
      warpCoreMock.getTransferRemoteTxs.mockResolvedValue([
        {
          category: warpTxCategories.Approval,
          type: providerTypes.Ethereum,
          transaction: { to: 'token-router' },
        },
        {
          category: warpTxCategories.Transfer,
          type: providerTypes.Ethereum,
          transaction: { to: 'router' },
        },
      ]);

      const confirmToken = vi
        .fn()
        .mockResolvedValue({ type: 'ethers', receipt: { hash: '0xtoken-approve' } });
      sendTransactionMock
        .mockResolvedValueOnce({ hash: '0xtoken-approve', confirm: confirmToken })
        .mockRejectedValueOnce(new Error('User stopped'));

      await act(async () => {
        await result.current.triggerTransactions(values);
      });

      // USDC approval skipped - populateApproveTx not called for USDC
      expect(populateApproveTxMock).not.toHaveBeenCalled();
      // Token approval sent, then failed on transfer
      expect(sendTransactionMock).toHaveBeenCalledTimes(2);
      expect(updateTransferStatusMock).toHaveBeenCalledWith(0, TransferStatus.Failed);

      // Reset call counts for final attempt
      sendTransactionMock.mockClear();
      populateApproveTxMock.mockClear();
      updateTransferStatusMock.mockClear();
      addTransferMock.mockClear();

      // --- Attempt 3: Both approvals done, only transfer needed - succeeds ---
      isApproveRequiredAdapterMock.mockResolvedValue(false); // USDC still approved
      warpCoreMock.getTransferRemoteTxs.mockResolvedValue([
        {
          category: warpTxCategories.Transfer,
          type: providerTypes.Ethereum,
          transaction: { to: 'router' },
        },
      ]); // SDK no longer includes token approval tx

      const confirmTransfer = vi
        .fn()
        .mockResolvedValue({ type: 'ethers', receipt: { hash: '0xtransfer' } });
      sendTransactionMock.mockResolvedValueOnce({
        hash: '0xtransfer',
        confirm: confirmTransfer,
      });

      await act(async () => {
        await result.current.triggerTransactions(values);
      });

      // No approvals needed - only transfer sent
      expect(populateApproveTxMock).not.toHaveBeenCalled();
      expect(sendTransactionMock).toHaveBeenCalledTimes(1);
      expect(sendTransactionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tx: expect.objectContaining({ category: warpTxCategories.Transfer }),
        }),
      );
      expect(updateTransferStatusMock).toHaveBeenCalledWith(
        0,
        TransferStatus.ConfirmedTransfer,
        expect.objectContaining({ originTxHash: '0xtransfer' }),
      );
    });
  });
});
