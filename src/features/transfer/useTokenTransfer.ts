import {
  InterchainAccount,
  MultiProtocolProvider,
  ProviderType,
  Token,
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
} from '@hyperlane-xyz/widgets';
import { BigNumber } from 'ethers';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { useWalletClient } from 'wagmi';
import { toastTxSuccess } from '../../components/toast/TxSuccessToast';
import { logger } from '../../utils/logger';
import { refinerIdentifyAndShowTransferForm } from '../analytics/refiner';
import { EVENT_NAME } from '../analytics/types';
import { trackEvent } from '../analytics/utils';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { AppState, useStore } from '../store';
import { useInterchainAccountApp } from '../swap/hooks/useInterchainAccount';
import { getSwappableAddress } from '../swap/swapConfig';
import { getTokenByKey, useWarpCore } from '../tokens/hooks';
import { TransferContext, TransferFormValues, TransferStatus } from './types';
import { executeSwapBridge } from './useSwapBridgeTransfer';
import { TransferRouteType } from './useTransferRoute';
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
  const icaApp = useInterchainAccountApp();

  const activeAccounts = useAccounts(multiProvider);
  const activeChains = useActiveChains(multiProvider);
  const transactionFns = useTransactionFns(multiProvider);
  const { data: walletClient } = useWalletClient();

  const [isLoading, setIsLoading] = useState(false);

  const triggerTransactions = useCallback(
    (
      values: TransferFormValues,
      routeOverrideToken: Token | null,
      routeType?: TransferRouteType,
      swapCache?: {
        icaAddress?: string;
        swapOutput?: BigNumber;
        bridgeFee?: BigNumber;
        icaFee?: BigNumber;
      },
    ) =>
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
        routeType,
        walletClient: walletClient ?? undefined,
        icaApp: icaApp ?? undefined,
        multiProvider,
        swapCache,
      }),
    [
      warpCore,
      icaApp,
      transferIndex,
      activeAccounts,
      activeChains,
      transactionFns,
      setIsLoading,
      addTransfer,
      updateTransferStatus,
      onDone,
      walletClient,
      multiProvider,
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
  routeType,
  walletClient,
  icaApp,
  multiProvider: mp,
  swapCache,
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
  routeType?: TransferRouteType;
  walletClient?: ReturnType<typeof useWalletClient>['data'];
  icaApp?: InterchainAccount;
  multiProvider?: MultiProtocolProvider;
  swapCache?: {
    icaAddress?: string;
    swapOutput?: BigNumber;
    bridgeFee?: BigNumber;
    icaFee?: BigNumber;
  };
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

    const connectedDestAddress = getAccountAddressForChain(
      multiProvider,
      destinationToken.chainName,
      activeAccounts.accounts,
    );
    const recipient = formRecipient || connectedDestAddress || '';
    if (!recipient) throw new Error('No recipient address available');

    if (routeType === 'swap-bridge') {
      if (!walletClient || !icaApp || !mp)
        throw new Error('Wallet or ICA app not available for swap-bridge');

      const origin = originToken.chainName;
      const destination = destinationToken.chainName;
      const sender = walletClient.account?.address;
      if (!sender) throw new Error('No active account found');

      addTransfer({
        timestamp: new Date().getTime(),
        status: TransferStatus.Preparing,
        origin,
        destination,
        originTokenAddressOrDenom: originToken.addressOrDenom,
        destTokenAddressOrDenom: destinationToken.addressOrDenom,
        sender,
        recipient,
        amount,
      });

      updateTransferStatus(transferIndex, (transferStatus = TransferStatus.CreatingTxs));

      const isNativeOriginToken = originToken.isNative() || originToken.isHypNative();
      const originSwapAddress = isNativeOriginToken
        ? originToken.addressOrDenom
        : originToken.collateralAddressOrDenom || originToken.addressOrDenom;
      const destinationSwapAddress =
        getSwappableAddress(destinationToken) || destinationToken.addressOrDenom;

      const txHash = await executeSwapBridge({
        originChainName: origin,
        destinationChainName: destination,
        originTokenAddress: originSwapAddress,
        destinationTokenAddress: destinationSwapAddress,
        destinationRouteAddress: destinationToken.addressOrDenom,
        amount,
        originDecimals: originToken.decimals,
        isNativeOriginToken,
        walletClient,
        multiProvider: mp,
        icaApp,
        onStatusChange: (status) => {
          transferStatus = status;
          updateTransferStatus(transferIndex, status);
        },
        cachedIcaAddress: swapCache?.icaAddress,
        cachedSwapOutput: swapCache?.swapOutput,
        cachedBridgeFee: swapCache?.bridgeFee,
        cachedIcaFee: swapCache?.icaFee,
      });

      updateTransferStatus(transferIndex, (transferStatus = TransferStatus.ConfirmedTransfer), {
        originTxHash: txHash,
      });

      toastTxSuccess('Swap & bridge transaction sent!', txHash, origin);
      setIsLoading(false);
      if (onDone) onDone();
      return;
    }

    const connectedDestinationToken = originToken?.getConnectionForChain(
      destinationToken.chainName,
    )?.token;
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

    const txs = await warpCore.getTransferRemoteTxs({
      originTokenAmount,
      destination,
      sender,
      recipient,
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
    updateTransferStatus(transferIndex, (transferStatus = TransferStatus.ConfirmedTransfer), {
      originTxHash,
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

    // Identify user and show Refiner survey form after successful transfer
    refinerIdentifyAndShowTransferForm({
      walletAddress: sender,
      protocol: originProtocol,
      chain: origin,
    });
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
  [TransferStatus.SigningSwapBridge]: 'Error while signing the swap & bridge transaction.',
  [TransferStatus.ConfirmingSwapBridge]: 'Error while confirming the swap & bridge transaction.',
  [TransferStatus.PostingCommitment]: 'Error while posting the commitment.',
};

const txCategoryToStatuses: Record<WarpTxCategory, [TransferStatus, TransferStatus]> = {
  [WarpTxCategory.Approval]: [TransferStatus.SigningApprove, TransferStatus.ConfirmingApprove],
  [WarpTxCategory.Revoke]: [TransferStatus.SigningRevoke, TransferStatus.ConfirmingRevoke],
  [WarpTxCategory.Transfer]: [TransferStatus.SigningTransfer, TransferStatus.ConfirmingTransfer],
};
