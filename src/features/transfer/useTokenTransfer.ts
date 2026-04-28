import {
  ProviderType,
<<<<<<< HEAD
=======
  Token,
>>>>>>> origin/main
  TypedTransactionReceipt,
  WarpCore,
  WarpTxCategory,
} from '@hyperlane-xyz/sdk';
import { toTitleCase, toWei } from '@hyperlane-xyz/utils';
import {
  getAccountAddressForChain,
  useAccounts,
  useActiveChains,
  useTransactionFns,
} from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import { toastTxSuccess } from '../../components/toast/TxSuccessToast';
import { logger } from '../../utils/logger';
<<<<<<< HEAD
=======
import { refinerIdentifyAndShowTransferForm } from '../analytics/refiner';
>>>>>>> origin/main
import { EVENT_NAME } from '../analytics/types';
import { trackEvent } from '../analytics/utils';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { AppState, useStore } from '../store';
import { getTokenByKey, useWarpCore } from '../tokens/hooks';
import { findConnectedDestinationToken } from '../tokens/utils';
import { fetchPredicateAttestation, PredicateAttestationResult } from './predicate';
import { TransferContext, TransferFormValues, TransferStatus } from './types';
import { tryGetMsgIdFromTransferReceipt } from './utils';

const CHAIN_MISMATCH_ERROR = 'ChainMismatchError';
const TRANSFER_TIMEOUT_ERROR1 = 'block height exceeded';
const TRANSFER_TIMEOUT_ERROR2 = 'timeout';

export function useTokenTransfer(onDone?: () => void) {
  const { transfers, addTransfer, updateTransferStatus } = useStore((s) => ({
    transfers: s.transfers,
    addTransfer: s.addTransfer,
    updateTransferStatus: s.updateTransferStatus,
  }));
  const transferIndex = transfers.length;

  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const activeAccounts = useAccounts(multiProvider);
  const activeChains = useActiveChains(multiProvider);
  const transactionFns = useTransactionFns(multiProvider);

  const [isLoading, setIsLoading] = useState(false);

  // TODO implement cancel callback for when modal is closed?
  const triggerTransactions = useCallback(
    (values: TransferFormValues, routeOverrideToken: Token | null) =>
      executeTransfer({
        warpCore,
        values,
        transferIndex,
        activeAccounts,
        activeChains,
        transactionFns,
        addTransfer,
        updateTransferStatus,
        setIsLoading,
        onDone,
        routeOverrideToken,
      }),
    [
      warpCore,
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
  warpCore,
  values,
  transferIndex,
  activeAccounts,
  activeChains,
  transactionFns,
  addTransfer,
  updateTransferStatus,
  setIsLoading,
  onDone,
  routeOverrideToken,
}: {
  warpCore: WarpCore;
  values: TransferFormValues;
  transferIndex: number;
  activeAccounts: ReturnType<typeof useAccounts>;
  activeChains: ReturnType<typeof useActiveChains>;
  transactionFns: ReturnType<typeof useTransactionFns>;
  addTransfer: (t: TransferContext) => void;
  updateTransferStatus: AppState['updateTransferStatus'];
  setIsLoading: (b: boolean) => void;
  onDone?: () => void;
  routeOverrideToken: Token | null;
}) {
  logger.debug('Preparing transfer transaction(s)');
  setIsLoading(true);
  let transferStatus: TransferStatus = TransferStatus.Preparing;
  updateTransferStatus(transferIndex, transferStatus);

  const { originTokenKey, destinationTokenKey, amount, recipient: formRecipient } = values;
  const multiProvider = warpCore.multiProvider;

  try {
    const originToken = routeOverrideToken || getTokenByKey(warpCore.tokens, originTokenKey);
    const destinationToken = getTokenByKey(warpCore.tokens, destinationTokenKey);
    if (!originToken || !destinationToken) throw new Error('No token route found between chains');

    // Get effective recipient (form value or fallback to connected wallet for destination)
    const connectedDestAddress = getAccountAddressForChain(
      multiProvider,
      destinationToken.chainName,
      activeAccounts.accounts,
    );
    const recipient = formRecipient || connectedDestAddress || '';
    if (!recipient) throw new Error('No recipient address available');
    // Resolve the connected destination token that matches the selected destination token.
    const connectedDestinationToken = findConnectedDestinationToken(originToken, destinationToken);
    if (!connectedDestinationToken) throw new Error('No token connection found between chains');
    const origin = originToken.chainName;
    const destination = connectedDestinationToken.chainName;

    const originProtocol = originToken.protocol;
    const isNft = originToken.isNft();
    const weiAmountOrId = isNft ? amount : toWei(amount, originToken.decimals);
    const originTokenAmount = originToken.amount(weiAmountOrId);

    const sendTransaction = transactionFns[originProtocol].sendTransaction;
    const sendMultiTransaction = transactionFns[originProtocol].sendMultiTransaction;
    const activeChain = activeChains.chains[originProtocol];
    const sender = getAccountAddressForChain(multiProvider, origin, activeAccounts.accounts);
    if (!sender) throw new Error('No active account found for origin chain');

    const isCollateralSufficient = await warpCore.isDestinationCollateralSufficient({
      originTokenAmount,
      destination,
      destinationToken: connectedDestinationToken,
    });
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
      destTokenAddressOrDenom: connectedDestinationToken.addressOrDenom,
      sender,
      recipient,
      amount,
    });

    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.CreatingTxs));

    // Check if Predicate attestation is needed
    let attestationResult: PredicateAttestationResult | undefined;

    try {
      updateTransferStatus(transferIndex, (transferStatus = TransferStatus.FetchingAttestation));
      attestationResult = await fetchPredicateAttestation({
        warpCore,
        token: originToken,
        destination,
        sender,
        recipient,
        amount: originTokenAmount,
        destinationToken: connectedDestinationToken,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Predicate attestation error:', error);
      throw new Error(`Predicate attestation failed: ${message}`);
    }

    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.CreatingTxs));

    const txs = await warpCore.getTransferRemoteTxs({
      originTokenAmount,
      destination,
      sender,
      recipient,
      attestation: attestationResult?.attestation,
      // Pin the IGP quote captured at attestation time so msg_value matches the
      // attested Statement preimage — prevents _authorizeTransaction revert on drift.
      interchainFee: attestationResult?.interchainFee,
      tokenFeeQuote: attestationResult?.tokenFeeQuote,
      destinationToken: connectedDestinationToken,
    });

    const hashes: string[] = [];
    let txReceipt: TypedTransactionReceipt | undefined = undefined;

    if (txs.length > 1 && txs.every((tx) => tx.type === ProviderType.Starknet)) {
      updateTransferStatus(
        transferIndex,
        (transferStatus = txCategoryToStatuses[WarpTxCategory.Transfer][0]),
      );
      const { hash, confirm } = await sendMultiTransaction({
        txs,
        chainName: origin,
        activeChainName: activeChain.chainName,
      });
      updateTransferStatus(
        transferIndex,
        (transferStatus = txCategoryToStatuses[WarpTxCategory.Transfer][1]),
      );
      txReceipt = await confirm();
      const description = toTitleCase(WarpTxCategory.Transfer);
      logger.debug(`${description} transaction confirmed, hash:`, hash);
      toastTxSuccess(`${description} transaction sent!`, hash, origin);

      hashes.push(hash);
    } else {
      for (const tx of txs) {
        updateTransferStatus(
          transferIndex,
          (transferStatus = txCategoryToStatuses[tx.category][0]),
        );
        const { hash, confirm } = await sendTransaction({
          tx,
          chainName: origin,
          activeChainName: activeChain.chainName,
        });
        updateTransferStatus(
          transferIndex,
          (transferStatus = txCategoryToStatuses[tx.category][1]),
        );
        txReceipt = await confirm();
        const description = toTitleCase(tx.category);
        logger.debug(`${description} transaction confirmed, hash:`, hash);
        toastTxSuccess(`${description} transaction sent!`, hash, origin);

        hashes.push(hash);
      }
    }

    const msgId = txReceipt
      ? tryGetMsgIdFromTransferReceipt(multiProvider, origin, txReceipt)
      : undefined;

    const originTxHash = hashes.at(-1);
<<<<<<< HEAD
    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.ConfirmedTransfer), {
      originTxHash,
=======
    const originBlockNumber =
      txReceipt?.receipt && 'blockNumber' in txReceipt.receipt
        ? Number(txReceipt.receipt.blockNumber)
        : undefined;
    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.ConfirmedTransfer), {
      originTxHash,
      originBlockNumber,
>>>>>>> origin/main
      msgId,
    });

    // track event after tx submission
    const originChainId = warpCore.multiProvider.getChainId(origin);
    const destinationChainId = warpCore.multiProvider.getChainId(destination);
    trackEvent(EVENT_NAME.TRANSACTION_SUBMITTED, {
      amount,
      recipient,
      chains: `${origin}|${originChainId}|${destination}|${destinationChainId}`,
      tokenAddress: originToken.addressOrDenom,
      tokenSymbol: originToken.symbol,
      walletAddress: sender,
      transactionHash: originTxHash || '',
    });
<<<<<<< HEAD
=======

    // Identify user and show Refiner survey form after successful transfer
    refinerIdentifyAndShowTransferForm({
      walletAddress: sender,
      protocol: originProtocol,
      chain: origin,
    });
>>>>>>> origin/main
  } catch (error: any) {
    logger.error(`Error at stage ${transferStatus}`, error);
    const errorDetails = error.message || error.toString();
    updateTransferStatus(transferIndex, TransferStatus.Failed);
    if (errorDetails.includes(CHAIN_MISMATCH_ERROR)) {
      // Wagmi switchNetwork call helps prevent this but isn't foolproof
      toast.error('Wallet must be connected to origin chain');
    } else if (
      errorDetails.includes(TRANSFER_TIMEOUT_ERROR1) ||
      errorDetails.includes(TRANSFER_TIMEOUT_ERROR2)
    ) {
      toast.error(
        `Transaction timed out, ${getChainDisplayName(multiProvider, origin)} may be busy. Please try again.`,
      );
    } else {
      toast.error(errorMessages[transferStatus] || 'Unable to transfer tokens.');
    }
  }

  setIsLoading(false);
  if (onDone) onDone();
}

const errorMessages: Partial<Record<TransferStatus, string>> = {
  [TransferStatus.Preparing]: 'Error while preparing the transactions.',
  [TransferStatus.CreatingTxs]: 'Error while creating the transactions.',
  [TransferStatus.FetchingAttestation]: 'Error while fetching compliance attestation.',
  [TransferStatus.SigningApprove]: 'Error while signing the approve transaction.',
  [TransferStatus.ConfirmingApprove]: 'Error while confirming the approve transaction.',
  [TransferStatus.SigningTransfer]: 'Error while signing the transfer transaction.',
  [TransferStatus.ConfirmingTransfer]: 'Error while confirming the transfer transaction.',
};

const txCategoryToStatuses: Record<WarpTxCategory, [TransferStatus, TransferStatus]> = {
  [WarpTxCategory.Approval]: [TransferStatus.SigningApprove, TransferStatus.ConfirmingApprove],
  [WarpTxCategory.Revoke]: [TransferStatus.SigningRevoke, TransferStatus.ConfirmingRevoke],
  [WarpTxCategory.Transfer]: [TransferStatus.SigningTransfer, TransferStatus.ConfirmingTransfer],
};
