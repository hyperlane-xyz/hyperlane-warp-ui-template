import type { Transaction as SolTransaction } from '@solana/web3.js';
import { BigNumber, PopulatedTransaction as EvmTransaction, providers } from 'ethers';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import { HyperlaneCore } from '@hyperlane-xyz/sdk';

import { toastTxSuccess } from '../../components/toast/TxSuccessToast';
import { toWei } from '../../utils/amount';
import { logger } from '../../utils/logger';
import { getProtocolType, parseCaip2Id } from '../chains/caip2';
import { ProtocolType } from '../chains/types';
import { getMultiProvider } from '../multiProvider';
import { AppState, useStore } from '../store';
import { AdapterFactory } from '../tokens/adapters/AdapterFactory';
import { IHypTokenAdapter } from '../tokens/adapters/ITokenAdapter';
import { isNativeToken } from '../tokens/native';
import { Route, RouteType, RoutesMap, getTokenRoute } from '../tokens/routes';
import {
  AccountInfo,
  ActiveChainInfo,
  SendTransactionFn,
  useAccounts,
  useActiveChains,
  useTransactionFns,
} from '../wallet/hooks';

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
    (values: TransferFormValues, tokenRoutes: RoutesMap) =>
      executeTransfer({
        values,
        tokenRoutes,
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
  tokenRoutes,
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
  tokenRoutes: RoutesMap;
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
  let status: TransferStatus = TransferStatus.Preparing;

  try {
    const { originCaip2Id, destinationCaip2Id, tokenAddress, amount, recipientAddress } = values;
    const { protocol: originProtocol, reference: originReference } = parseCaip2Id(originCaip2Id);
    const { reference: destReference } = parseCaip2Id(destinationCaip2Id);

    const multiProvider = getMultiProvider();
    const destinationDomainId = multiProvider.getDomainId(destReference);
    const originMetadata = multiProvider.getChainMetadata(originReference);
    const originMailbox = originMetadata.mailbox;

    const tokenRoute = getTokenRoute(originCaip2Id, destinationCaip2Id, tokenAddress, tokenRoutes);
    if (!tokenRoute) throw new Error('No token route found between chains');

    const amountOrId = tokenRoute.isNft ? amount : toWei(amount, tokenRoute.decimals).toString();

    addTransfer({
      status,
      route: tokenRoute,
      params: values,
    });

    const { type: routeType, originRouterAddress, baseTokenAddress } = tokenRoute;
    let hypTokenAdapter: IHypTokenAdapter;
    // TODO may need to pass in isSpl2022 here for Sealevel
    if (routeType === RouteType.BaseToSynthetic) {
      hypTokenAdapter = AdapterFactory.HypCollateralAdapterFromAddress(
        originCaip2Id,
        originRouterAddress,
        baseTokenAddress,
      );
    } else {
      hypTokenAdapter = AdapterFactory.HypSyntheticAdapterFromAddress(
        originCaip2Id,
        originRouterAddress,
        baseTokenAddress,
      );
    }

    const triggerParams: ExecuteTransferParams<any> = {
      amountOrId,
      destinationDomainId,
      recipientAddress,
      tokenRoute,
      hypTokenAdapter,
      activeAccount: activeAccounts.accounts[originProtocol],
      activeChain: activeChains.chains[originProtocol],
      updateStatus: (s: TransferStatus) => {
        status = s;
        updateTransferStatus(transferIndex, s);
      },
      sendTransaction: transactionFns[originProtocol].sendTransaction,
      originMailbox,
    };
    let transferTxHash: string;
    let msgId: string | undefined;
    if (originProtocol === ProtocolType.Ethereum) {
      const result = await executeEvmTransfer(triggerParams);
      ({ transferTxHash, msgId } = result);
    } else if (originProtocol === ProtocolType.Sealevel) {
      const result = await executeSealevelTransfer(triggerParams);
      ({ transferTxHash } = result);
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
}

interface ExecuteTransferParams<TxResp> {
  amountOrId: string;
  destinationDomainId: DomainId;
  recipientAddress: Address;
  tokenRoute: Route;
  hypTokenAdapter: IHypTokenAdapter;
  activeAccount: AccountInfo;
  activeChain: ActiveChainInfo;
  updateStatus: (s: TransferStatus) => void;
  sendTransaction: SendTransactionFn<TxResp>;
  originMailbox?: Address;
}

async function executeEvmTransfer({
  amountOrId,
  destinationDomainId,
  recipientAddress,
  tokenRoute,
  hypTokenAdapter,
  activeChain,
  updateStatus,
  sendTransaction,
}: ExecuteTransferParams<providers.TransactionReceipt>) {
  const { type: routeType, baseRouterAddress, originCaip2Id, baseTokenAddress } = tokenRoute;

  if (isTransferApproveRequired(tokenRoute, baseTokenAddress)) {
    updateStatus(TransferStatus.CreatingApprove);
    const tokenAdapter = AdapterFactory.TokenAdapterFromAddress(originCaip2Id, baseTokenAddress);
    const approveTxRequest = (await tokenAdapter.prepareApproveTx({
      amountOrId,
      recipient: baseRouterAddress,
    })) as EvmTransaction;

    updateStatus(TransferStatus.SigningApprove);
    const { confirm: confirmApprove } = await sendTransaction({
      tx: approveTxRequest,
      caip2Id: originCaip2Id,
      activeCap2Id: activeChain.caip2Id,
    });

    updateStatus(TransferStatus.ConfirmingApprove);
    const approveTxReceipt = await confirmApprove();
    logger.debug('Approve transaction confirmed, hash:', approveTxReceipt.transactionHash);
    toastTxSuccess('Approve transaction sent!', approveTxReceipt.transactionHash, originCaip2Id);
  }

  updateStatus(TransferStatus.CreatingTransfer);

  const gasPayment = await hypTokenAdapter.quoteGasPayment(destinationDomainId);
  logger.debug('Quoted gas payment', gasPayment);
  // If sending native tokens (e.g. Eth), the gasPayment must be added to the tx value and sent together
  const txValue =
    routeType === RouteType.BaseToSynthetic && isNativeToken(baseTokenAddress)
      ? BigNumber.from(gasPayment).add(amountOrId)
      : gasPayment;
  const transferTxRequest = (await hypTokenAdapter.prepareTransferRemoteTx({
    amountOrId,
    recipient: recipientAddress,
    destination: destinationDomainId,
    txValue: txValue.toString(),
  })) as EvmTransaction;

  updateStatus(TransferStatus.SigningTransfer);
  const { hash: transferTxHash, confirm: confirmTransfer } = await sendTransaction({
    tx: transferTxRequest,
    caip2Id: originCaip2Id,
    activeCap2Id: activeChain.caip2Id,
  });

  updateStatus(TransferStatus.ConfirmingTransfer);
  const transferReceipt = await confirmTransfer();
  const msgId = tryGetMsgIdFromEvmTransferReceipt(transferReceipt);

  return { transferTxHash, msgId };
}

async function executeSealevelTransfer({
  amountOrId,
  destinationDomainId,
  recipientAddress,
  tokenRoute,
  hypTokenAdapter,
  activeAccount,
  activeChain,
  updateStatus,
  sendTransaction,
  originMailbox,
}: ExecuteTransferParams<void>) {
  const { originCaip2Id } = tokenRoute;

  updateStatus(TransferStatus.CreatingTransfer);

  // TODO solana enable gas payments?
  // const gasPayment = await hypTokenAdapter.quoteGasPayment(destinationDomainId);
  // logger.debug('Quoted gas payment', gasPayment);

  const transferTxRequest = (await hypTokenAdapter.prepareTransferRemoteTx({
    amountOrId,
    destination: destinationDomainId,
    recipient: recipientAddress,
    fromAccountOwner: activeAccount.address,
    mailbox: originMailbox,
  })) as SolTransaction;

  updateStatus(TransferStatus.SigningTransfer);

  const { hash: transferTxHash, confirm: confirmTransfer } = await sendTransaction({
    tx: transferTxRequest,
    caip2Id: originCaip2Id,
    activeCap2Id: activeChain.caip2Id,
  });

  updateStatus(TransferStatus.ConfirmingTransfer);
  await confirmTransfer();

  return { transferTxHash };
}

export function isTransferApproveRequired(route: Route, tokenAddress: string) {
  return (
    !isNativeToken(tokenAddress) &&
    route.type === RouteType.BaseToSynthetic &&
    getProtocolType(route.originCaip2Id) === ProtocolType.Ethereum
  );
}

function tryGetMsgIdFromEvmTransferReceipt(receipt: providers.TransactionReceipt) {
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
