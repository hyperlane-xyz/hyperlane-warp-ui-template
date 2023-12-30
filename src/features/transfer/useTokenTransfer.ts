import { MsgTransferEncodeObject } from '@cosmjs/stargate';
import type { Transaction as SolTransaction } from '@solana/web3.js';
import {
  SendTransactionArgs as ViemTransactionRequest,
  WaitForTransactionResult as ViemViemTransactionReceipt,
} from '@wagmi/core';
import BigNumber from 'bignumber.js';
import { PopulatedTransaction as Ethers5Transaction } from 'ethers';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import {
  CosmIbcToWarpTokenAdapter,
  CosmIbcTokenAdapter,
  IHypTokenAdapter,
} from '@hyperlane-xyz/sdk';
import { ProtocolType, toWei } from '@hyperlane-xyz/utils';

import { toastTxSuccess } from '../../components/toast/TxSuccessToast';
import { COSM_IGP_QUOTE } from '../../consts/values';
import { logger } from '../../utils/logger';
import { parseCaip2Id } from '../caip/chains';
import { isNonFungibleToken } from '../caip/tokens';
import { getChainMetadata, getMultiProvider } from '../multiProvider';
import { AppState, useStore } from '../store';
import { AdapterFactory } from '../tokens/AdapterFactory';
import { isApproveRequired } from '../tokens/approval';
import { Route, RoutesMap } from '../tokens/routes/types';
import { getTokenRoute, isIbcOnlyRoute, isIbcRoute, isWarpRoute } from '../tokens/routes/utils';
import {
  getAccountAddressForChain,
  useAccounts,
  useActiveChains,
  useTransactionFns,
} from '../wallet/hooks/multiProtocol';
import { ActiveChainInfo, SendTransactionFn } from '../wallet/hooks/types';
import { ethers5TxToWagmiTx } from '../wallet/utils';

import {
  IgpQuote,
  IgpTokenType,
  TransferContext,
  TransferFormValues,
  TransferStatus,
} from './types';
import { fetchIgpQuote } from './useIgpQuote';
import { ensureSufficientCollateral, tryGetMsgIdFromEvmTransferReceipt } from './utils';

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
    const { originCaip2Id, destinationCaip2Id, tokenCaip19Id, amount, recipientAddress } = values;
    const { protocol: originProtocol } = parseCaip2Id(originCaip2Id);
    const { reference: destReference } = parseCaip2Id(destinationCaip2Id);
    const destinationDomainId = getMultiProvider().getDomainId(destReference);

    const tokenRoute = getTokenRoute(originCaip2Id, destinationCaip2Id, tokenCaip19Id, tokenRoutes);
    if (!tokenRoute) throw new Error('No token route found between chains');

    const isNft = isNonFungibleToken(tokenCaip19Id);
    const weiAmountOrId = isNft ? amount : toWei(amount, tokenRoute.originDecimals);
    const activeAccountAddress = getAccountAddressForChain(
      originCaip2Id,
      activeAccounts.accounts[originProtocol],
    );
    if (!activeAccountAddress) throw new Error('No active account found for origin chain');
    const activeChain = activeChains.chains[originProtocol];

    addTransfer({
      activeAccountAddress,
      timestamp: new Date().getTime(),
      status,
      route: tokenRoute,
      params: values,
    });

    const executeParams: ExecuteTransferParams<any, any> = {
      weiAmountOrId,
      originProtocol,
      destinationDomainId,
      recipientAddress,
      tokenRoute,
      activeAccountAddress,
      activeChain,
      updateStatus: (s: TransferStatus) => {
        status = s;
        updateTransferStatus(transferIndex, s);
      },
      sendTransaction: transactionFns[originProtocol].sendTransaction,
    };

    let transferTxHash: string;
    let msgId: string | undefined;
    if (isWarpRoute(tokenRoute)) {
      ({ transferTxHash, msgId } = await executeHypTransfer(executeParams));
    } else if (isIbcRoute(tokenRoute)) {
      ({ transferTxHash } = await executeIbcTransfer(executeParams));
    } else {
      throw new Error('Unsupported route type');
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

interface ExecuteTransferParams<TxReq, TxResp> {
  weiAmountOrId: string;
  originProtocol: ProtocolType;
  destinationDomainId: DomainId;
  recipientAddress: Address;
  tokenRoute: Route;
  activeAccountAddress: Address;
  activeChain: ActiveChainInfo;
  updateStatus: (s: TransferStatus) => void;
  sendTransaction: SendTransactionFn<TxReq, TxResp>;
}

interface ExecuteHypTransferParams<TxReq, TxResp> extends ExecuteTransferParams<TxReq, TxResp> {
  hypTokenAdapter: IHypTokenAdapter;
  igpQuote: IgpQuote;
}

async function executeHypTransfer(params: ExecuteTransferParams<any, any>) {
  const { tokenRoute, weiAmountOrId, originProtocol } = params;
  const hypTokenAdapter = AdapterFactory.HypTokenAdapterFromRouteOrigin(tokenRoute);

  await ensureSufficientCollateral(tokenRoute, weiAmountOrId);

  const igpQuote = await fetchIgpQuote(tokenRoute, hypTokenAdapter);
  const hypTransferParams: ExecuteHypTransferParams<any, any> = {
    ...params,
    hypTokenAdapter,
    igpQuote,
  };

  let result: { transferTxHash: string; msgId?: string };
  if (originProtocol === ProtocolType.Ethereum) {
    result = await executeEvmTransfer(hypTransferParams);
  } else if (originProtocol === ProtocolType.Sealevel) {
    result = await executeSealevelTransfer(hypTransferParams);
  } else if (originProtocol === ProtocolType.Cosmos) {
    result = await executeCosmWasmTransfer(hypTransferParams);
  } else {
    throw new Error(`Unsupported protocol type: ${originProtocol}`);
  }
  return result;
}

async function executeEvmTransfer({
  weiAmountOrId,
  destinationDomainId,
  recipientAddress,
  tokenRoute,
  hypTokenAdapter,
  igpQuote,
  activeAccountAddress,
  activeChain,
  updateStatus,
  sendTransaction,
}: ExecuteHypTransferParams<ViemTransactionRequest, ViemViemTransactionReceipt>) {
  if (!isWarpRoute(tokenRoute)) throw new Error('Unsupported route type');
  const { baseRouterAddress, originCaip2Id, baseTokenCaip19Id } = tokenRoute;

  const isApproveTxRequired =
    activeAccountAddress &&
    (await isApproveRequired(tokenRoute, baseTokenCaip19Id, weiAmountOrId, activeAccountAddress));

  if (isApproveTxRequired) {
    updateStatus(TransferStatus.CreatingApprove);
    const tokenAdapter = AdapterFactory.TokenAdapterFromAddress(baseTokenCaip19Id);
    const approveTxRequest = (await tokenAdapter.populateApproveTx({
      weiAmountOrId,
      recipient: baseRouterAddress,
    })) as Ethers5Transaction;

    updateStatus(TransferStatus.SigningApprove);
    const { confirm: confirmApprove } = await sendTransaction({
      tx: ethers5TxToWagmiTx(approveTxRequest),
      chainCaip2Id: originCaip2Id,
      activeCap2Id: activeChain.chainCaip2Id,
    });

    updateStatus(TransferStatus.ConfirmingApprove);
    const approveTxReceipt = await confirmApprove();
    logger.debug('Approve transaction confirmed, hash:', approveTxReceipt.transactionHash);
    toastTxSuccess('Approve transaction sent!', approveTxReceipt.transactionHash, originCaip2Id);
  }

  updateStatus(TransferStatus.CreatingTransfer);

  logger.debug('Quoted gas payment', igpQuote.weiAmount);
  // If sending native tokens (e.g. Eth), the gasPayment must be added to the tx value and sent together
  const txValue =
    igpQuote.type === IgpTokenType.NativeCombined
      ? BigNumber(igpQuote.weiAmount).plus(weiAmountOrId).toFixed(0)
      : igpQuote.weiAmount;
  const transferTxRequest = (await hypTokenAdapter.populateTransferRemoteTx({
    weiAmountOrId: weiAmountOrId.toString(),
    recipient: recipientAddress,
    destination: destinationDomainId,
    txValue,
  })) as Ethers5Transaction;

  updateStatus(TransferStatus.SigningTransfer);
  const { hash: transferTxHash, confirm: confirmTransfer } = await sendTransaction({
    tx: ethers5TxToWagmiTx(transferTxRequest),
    chainCaip2Id: originCaip2Id,
    activeCap2Id: activeChain.chainCaip2Id,
  });

  updateStatus(TransferStatus.ConfirmingTransfer);
  const transferReceipt = await confirmTransfer();
  const msgId = tryGetMsgIdFromEvmTransferReceipt(transferReceipt);

  return { transferTxHash, msgId };
}

async function executeSealevelTransfer({
  weiAmountOrId,
  destinationDomainId,
  recipientAddress,
  tokenRoute,
  hypTokenAdapter,
  activeAccountAddress,
  activeChain,
  updateStatus,
  sendTransaction,
}: ExecuteHypTransferParams<SolTransaction, void>) {
  const { originCaip2Id } = tokenRoute;

  updateStatus(TransferStatus.CreatingTransfer);

  // TODO solana enable gas payments?
  // logger.debug('Quoted gas payment', igpQuote.weiAmount);

  const transferTxRequest = (await hypTokenAdapter.populateTransferRemoteTx({
    weiAmountOrId,
    destination: destinationDomainId,
    recipient: recipientAddress,
    fromAccountOwner: activeAccountAddress,
  })) as SolTransaction;

  updateStatus(TransferStatus.SigningTransfer);

  const { hash: transferTxHash, confirm: confirmTransfer } = await sendTransaction({
    tx: transferTxRequest,
    chainCaip2Id: originCaip2Id,
    activeCap2Id: activeChain.chainCaip2Id,
  });

  updateStatus(TransferStatus.ConfirmingTransfer);
  await confirmTransfer();

  return { transferTxHash };
}

async function executeCosmWasmTransfer({
  weiAmountOrId,
  destinationDomainId,
  recipientAddress,
  tokenRoute,
  hypTokenAdapter,
  igpQuote,
  activeChain,
  updateStatus,
  sendTransaction,
}: ExecuteHypTransferParams<any, void>) {
  updateStatus(TransferStatus.CreatingTransfer);

  const transferTxRequest = await hypTokenAdapter.populateTransferRemoteTx({
    weiAmountOrId,
    recipient: recipientAddress,
    destination: destinationDomainId,
    txValue: igpQuote.weiAmount,
  });

  updateStatus(TransferStatus.SigningTransfer);
  const { hash: transferTxHash, confirm: confirmTransfer } = await sendTransaction({
    tx: { type: 'cosmwasm', request: transferTxRequest },
    chainCaip2Id: tokenRoute.originCaip2Id,
    activeCap2Id: activeChain.chainCaip2Id,
  });

  updateStatus(TransferStatus.ConfirmingTransfer);
  await confirmTransfer();

  return { transferTxHash };
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
  }

  const transferTxRequest = (await adapter.populateTransferRemoteTx({
    weiAmountOrId,
    recipient: recipientAddress,
    fromAccountOwner: activeAccountAddress,
    destination: destinationDomainId,
    // TODO have this use fetchIgpQuote?
    // Will be required if/when cosmos uses dynamic IGP fees
    txValue: COSM_IGP_QUOTE,
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
  [TransferStatus.CreatingApprove]: 'Error while creating the approve transaction.',
  [TransferStatus.SigningApprove]: 'Error while signing the approve transaction.',
  [TransferStatus.ConfirmingApprove]: 'Error while confirming the approve transaction.',
  [TransferStatus.CreatingTransfer]: 'Error while creating the transfer transaction.',
  [TransferStatus.SigningTransfer]: 'Error while signing the transfer transaction.',
  [TransferStatus.ConfirmingTransfer]: 'Error while confirming the transfer transaction.',
};
