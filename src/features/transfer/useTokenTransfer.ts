import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import { WarpTxCategory } from '@hyperlane-xyz/sdk/dist/warp/types';
import { ProtocolType, toTitleCase, toWei } from '@hyperlane-xyz/utils';

import { toastTxSuccess } from '../../components/toast/TxSuccessToast';
import { getTokenByIndex, getWarpCore } from '../../context/context';
import { logger } from '../../utils/logger';
import { AppState, useStore } from '../store';
import { getCosmosClientType } from '../wallet/hooks/cosmos';
import {
  getAccountAddressForChain,
  useAccounts,
  useActiveChains,
  useTransactionFns,
} from '../wallet/hooks/multiProtocol';

import { TransferContext, TransferFormValues, TransferStatus } from './types';

export function useTokenTransfer(onDone?: () => void) {
  const { transfers, addTransfer, updateTransferStatus } = useStore((s) => ({
    transfers: s.transfers,
    addTransfer: s.addTransfer,
    updateTransferStatus: s.updateTransferStatus,
  }));
  const transferIndex = transfers.length;

  const activeAccounts = useAccounts();
  const activeChains = useActiveChains();
  const transactionFns = useTransactionFns();

  const [isLoading, setIsLoading] = useState(false);

  // TODO implement cancel callback for when modal is closed?
  const triggerTransactions = useCallback(
    (values: TransferFormValues) =>
      executeTransfer({
        values,
        transferIndex,
        activeAccounts,
        activeChains,
        transactionFns,
        addTransfer,
        updateTransferStatus,
        setIsLoading,
        onDone,
      }),
    [
      transferIndex,
      activeAccounts,
      activeChains,
      transactionFns,
      setIsLoading,
      addTransfer,
      updateTransferStatus,
      onDone,
    ],
  );

  return {
    isLoading,
    triggerTransactions,
  };
}

async function executeTransfer({
  values,
  transferIndex,
  activeAccounts,
  activeChains,
  transactionFns,
  addTransfer,
  updateTransferStatus,
  setIsLoading,
  onDone,
}: {
  values: TransferFormValues;
  transferIndex: number;
  activeAccounts: ReturnType<typeof useAccounts>;
  activeChains: ReturnType<typeof useActiveChains>;
  transactionFns: ReturnType<typeof useTransactionFns>;
  addTransfer: (t: TransferContext) => void;
  updateTransferStatus: AppState['updateTransferStatus'];
  setIsLoading: (b: boolean) => void;
  onDone?: () => void;
}) {
  logger.debug('Preparing transfer transaction(s)');
  setIsLoading(true);
  updateTransferStatus(transferIndex, TransferStatus.Preparing);

  try {
    const { origin, destination, tokenIndex, amount, recipient } = values;
    const originToken = getTokenByIndex(tokenIndex);
    const destinationToken = originToken?.getConnectedTokenForChain(destination);
    if (!originToken || !destinationToken) throw new Error('No token route found between chains');

    const originProtocol = originToken.protocol;
    const isNft = originToken.isNft();
    const weiAmountOrId = isNft ? amount : toWei(amount, originToken.decimals);
    const tokenAmount = originToken.amount(weiAmountOrId);

    const sendTransaction = transactionFns[originProtocol].sendTransaction;
    const activeChain = activeChains.chains[originProtocol];
    const activeAccountAddress = getAccountAddressForChain(origin, activeAccounts.accounts);
    if (!activeAccountAddress) throw new Error('No active account found for origin chain');

    const warpCore = getWarpCore();

    const isCollateralSufficient = await warpCore.isDestinationCollateralSufficient(
      tokenAmount,
      destination,
    );
    if (!isCollateralSufficient) {
      toast.error('Insufficient collateral on destination for transfer');
      throw new Error('Insufficient destination collateral');
    }

    addTransfer({
      timestamp: new Date().getTime(),
      status: TransferStatus.Preparing,
      origin,
      destination,
      originTokenAddressOrDenom: originToken.addressOrDenom,
      destTokenAddressOrDenom: destinationToken.addressOrDenom,
      sender: activeAccountAddress,
      recipient,
      amount,
    });

    updateTransferStatus(transferIndex, TransferStatus.CreatingTxs);

    const txs = await warpCore.getTransferRemoteTxs(
      tokenAmount,
      destination,
      activeAccountAddress,
      recipient,
    );

    const clientType =
      originProtocol === ProtocolType.Cosmos ? getCosmosClientType(originToken) : undefined;

    const hashes: string[] = [];
    for (const tx of txs) {
      updateTransferStatus(transferIndex, txCategoryToStatuses[tx.category][0]);
      const { hash, confirm } = await sendTransaction({
        tx: tx.transaction,
        chainName: origin,
        activeChainName: activeChain.chainName,
        clientType,
      });
      updateTransferStatus(transferIndex, txCategoryToStatuses[tx.category][1]);
      const receipt = await confirm();
      const description = toTitleCase(tx.category);
      logger.debug(`${description} transaction confirmed, hash:`, receipt.transactionHash);
      toastTxSuccess(`${description} transaction sent!`, receipt.transactionHash, origin);
      hashes.push(hash);
    }

    // TODO
    // const msgId = tryGetMsgIdFromTransferReceipt(transferReceipt);

    updateTransferStatus(transferIndex, TransferStatus.ConfirmedTransfer, {
      originTxHash: hashes.at(-1),
      msgId: '',
    });
  } catch (error) {
    logger.error(`Error at stage ${status}`, error);
    updateTransferStatus(transferIndex, TransferStatus.Failed);
    if (JSON.stringify(error).includes('ChainMismatchError')) {
      // Wagmi switchNetwork call helps prevent this but isn't foolproof
      toast.error('Wallet must be connected to origin chain');
    } else {
      toast.error(errorMessages[status] || 'Unable to transfer tokens.');
    }
  }

  setIsLoading(false);
  if (onDone) onDone();
}

const errorMessages: Partial<Record<TransferStatus, string>> = {
  [TransferStatus.Preparing]: 'Error while preparing the transactions.',
  [TransferStatus.CreatingTxs]: 'Error while creating the transactions.',
  [TransferStatus.SigningApprove]: 'Error while signing the approve transaction.',
  [TransferStatus.ConfirmingApprove]: 'Error while confirming the approve transaction.',
  [TransferStatus.SigningTransfer]: 'Error while signing the transfer transaction.',
  [TransferStatus.ConfirmingTransfer]: 'Error while confirming the transfer transaction.',
};

const txCategoryToStatuses: Record<WarpTxCategory, [TransferStatus, TransferStatus]> = {
  [WarpTxCategory.Approval]: [TransferStatus.SigningApprove, TransferStatus.ConfirmingApprove],
  [WarpTxCategory.Transfer]: [TransferStatus.SigningTransfer, TransferStatus.ConfirmingTransfer],
};
