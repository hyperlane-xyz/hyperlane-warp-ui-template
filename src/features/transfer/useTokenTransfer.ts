import { sendTransaction, switchNetwork } from '@wagmi/core';
import { BigNumber, PopulatedTransaction, providers } from 'ethers';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import { HyperlaneCore } from '@hyperlane-xyz/sdk';

import { toastTxSuccess } from '../../components/toast/TxSuccessToast';
import { toWei } from '../../utils/amount';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/timeout';
import { getEthereumChainId, getProtocolType } from '../chains/caip2';
import { ProtocolType } from '../chains/types';
import { getMultiProvider } from '../multiProvider';
import { useStore } from '../store';
import { AdapterFactory } from '../tokens/adapters/AdapterFactory';
import { IHypTokenAdapter } from '../tokens/adapters/ITokenAdapter';
import { Route, RouteType, RoutesMap, getTokenRoute } from '../tokens/routes';
import { isNativeToken } from '../tokens/utils';
import { ActiveChainInfo, useActiveChains } from '../wallet/hooks';

import { TransferFormValues, TransferStatus } from './types';

export function useTokenTransfer(onDone?: () => void) {
  const { transfers, addTransfer, updateTransferStatus } = useStore((s) => ({
    transfers: s.transfers,
    addTransfer: s.addTransfer,
    updateTransferStatus: s.updateTransferStatus,
  }));
  const transferIndex = transfers.length;

  const [isLoading, setIsLoading] = useState(false);

  const activeChains = useActiveChains();

  // TODO implement cancel callback for when modal is closed?
  const triggerTransactions = useCallback(
    async (values: TransferFormValues, tokenRoutes: RoutesMap) => {
      logger.debug('Preparing transfer transaction(s)');
      setIsLoading(true);
      let status: TransferStatus = TransferStatus.Preparing;

      try {
        const { originCaip2Id, destinationCaip2Id, tokenAddress } = values;
        const originProtocol = getProtocolType(originCaip2Id);
        const tokenRoute = getTokenRoute(
          originCaip2Id,
          destinationCaip2Id,
          tokenAddress,
          tokenRoutes,
        );
        if (!tokenRoute) throw new Error('No token route found between chains');

        addTransfer({
          status,
          route: tokenRoute,
          params: values,
        });

        let transferTxHash: string;
        let msgId: string | undefined;
        const triggerParams: TriggerTransferParams = {
          values,
          tokenRoute,
          activeChain: activeChains.chains[originProtocol],
          updateStatus: (s: TransferStatus) => {
            status = s;
            updateTransferStatus(transferIndex, s);
          },
        };
        if (originProtocol === ProtocolType.Ethereum) {
          const result = await triggerEvmTransfer(triggerParams);
          ({ transferTxHash, msgId } = result);
        } else if (originProtocol === ProtocolType.Sealevel) {
          const result = await triggerSealevelTransfer(triggerParams);
          ({ transferTxHash, msgId } = result);
        } else {
          throw new Error(`Unsupported protocol type: ${originProtocol}`);
        }

        updateTransferStatus(transferIndex, (status = TransferStatus.ConfirmedTransfer), {
          originTxHash: transferTxHash,
          msgId,
        });

        logger.debug('Transfer transaction confirmed, hash:', transferTxHash);
        toastTxSuccess('Remote transfer started!', transferTxHash, originCaip2Id);
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
    [transferIndex, activeChains, setIsLoading, addTransfer, updateTransferStatus, onDone],
  );

  return {
    isLoading,
    triggerTransactions,
  };
}

interface TriggerTransferParams {
  values: TransferFormValues;
  tokenRoute: Route;
  activeChain: ActiveChainInfo;
  updateStatus: (s: TransferStatus) => void;
}

// Note, this doesn't use wagmi's prepare + send pattern because we're potentially sending two transactions
// The prepare hooks are recommended to use pre-click downtime to run async calls, but since the flow
// may require two serial txs, the prepare hooks aren't useful and complicate hook architecture considerably.
// See https://github.com/hyperlane-xyz/hyperlane-warp-ui-template/issues/19
// See https://github.com/wagmi-dev/wagmi/discussions/1564
async function triggerEvmTransfer({
  values,
  tokenRoute,
  activeChain,
  updateStatus,
}: TriggerTransferParams) {
  const { amount, originCaip2Id, destinationCaip2Id, recipientAddress, tokenAddress } = values;
  const { type: routeType, tokenRouterAddress, originTokenAddress, decimals, isNft } = tokenRoute;
  const amountOrId = isNft ? amount : toWei(amount, decimals).toString();
  const originChainId = getEthereumChainId(originCaip2Id);
  const destinationChainId = getEthereumChainId(destinationCaip2Id);
  const activeChainId = activeChain?.caip2Id ? getEthereumChainId(activeChain.caip2Id) : undefined;
  const destinationDomainId = getMultiProvider().getDomainId(destinationChainId);

  if (activeChainId && originChainId !== activeChainId) {
    await switchNetwork({
      chainId: originChainId,
    });
    // Some wallets seem to require a brief pause after switch
    await sleep(1500);
  }

  if (isTransferApproveRequired(tokenRoute, tokenAddress)) {
    updateStatus(TransferStatus.CreatingApprove);
    const tokenAdapter = AdapterFactory.TokenAdapterFromAddress(originCaip2Id, tokenAddress);
    const approveTxRequest = (await tokenAdapter.prepareApproveTx({
      amountOrId,
      recipient: tokenRouterAddress,
    })) as PopulatedTransaction;

    updateStatus(TransferStatus.SigningApprove);
    const { wait: approveWait } = await sendTransaction({
      chainId: originChainId,
      request: approveTxRequest,
      mode: 'recklesslyUnprepared', // See note above function
    });

    updateStatus(TransferStatus.ConfirmingApprove);
    const approveTxReceipt = await approveWait(1);
    logger.debug('Approve transaction confirmed, hash:', approveTxReceipt.transactionHash);
    toastTxSuccess('Approve transaction sent!', approveTxReceipt.transactionHash, originCaip2Id);
  }

  updateStatus(TransferStatus.CreatingTransfer);

  let hypTokenAdapter: IHypTokenAdapter;
  if (routeType === RouteType.BaseToSynthetic) {
    hypTokenAdapter = AdapterFactory.CollateralAdapterFromAddress(
      originCaip2Id,
      originTokenAddress,
    );
  } else {
    hypTokenAdapter = AdapterFactory.HypTokenAdapterFromAddress(originCaip2Id, originTokenAddress);
  }

  const gasPayment = await hypTokenAdapter.quoteGasPayment(destinationDomainId);
  logger.debug('Quoted gas payment', gasPayment);
  // If sending native tokens (e.g. Eth), the gasPayment must be added to the tx value and sent together
  const txValue =
    routeType === RouteType.BaseToSynthetic && isNativeToken(tokenAddress)
      ? BigNumber.from(gasPayment).add(amountOrId)
      : gasPayment;
  const transferTxRequest = (await hypTokenAdapter.prepareTransferRemoteTx({
    amountOrId,
    recipient: recipientAddress,
    destination: destinationDomainId,
    txValue: txValue.toString(),
  })) as PopulatedTransaction;

  updateStatus(TransferStatus.SigningTransfer);
  const { wait: transferWait, hash: transferTxHash } = await sendTransaction({
    chainId: originChainId,
    request: transferTxRequest,
    mode: 'recklesslyUnprepared', // See note above function
  });

  updateStatus(TransferStatus.ConfirmingTransfer);
  const transferReceipt = await transferWait(1);
  const msgId = tryGetMsgIdFromTransferReceipt(transferReceipt);

  return { transferTxHash, msgId };
}

async function triggerSealevelTransfer({
  values,
  tokenRoute,
  activeChain,
  updateStatus,
}: TriggerTransferParams) {
  if ('TODO solana') throw new Error('TODO solana');
  return { transferTxHash: '', msgId: '' };
}

export function isTransferApproveRequired(route: Route, tokenAddress: string) {
  return !isNativeToken(tokenAddress) && route.type === RouteType.BaseToSynthetic;
}

function tryGetMsgIdFromTransferReceipt(receipt: providers.TransactionReceipt) {
  try {
    const messages = HyperlaneCore.getDispatchedMessages(receipt);
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
