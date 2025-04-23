import {
  EvmKhalaniHypAdapter,
  TokenStandard,
  TypedTransactionReceipt,
  WarpCore,
  WarpTxCategory,
} from '@hyperlane-xyz/sdk';
import { fromWei, toTitleCase, toWei } from '@hyperlane-xyz/utils';
import {
  getAccountAddressForChain,
  useAccounts,
  useActiveChains,
  useEthereumSignTypedData,
  useTransactionFns,
} from '@hyperlane-xyz/widgets';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { toastTxSuccess } from '../../components/toast/TxSuccessToast';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { AppState, useStore } from '../store';
import { getTokenByIndex, useWarpCore } from '../tokens/hooks';
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
  const { signTypedData } = useEthereumSignTypedData(multiProvider);

  const [isLoading, setIsLoading] = useState(false);

  // TODO implement cancel callback for when modal is closed?
  const triggerTransactions = useCallback(
    (values: TransferFormValues) =>
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
        signTypedData,
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
      signTypedData,
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
  signTypedData,
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
  signTypedData: ReturnType<typeof useEthereumSignTypedData>['signTypedData'];
}) {
  logger.debug('Preparing transfer transaction(s)');
  setIsLoading(true);
  let transferStatus: TransferStatus = TransferStatus.Preparing;
  updateTransferStatus(transferIndex, transferStatus);

  const { origin, destination, tokenIndex, amount, recipient } = values;
  const multiProvider = warpCore.multiProvider;

  try {
    const originToken = getTokenByIndex(warpCore, tokenIndex);
    const connection = originToken?.getConnectionForChain(destination);
    if (!originToken || !connection) throw new Error('No token route found between chains');

    const originProtocol = originToken.protocol;
    const isNft = originToken.isNft();
    const weiAmountOrId = isNft ? amount : toWei(amount, originToken.decimals);
    const originTokenAmount = originToken.amount(weiAmountOrId);

    const sendTransaction = transactionFns[originProtocol].sendTransaction;
    const activeChain = activeChains.chains[originProtocol];
    const sender = getAccountAddressForChain(multiProvider, origin, activeAccounts.accounts);
    if (!sender) throw new Error('No active account found for origin chain');

    const isCollateralSufficient = await warpCore.isDestinationCollateralSufficient({
      originTokenAmount,
      destination,
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
      destTokenAddressOrDenom: connection.token.addressOrDenom,
      sender,
      recipient,
      amount,
    });

    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.CreatingTxs));

    const txs = await warpCore.getTransferRemoteTxs({
      originTokenAmount,
      destination,
      sender,
      recipient,
    });

    const hashes: string[] = [];
    let txReceipt: TypedTransactionReceipt | undefined = undefined;

    for (const tx of txs) {
      updateTransferStatus(transferIndex, (transferStatus = txCategoryToStatuses[tx.category][0]));
      const { hash, confirm } = await sendTransaction({
        tx,
        chainName: origin,
        activeChainName: activeChain.chainName,
      });
      updateTransferStatus(transferIndex, (transferStatus = txCategoryToStatuses[tx.category][1]));
      txReceipt = await confirm();
      const description = toTitleCase(tx.category);
      logger.debug(`${description} transaction confirmed, hash:`, hash);
      toastTxSuccess(`${description} transaction sent!`, hash, origin);
      hashes.push(hash);
    }

    if (originToken.standard === TokenStandard.EvmKhalaniIntent) {
      const adapter = originTokenAmount.token.getHypAdapter(multiProvider) as EvmKhalaniHypAdapter;
      const toChainId = multiProvider.getChainId(connection.token.chainName);
      const refineId = await adapter.createRefine(sender, Number(toChainId), weiAmountOrId);

      // RefineResult contains the intent data
      type RefineResult = Awaited<ReturnType<typeof adapter.queryRefine>>;
      let refineData: RefineResult = {} as RefineResult;

      // wait for user signature
      // fee is updated until the user signs the intent
      let isSigning = false;
      let isSigned = false;
      let signedIntentSignature: string | undefined = undefined;
      while (!isSigned) {
        try {
          if (!isSigning) {
            refineData = await adapter.queryRefine(refineId);
            updateTransferStatus(transferIndex, TransferStatus.SigningMessage, {
              signingMessage: {
                message:
                  `Sending ${fromWei(refineData.Refinement.outcome.mAmounts[0], connection.token.decimals)} ${originToken.symbol}\n` +
                  `to: ${destination}\n\n` +
                  `Sign with your wallet to create and send intent.`,
                handleSign: async () => {
                  isSigning = true;
                  const signPayload = await adapter.buildIntentSigningPayload(refineData, sender);
                  return signTypedData(signPayload as any, origin, activeChain.chainName)
                    .then(async (signature) => {
                      isSigned = true;
                      signedIntentSignature = signature;
                      toast.success('Intent signed successfully');
                      updateTransferStatus(transferIndex, TransferStatus.ProcessingDeposit);
                    })
                    .catch(() => {
                      isSigning = false;
                      toast.error('Error signing Intent. Please try again.');
                    });
                },
              },
            });
          }
        } catch (error) {
          logger.error('Error checking for signature request:', error);
        }

        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      // Wait for mToken minting on Arcadia chain.
      await adapter.waitForMTokenMinting(BigInt(weiAmountOrId), sender);

      // propose intent
      if (!signedIntentSignature) throw new Error('No intent signature found');
      const { intentId, transactionHash } = await adapter.proposeIntent(
        refineData as RefineResult,
        signedIntentSignature,
      );
      updateTransferStatus(transferIndex, TransferStatus.WaitingForFulfillment);

      // wait for intent to be settled
      let isIntentCompleted = false;
      while (!isIntentCompleted) {
        try {
          const status = await adapter.getIntentStatus(intentId);
          if (status === 'Solved') {
            isIntentCompleted = true;

            updateTransferStatus(transferIndex, TransferStatus.ConfirmedTransfer, {
              providerExplorerLink: `https://explorer.khalani.network/tx/${transactionHash}`,
            });
          } else if (status === 'NonExistent' || status === 'Expired' || status === 'Cancelled') {
            isIntentCompleted = true;
            updateTransferStatus(transferIndex, TransferStatus.Failed);
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          logger.error('Error checking intent status:', error);
        }
      }
    } else {
      const msgId = txReceipt
        ? tryGetMsgIdFromTransferReceipt(multiProvider, origin, txReceipt)
        : undefined;

      updateTransferStatus(transferIndex, (transferStatus = TransferStatus.ConfirmedTransfer), {
        originTxHash: hashes.at(-1),
        msgId,
      });
    }
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
