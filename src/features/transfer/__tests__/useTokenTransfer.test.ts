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
  const EvmTokenAdapterMock = vi.fn(() => ({ populateApproveTx: populateApproveTxMock }));
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
    expect(toastErrorMock).toHaveBeenCalledWith('Wallet must be connected to origin chain');
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
});
