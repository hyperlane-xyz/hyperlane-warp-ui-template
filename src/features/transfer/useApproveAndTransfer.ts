import { sendTransaction, switchNetwork } from '@wagmi/core';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import { utils } from '@hyperlane-xyz/utils';

import { toWei } from '../../utils/amount';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/timeout';
import { getErc20Contract } from '../contracts/erc20';
import { getHypErc20CollateralContract } from '../contracts/hypErc20';
import { getProvider } from '../providers';

import { TransferFormValues } from './types';

enum Stage {
  Prepare = 'prepare',
  Approve = 'approve',
  Transfer = 'transfer',
}

export function useApproveAndTransfer(onDone?: () => void) {
  // Flag for showing the tx loading modal
  const [showTxModal, setShowTxModal] = useState(false);

  const hideModal = () => setShowTxModal(false);

  // TODO implement cancel callback for when modal is closed?
  const triggerTransactions = useCallback(
    async (values: TransferFormValues) => {
      logger.debug('Attempting approve and transfer transactions');
      setShowTxModal(true);
      let stage: Stage = Stage.Prepare;

      try {
        const {
          amount,
          sourceChainId,
          destinationChainId,
          recipientAddress,
          tokenAddress,
          hypCollateralAddress,
        } = values;

        await switchNetwork({
          chainId: sourceChainId,
        });

        // https://github.com/wagmi-dev/wagmi/issues/1565
        await sleep(1500);

        const weiAmount = toWei(amount).toString();
        const provider = getProvider(sourceChainId);

        // TODO more validation here, including checking for existence of remote token and ensuring # synthetics == 1
        const erc20 = getErc20Contract(tokenAddress, provider);
        const approveTxRequest = await erc20.populateTransaction.approve(
          hypCollateralAddress,
          weiAmount,
        );

        stage = Stage.Approve;

        // Not using wagmi's prepare + send pattern because we're sending two transactions here
        const { wait: approveWait } = await sendTransaction({
          chainId: sourceChainId,
          request: approveTxRequest,
          mode: 'recklesslyUnprepared',
        });
        const approveTxReceipt = await approveWait(1);
        logger.debug('Approve transaction confirmed, hash:', approveTxReceipt.transactionHash);
        toast.success('Approve transaction sent! Attempting transfer...');

        stage = Stage.Transfer;

        const hypErc20Collateral = getHypErc20CollateralContract(hypCollateralAddress, provider);
        const transferTxRequest = await hypErc20Collateral.populateTransaction.transferRemote(
          destinationChainId,
          utils.addressToBytes32(recipientAddress),
          weiAmount,
        );

        const { wait: transferWait } = await sendTransaction({
          chainId: sourceChainId,
          request: transferTxRequest,
          mode: 'recklesslyUnprepared',
        });
        const transferTxReceipt = await transferWait(1);
        logger.debug('Transfer transaction confirmed, hash:', transferTxReceipt.transactionHash);
        toast.success('Remote transfer has been started!');
      } catch (error) {
        logger.error(`Error at stage ${stage} `, error);
        if (JSON.stringify(error).includes('ChainMismatchError')) {
          // Wagmi switchNetwork call helps prevent this but isn't foolproof
          toast.error('Wallet must be connected to source chain');
        } else {
          toast.error(errorMessages[stage]);
        }
      }

      setShowTxModal(false);
      if (onDone) onDone();
    },
    [setShowTxModal, onDone],
  );

  return {
    showTxModal,
    hideModal,
    triggerTransactions,
  };
}

const errorMessages: Record<Stage, string> = {
  [Stage.Prepare]: 'Error while preparing the transactions.',
  [Stage.Approve]: 'Error while approving the collateral token.',
  [Stage.Transfer]: 'Error while making remote transfer.',
};
