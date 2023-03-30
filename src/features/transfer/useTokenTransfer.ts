import { sendTransaction, switchNetwork } from '@wagmi/core';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { useChainId } from 'wagmi';

import { utils } from '@hyperlane-xyz/utils';

import { toastTxSuccess } from '../../components/toast/TxSuccessToast';
import { toWei } from '../../utils/amount';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/timeout';
import { getErc20Contract } from '../contracts/erc20';
import { getHypErc20CollateralContract, getHypErc20Contract } from '../contracts/hypErc20';
import { getProvider } from '../multiProvider';
import { useStore } from '../store';
import { RouteType, RoutesMap, getTokenRoute } from '../tokens/routes';

import { TransferFormValues, TransferStatus } from './types';

enum Stage {
  Prepare = 'prepare',
  Approve = 'approve',
  Transfer = 'transfer',
}

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
      let stage: Stage = Stage.Prepare;

      try {
        const { amount, sourceChainId, destinationChainId, recipientAddress, tokenAddress } =
          values;

        const tokenRoute = getTokenRoute(
          sourceChainId,
          destinationChainId,
          tokenAddress,
          tokenRoutes,
        );
        if (!tokenRoute) throw new Error('No token route found between chains');

        const isNativeToRemote = tokenRoute.type === RouteType.NativeToRemote;
        const weiAmount = toWei(amount, tokenRoute.decimals).toString();
        const provider = getProvider(sourceChainId);

        addTransfer({
          status: TransferStatus.Preparing,
          route: tokenRoute,
          params: values,
        });

        if (sourceChainId !== chainId) {
          await switchNetwork({
            chainId: sourceChainId,
          });
          // Some wallets seem to require a brief pause after switch
          await sleep(1500);
        }

        if (isNativeToRemote) {
          stage = Stage.Approve;
          const erc20 = getErc20Contract(tokenAddress, provider);
          const approveTxRequest = await erc20.populateTransaction.approve(
            tokenRoute.hypCollateralAddress,
            weiAmount,
          );

          const { wait: approveWait } = await sendTransaction({
            chainId: sourceChainId,
            request: approveTxRequest,
            mode: 'recklesslyUnprepared', // See note above function
          });
          const approveTxReceipt = await approveWait(1);
          logger.debug('Approve transaction confirmed, hash:', approveTxReceipt.transactionHash);
          toastTxSuccess(
            'Approve transaction sent!',
            approveTxReceipt.transactionHash,
            sourceChainId,
          );
        }

        stage = Stage.Transfer;

        const hypErc20 = isNativeToRemote
          ? getHypErc20CollateralContract(tokenRoute.hypCollateralAddress, provider)
          : getHypErc20Contract(tokenRoute.sourceTokenAddress, provider);
        const gasPayment = await hypErc20.quoteGasPayment(destinationChainId);
        const transferTxRequest = await hypErc20.populateTransaction.transferRemote(
          destinationChainId,
          utils.addressToBytes32(recipientAddress),
          weiAmount,
          {
            value: gasPayment,
          },
        );

        updateTransferStatus(transferIndex, TransferStatus.Signing);

        const { wait: transferWait, hash: originTxHash } = await sendTransaction({
          chainId: sourceChainId,
          request: transferTxRequest,
          mode: 'recklesslyUnprepared', // See note above function
        });
        // TODO get message ID from tx receipt or by from utils.formatMessage
        updateTransferStatus(transferIndex, TransferStatus.Pending, { originTxHash });

        // Wait for tx to have at least one confirmation
        await transferWait(1);
        updateTransferStatus(transferIndex, TransferStatus.Confirmed);

        logger.debug('Transfer transaction confirmed, hash:', originTxHash);
        toastTxSuccess('Remote transfer started!', originTxHash, sourceChainId);
      } catch (error) {
        logger.error(`Error at stage ${stage} `, error);
        updateTransferStatus(transferIndex, TransferStatus.Failed);
        if (JSON.stringify(error).includes('ChainMismatchError')) {
          // Wagmi switchNetwork call helps prevent this but isn't foolproof
          toast.error('Wallet must be connected to source chain');
        } else {
          toast.error(errorMessages[stage]);
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

const errorMessages: Record<Stage, string> = {
  [Stage.Prepare]: 'Error while preparing the transactions.',
  [Stage.Approve]: 'Error while approving the collateral token.',
  [Stage.Transfer]: 'Error while making remote transfer.',
};
