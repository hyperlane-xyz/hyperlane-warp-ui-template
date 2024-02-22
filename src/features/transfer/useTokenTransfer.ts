import { MsgTransferEncodeObject } from '@cosmjs/stargate';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import {
  CosmIbcToWarpTokenAdapter,
  CosmIbcTokenAdapter,
  IHypTokenAdapter,
} from '@hyperlane-xyz/sdk';
import { WarpTxCategory } from '@hyperlane-xyz/sdk/dist/warp/types';
import { toTitleCase, toWei } from '@hyperlane-xyz/utils';

import { toastTxSuccess } from '../../components/toast/TxSuccessToast';
import { getMultiProvider, getWarpCore } from '../../context/context';
import { logger } from '../../utils/logger';
import { AppState, useStore } from '../store';
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
    const { origin, destination, token: originToken, amount, recipientAddress } = values;
    const destinationToken = originToken?.getConnectedTokenForChain(destination);
    if (!originToken || !destinationToken) throw new Error('No token route found between chains');
    const originProtocol = originToken.protocol;

    const isNft = originToken.isNft();
    const weiAmountOrId = isNft ? amount : toWei(amount, originToken.decimals);
    const tokenAmount = originToken.amount(weiAmountOrId);
    const activeChain = activeChains.chains[originProtocol];
    const sendTransaction = transactionFns[originProtocol].sendTransaction;
    const activeAccountAddress = getAccountAddressForChain(origin, activeAccounts.accounts);
    if (!activeAccountAddress) throw new Error('No active account found for origin chain');

    const warpCore = getWarpCore();

    const isCollateralSufficient = await warpCore.isDestinationCollateralSufficient(
      tokenAmount,
      origin,
    );
    if (!isCollateralSufficient) {
      toast.error('Insufficient collateral on destination for transfer');
      throw new Error('Insufficient destination collateral');
    }

    addTransfer({
      activeAccountAddress,
      timestamp: new Date().getTime(),
      status: TransferStatus.Preparing,
      origin,
      destination,
      originTokenAddressOrDenom: originToken.addressOrDenom,
      destTokenAddressOrDenom: destinationToken.addressOrDenom,
      recipientAddress,
      amount,
    });

    updateTransferStatus(transferIndex, TransferStatus.CreatingTxs);

    const txs = await warpCore.getTransferRemoteTxs(
      tokenAmount,
      destination,
      activeAccountAddress,
      recipientAddress,
    );

    // Send any necessary approvals first
    const hashes: string[] = [];
    for (const tx of txs) {
      updateTransferStatus(transferIndex, txCategoryToStatuses[tx.category][0]);
      // TODO fix sendTx type
      // TODO use `ethers5TxToWagmiTx` in evm sender
      // TODO   tx: { type: 'cosmwasm', request: transferTxRequest },
      const { hash, confirm } = await sendTransaction({
        tx,
        chain: origin,
        activeChain: activeChain,
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

async function executeIbcTransfer({
  weiAmountOrId,
  destinationDomainId,
  recipientAddress,
  tokenRoute,
  activeChain,
  activeAccountAddress,
  updateStatus,
  sendTransaction,
}: ExecuteTransferParams<any, void>) {
  if (!isIbcRoute(tokenRoute)) throw new Error('Unsupported route type');
  updateStatus(TransferStatus.CreatingTransfer);

  const multiProvider = getMultiProvider();
  const chainName = getChainMetadata(tokenRoute.originCaip2Id).name;
  const adapterProperties = {
    ibcDenom: tokenRoute.originIbcDenom,
    sourcePort: tokenRoute.sourcePort,
    sourceChannel: tokenRoute.sourceChannel,
  };

  let adapter: IHypTokenAdapter;
  let txValue: string | undefined = undefined;
  if (isIbcOnlyRoute(tokenRoute)) {
    adapter = new CosmIbcTokenAdapter(chainName, multiProvider, {}, adapterProperties);
  } else {
    const intermediateChainName = getChainMetadata(tokenRoute.intermediateCaip2Id).name;
    adapter = new CosmIbcToWarpTokenAdapter(
      chainName,
      multiProvider,
      {
        intermediateRouterAddress: tokenRoute.intermediateRouterAddress,
        destinationRouterAddress: tokenRoute.destRouterAddress,
      },
      {
        ...adapterProperties,
        derivedIbcDenom: tokenRoute.derivedIbcDenom,
        intermediateChainName,
      },
    );
    const igpQuote = await fetchIgpQuote(tokenRoute, adapter);
    txValue = igpQuote.weiAmount;
  }

  const transferTxRequest = (await adapter.populateTransferRemoteTx({
    weiAmountOrId,
    recipient: recipientAddress,
    fromAccountOwner: activeAccountAddress,
    destination: destinationDomainId,
    txValue,
  })) as MsgTransferEncodeObject;

  updateStatus(TransferStatus.SigningTransfer);
  const { hash: transferTxHash, confirm: confirmTransfer } = await sendTransaction({
    tx: { type: 'stargate', request: transferTxRequest },
    chainCaip2Id: tokenRoute.originCaip2Id,
    activeCap2Id: activeChain.chainCaip2Id,
  });

  updateStatus(TransferStatus.ConfirmingTransfer);
  await confirmTransfer();

  return { transferTxHash };
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
