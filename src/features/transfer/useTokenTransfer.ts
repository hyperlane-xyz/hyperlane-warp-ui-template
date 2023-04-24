import { sendTransaction, switchNetwork } from '@wagmi/core';
import { providers } from 'ethers';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { useChainId } from 'wagmi';

import { TokenType } from '@hyperlane-xyz/hyperlane-token';
import { HyperlaneCore } from '@hyperlane-xyz/sdk';
import { utils } from '@hyperlane-xyz/utils';

import { toastTxSuccess } from '../../components/toast/TxSuccessToast';
import { toWei } from '../../utils/amount';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/timeout';
import { getErc20Contract } from '../contracts/erc20';
import { getTokenRouterContract } from '../contracts/hypErc20';
import { getMultiProvider, getProvider } from '../multiProvider';
import { useStore } from '../store';
import { Route, RouteType, RoutesMap, getTokenRoute } from '../tokens/routes';
import { isNativeToken } from '../tokens/utils';

import { TransferFormValues, TransferStatus } from './types';

// Note, this doesn't use wagmi's prepare + send pattern because we're potentially sending two transactions
// The prepare hooks are recommended to use pre-click downtime to run async calls, but since the flow
// may require two serial txs, the prepare hooks aren't useful and complicate hook architecture considerably.
// See https://github.com/hyperlane-xyz/hyperlane-warp-ui-template/issues/19
// See https://github.com/wagmi-dev/wagmi/discussions/1564
export function useTokenTransfer(onDone?: () => void) {
  const { transfers, addTransfer, updateTransferStatus } = useStore((s) => ({
    transfers: s.transfers,
    addTransfer: s.addTransfer,
    updateTransferStatus: s.updateTransferStatus,
  }));
  const transferIndex = transfers.length;

  const [isLoading, setIsLoading] = useState(false);

  const chainId = useChainId();

  // TODO implement cancel callback for when modal is closed?
  const triggerTransactions = useCallback(
    async (values: TransferFormValues, tokenRoutes: RoutesMap) => {
      logger.debug('Preparing transfer transaction(s)');
      setIsLoading(true);
      let status: TransferStatus = TransferStatus.Preparing;

      try {
        const { amount, originChainId, destinationChainId, recipientAddress, tokenAddress } =
          values;

        const tokenRoute = getTokenRoute(
          originChainId,
          destinationChainId,
          tokenAddress,
          tokenRoutes,
        );
        if (!tokenRoute) throw new Error('No token route found between chains');

        const isBaseToSynthetic = tokenRoute.type === RouteType.BaseToSynthetic;
        const isTokenNative = isNativeToken(tokenAddress);
        const weiAmount = toWei(amount, tokenRoute.decimals).toString();
        const provider = getProvider(originChainId);

        addTransfer({
          status,
          route: tokenRoute,
          params: values,
        });

        if (originChainId !== chainId) {
          await switchNetwork({
            chainId: originChainId,
          });
          // Some wallets seem to require a brief pause after switch
          await sleep(1500);
        }

        if (isTransferApproveRequired(tokenRoute, tokenAddress)) {
          updateTransferStatus(transferIndex, (status = TransferStatus.CreatingApprove));
          const erc20 = getErc20Contract(tokenAddress, provider);
          const approveTxRequest = await erc20.populateTransaction.approve(
            tokenRoute.tokenRouterAddress,
            weiAmount,
          );

          updateTransferStatus(transferIndex, (status = TransferStatus.SigningApprove));
          const { wait: approveWait } = await sendTransaction({
            chainId: originChainId,
            request: approveTxRequest,
            mode: 'recklesslyUnprepared', // See note above function
          });

          updateTransferStatus(transferIndex, (status = TransferStatus.ConfirmingApprove));
          const approveTxReceipt = await approveWait(1);
          logger.debug('Approve transaction confirmed, hash:', approveTxReceipt.transactionHash);
          toastTxSuccess(
            'Approve transaction sent!',
            approveTxReceipt.transactionHash,
            originChainId,
          );
        }

        updateTransferStatus(transferIndex, (status = TransferStatus.CreatingTransfer));
        const contractType: TokenType = !isBaseToSynthetic
          ? TokenType.synthetic
          : isTokenNative
          ? TokenType.native
          : TokenType.collateral;
        const tokenRouterContract = getTokenRouterContract(
          contractType,
          tokenRoute.originTokenAddress,
          provider,
        );
        const gasPayment = await tokenRouterContract.quoteGasPayment(destinationChainId);
        const msgValue = contractType === TokenType.native ? gasPayment.add(weiAmount) : gasPayment;
        const transferTxRequest = await tokenRouterContract.populateTransaction.transferRemote(
          destinationChainId,
          utils.addressToBytes32(recipientAddress),
          weiAmount,
          {
            value: msgValue,
          },
        );

        updateTransferStatus(transferIndex, (status = TransferStatus.SigningTransfer));
        const { wait: transferWait, hash: originTxHash } = await sendTransaction({
          chainId: originChainId,
          request: transferTxRequest,
          mode: 'recklesslyUnprepared', // See note above function
        });

        updateTransferStatus(transferIndex, (status = TransferStatus.ConfirmingTransfer));
        const transferReceipt = await transferWait(1);
        const msgId = tryGetMsgIdFromTransferReceipt(transferReceipt);

        updateTransferStatus(transferIndex, (status = TransferStatus.ConfirmedTransfer), {
          originTxHash,
          msgId,
        });
        logger.debug('Transfer transaction confirmed, hash:', originTxHash);
        toastTxSuccess('Remote transfer started!', originTxHash, originChainId);
      } catch (error) {
        logger.error(`Error at stage ${status} `, error);
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
    },
    [setIsLoading, onDone, chainId, addTransfer, updateTransferStatus, transferIndex],
  );

  return {
    isLoading,
    triggerTransactions,
  };
}

export function isTransferApproveRequired(route: Route, tokenAddress: string) {
  return !isNativeToken(tokenAddress) && route.type === RouteType.BaseToSynthetic;
}

function tryGetMsgIdFromTransferReceipt(receipt: providers.TransactionReceipt) {
  try {
    // TODO replace with static getDispatchedMessages call after next SDK release
    const core = HyperlaneCore.fromEnvironment('mainnet', getMultiProvider());
    const messages = core.getDispatchedMessages(receipt);
    if (messages.length) {
      const msgId = messages[0].id;
      logger.debug('Message id found in logs', msgId);
      return msgId;
    } else {
      logger.warn('No messages found in logs');
      return undefined;
    }
  } catch (error) {
    logger.error('Could not get msgId from transfer receipt', error);
    return undefined;
  }
}

const errorMessages: Partial<Record<TransferStatus, string>> = {
  [TransferStatus.Preparing]: 'Error while preparing the transactions.',
  [TransferStatus.CreatingApprove]: 'Error while creating the approve transaction.',
  [TransferStatus.SigningApprove]: 'Error while signing the approve transaction.',
  [TransferStatus.ConfirmingApprove]: 'Error while confirming the approve transaction.',
  [TransferStatus.CreatingTransfer]: 'Error while creating the transfer transaction.',
  [TransferStatus.SigningTransfer]: 'Error while signing the transfer transaction.',
  [TransferStatus.ConfirmingTransfer]: 'Error while confirming the transfer transaction.',
};
