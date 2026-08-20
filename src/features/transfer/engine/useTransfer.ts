import {
  type ChainMap,
  type CoreAddresses,
  EvmTokenAdapter,
  HyperlaneCore,
  MultiProtocolCore,
  ProviderType,
  type TypedTransactionReceipt,
} from '@hyperlane-xyz/sdk';
import { isZeroishAddress, ProtocolType } from '@hyperlane-xyz/utils';
import { useTransactionFns } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { useCallback, useState } from 'react';
import type { Address } from 'viem';

import { logger } from '../../../utils/logger';
import { refinerIdentifyAndShowTransferForm } from '../../analytics/refiner';
import { EVENT_NAME } from '../../analytics/types';
import { getAnalyticsChains, getAnalyticsToken, trackEvent } from '../../analytics/utils';
import { getRouteTxs } from '../../api/routeTx';
import { useMultiProvider } from '../../chains/hooks';
import { isBridgeOnlyRoute } from '../../routeSecurity/validateWarpRoute';
import { useStore } from '../../store';
import { submitToRelayApi } from '../relayApi';
import { postCommitment } from './ccs';
import { labelTransferMessages, type ParsedTransferMessage } from './messages';
import { prepareRouteTransaction } from './routeTransactions';
import { TransferStatus } from './types';
import type { AugmentedRoute } from './types';

interface ExecuteArgs {
  transactionId: string;
  route: AugmentedRoute;
  srcChainId: number;
  dstChainId: number;
  srcToken: string;
  dstToken: string;
  amount: string;
  srcTokenSymbol: string;
  dstTokenSymbol: string;
  sender: string;
  recipient: string;
  /** Token returned by route.approval. Defaults to srcToken for older quotes. */
  approvalToken?: string;
  /** Spender returned by route.approval. Skips approval flow if absent or `isNative`. */
  spender?: Address;
  /** Amount returned by route.approval. */
  approvalAmount?: bigint;
  /** True when no approval is required. */
  isNative?: boolean;
}

// Single execution path covering EVM + Tron via the SDK's protocol-aware
// transaction adapters.
export function useTransfer() {
  const multiProvider = useMultiProvider();
  const transactionFns = useTransactionFns(multiProvider);
  const chainAddresses = useStore((s) => s.chainAddresses);
  const updateTransferTransactionStatus = useStore((s) => s.updateTransferTransactionStatus);
  const setTransferRoute = useStore((s) => s.setTransferRoute);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(
    async (args: ExecuteArgs) => {
      const { transactionId, route, srcChainId, dstChainId } = args;
      setError(null);
      setIsPending(true);
      let analyticsSrcChainName: string | null | undefined;
      let analyticsDstChainName: string | null | undefined;
      let submittedAnalytics = false;
      const analyticsTransactionType = isBridgeOnlyRoute(route.raw) ? 'bridge' : 'swap';

      try {
        const routeTxs = getRouteTxs(route.raw);
        if (!routeTxs.length) throw new Error('Route has no tx');

        // Store route for status polling and recovery (non-persisted, session only).
        setTransferRoute(transactionId, route.raw);

        analyticsSrcChainName = multiProvider.tryGetChainName(srcChainId);
        analyticsDstChainName = multiProvider.tryGetChainName(dstChainId);
        const protocol = multiProvider.tryGetProtocol(srcChainId);
        if (!analyticsSrcChainName || !analyticsDstChainName || !protocol) {
          throw new Error(
            `No SDK metadata for route ${srcChainId}->${dstChainId} — boot may not have completed.`,
          );
        }
        const srcChainName = analyticsSrcChainName;
        const dstChainName = analyticsDstChainName;

        const fns = transactionFns[protocol as keyof typeof transactionFns];
        if (!fns) throw new Error(`No transaction handler for protocol ${protocol}`);

        const txType =
          protocol === ProtocolType.Sealevel
            ? ProviderType.SolanaWeb3
            : protocol === ProtocolType.Tron
              ? ProviderType.Tron
              : ProviderType.EthersV5;

        if (fns.switchNetwork) {
          try {
            await fns.switchNetwork(srcChainName);
          } catch (err) {
            logger.warn(`switchNetwork to ${srcChainName} failed; continuing`, err as Error);
          }
        }

        // Approve / revoke before the transfer tx: bump non-zero existing
        // allowance to zero first (USDT case), then approve the new amount.
        if (
          protocol !== ProtocolType.Sealevel &&
          args.spender &&
          args.approvalAmount != null &&
          !args.isNative
        ) {
          const spender = args.spender;
          if (isZeroishAddress(spender)) {
            throw new Error(`Cannot approve: spender is zero address on ${srcChainName}`);
          }
          const adapter = new EvmTokenAdapter(srcChainName, multiProvider, {
            token: args.approvalToken ?? args.srcToken,
          });
          const [needsApprove, needsRevoke] = await Promise.all([
            adapter.isApproveRequired(args.sender, spender, args.approvalAmount.toString()),
            adapter.isRevokeApprovalRequired(args.sender, spender),
          ]);
          const doApprove = async (amount: bigint) => {
            updateTransferTransactionStatus(transactionId, TransferStatus.SigningApprove);
            const populated = await adapter.populateApproveTx({
              weiAmountOrId: amount.toString(),
              recipient: spender,
            });
            const { hash, confirm } = await fns.sendTransaction({
              tx: {
                type: txType,
                transaction: { to: populated.to!, data: populated.data!, value: '0' },
                category: 'transfer',
              } as Parameters<typeof fns.sendTransaction>[0]['tx'],
              chainName: srcChainName,
            });
            updateTransferTransactionStatus(transactionId, TransferStatus.ConfirmingApprove);
            const receipt = await confirm();
            if (isReverted(receipt)) {
              logger.error('Approve tx reverted', new Error(`tx=${hash}`));
              throw new Error('Approve transaction reverted on chain');
            }
          };
          if (needsApprove && needsRevoke) await doApprove(0n);
          if (needsApprove) await doApprove(args.approvalAmount);
        }

        // Order is critical: post to CCS BEFORE broadcasting.
        if (route.raw.callCommitment) {
          updateTransferTransactionStatus(transactionId, TransferStatus.CreatingTxs);
          try {
            await postCommitment(route.raw.callCommitment);
          } catch (ccsErr) {
            logger.error('CCS post failed — aborting transfer', ccsErr);
            updateTransferTransactionStatus(transactionId, TransferStatus.Failed);
            const err = new Error(
              'Could not register transfer with the coordination service. Your funds are safe — please try again.',
            );
            setError(err);
            throw err;
          }
        }

        let hash: string | undefined;
        let receipt: TypedTransactionReceipt | undefined;
        for (const routeTx of routeTxs) {
          updateTransferTransactionStatus(transactionId, TransferStatus.SigningTransfer);
          const sent = await fns.sendTransaction({
            tx: (await prepareRouteTransaction(routeTx, {
              protocol: protocol as ProtocolType,
              sender: args.sender,
              chainName: srcChainName,
              multiProvider,
            })) as Parameters<typeof fns.sendTransaction>[0]['tx'],
            chainName: srcChainName,
          });
          hash = sent.hash;

          updateTransferTransactionStatus(transactionId, TransferStatus.ConfirmingOrigin, {
            originTxHash: hash,
          });

          receipt = await sent.confirm();
          if (isReverted(receipt)) {
            logger.error('Origin tx reverted', new Error(`tx=${hash}`));
            updateTransferTransactionStatus(transactionId, TransferStatus.Failed, {
              originTxHash: hash,
            });
            const err = new Error('Origin transaction reverted on chain');
            setError(err);
            throw err;
          }
        }

        if (!hash || !receipt) throw new Error('Route transaction did not return a receipt');
        const parsed = await parseReceipt(multiProvider, chainAddresses, srcChainName, receipt);
        const hasCrossChainStep = route.raw.steps.some((s) => s.type === 'bridge');
        const canReadDispatchLogs = isEvmReceipt(receipt);
        if (hasCrossChainStep && canReadDispatchLogs && !parsed.messages.length) {
          logger.error('Origin tx confirmed but no Dispatch log emitted', new Error(`tx=${hash}`));
          updateTransferTransactionStatus(transactionId, TransferStatus.Failed, {
            originTxHash: hash,
            originBlockNumber: parsed.originBlockNumber,
          });
          const err = new Error(
            'Origin transaction did not emit a Hyperlane Dispatch — it likely reverted internally',
          );
          setError(err);
          throw err;
        }

        trackEvent(EVENT_NAME.TRANSACTION_SUBMITTED, {
          amount: args.amount,
          chains: getAnalyticsChains(
            { chainName: srcChainName, chainId: srcChainId },
            { chainName: dstChainName, chainId: dstChainId },
            analyticsTransactionType,
          ),
          originToken: getAnalyticsToken({ address: args.srcToken, symbol: args.srcTokenSymbol }),
          destinationToken: getAnalyticsToken({
            address: args.dstToken,
            symbol: args.dstTokenSymbol,
          }),
          walletAddress: args.sender,
          transactionHash: hash,
          recipient: args.recipient,
        });
        refinerIdentifyAndShowTransferForm({
          walletAddress: args.sender,
          protocol: multiProvider.tryGetProtocol(srcChainName) ?? '',
          chain: srcChainName,
        });
        submittedAnalytics = true;

        // Same-chain transfer: finalize on origin confirm.
        if (!hasCrossChainStep) {
          updateTransferTransactionStatus(transactionId, TransferStatus.ConfirmedDestination, {
            originTxHash: hash,
            destinationTxHash: hash,
            originBlockNumber: parsed.originBlockNumber,
          });
          return hash;
        }
        submitToRelayApi(srcChainName, hash, protocol as ProtocolType, receipt);

        updateTransferTransactionStatus(transactionId, TransferStatus.Bridging, {
          msgIds: labelTransferMessages(parsed.messages, route.raw),
          originBlockNumber: parsed.originBlockNumber,
          originTxTimestamp: Math.floor(Date.now() / 1000),
        });

        return hash;
      } catch (err) {
        logger.error('Transfer broadcast failed', err);
        if (!submittedAnalytics) {
          trackEvent(EVENT_NAME.TRANSACTION_SUBMISSION_FAILED, {
            amount: args.amount,
            chains: getAnalyticsChains(
              { chainName: analyticsSrcChainName ?? 'unknown', chainId: srcChainId },
              { chainName: analyticsDstChainName ?? 'unknown', chainId: dstChainId },
            ),
            originToken: getAnalyticsToken({
              address: args.srcToken,
              symbol: args.srcTokenSymbol,
            }),
            destinationToken: getAnalyticsToken({
              address: args.dstToken,
              symbol: args.dstTokenSymbol,
            }),
            walletAddress: args.sender,
            recipient: args.recipient,
            error: err instanceof Error ? err.message : 'Transfer broadcast failed',
          });
        }
        updateTransferTransactionStatus(transactionId, TransferStatus.Failed);
        setError(err as Error);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [
      transactionFns,
      multiProvider,
      chainAddresses,
      updateTransferTransactionStatus,
      setTransferRoute,
    ],
  );

  return { execute, isPending, error };
}

function isReverted(receipt: TypedTransactionReceipt): boolean {
  // Tron receipts wrap an ethers v5 receipt (same `status` shape) — treat
  // them identically to EVM for the revert check.
  if (
    receipt.type !== ProviderType.Viem &&
    receipt.type !== ProviderType.EthersV5 &&
    receipt.type !== ProviderType.Tron
  ) {
    return false;
  }
  const status = (receipt.receipt as { status?: string | number }).status;
  if (typeof status === 'string') return status === 'reverted';
  if (typeof status === 'number') return status === 0;
  return false;
}

function isEvmReceipt(receipt: TypedTransactionReceipt): boolean {
  return (
    receipt.type === ProviderType.Viem ||
    receipt.type === ProviderType.EthersV5 ||
    receipt.type === ProviderType.Tron
  );
}

async function parseReceipt(
  multiProvider: ReturnType<typeof useMultiProvider>,
  chainAddresses: ChainMap<Partial<CoreAddresses>>,
  origin: string,
  receipt: TypedTransactionReceipt,
): Promise<{
  messages: ParsedTransferMessage[];
  originBlockNumber: number | undefined;
}> {
  // Tron is EVM-like — emits Hyperlane Dispatch logs in the same shape.
  if (
    receipt.type === ProviderType.Viem ||
    receipt.type === ProviderType.EthersV5 ||
    receipt.type === ProviderType.Tron
  ) {
    const rawReceipt = receipt.receipt as Parameters<
      typeof HyperlaneCore.getDispatchedMessages
    >[0] & {
      blockNumber?: bigint | number;
    };
    const dispatched = HyperlaneCore.getDispatchedMessages(rawReceipt);
    const messages = dispatched.map((m) => ({
      msgId: m.id,
      sender: m.parsed.sender,
      body: m.parsed.body,
    }));
    return {
      messages,
      originBlockNumber: maybeNumber(rawReceipt.blockNumber),
    };
  }

  try {
    const core = new MultiProtocolCore(
      multiProvider,
      buildCoreAddresses(multiProvider, chainAddresses),
    );
    const messages = await core.extractMessageIds(origin, receipt);
    return {
      messages: messages.map((m) => ({ msgId: m.messageId })),
      originBlockNumber: getReceiptBlockNumber(receipt),
    };
  } catch (err) {
    logger.warn('Could not extract Hyperlane message IDs from origin receipt', err as Error);
    return {
      messages: [],
      originBlockNumber: getReceiptBlockNumber(receipt),
    };
  }
}

function buildCoreAddresses(
  multiProvider: ReturnType<typeof useMultiProvider>,
  chainAddresses: ChainMap<Partial<CoreAddresses>>,
): ChainMap<CoreAddresses> {
  return multiProvider.getKnownChainNames().reduce<ChainMap<CoreAddresses>>((acc, chainName) => {
    acc[chainName] = {
      validatorAnnounce: chainAddresses[chainName]?.validatorAnnounce ?? '',
      proxyAdmin: chainAddresses[chainName]?.proxyAdmin ?? '',
      mailbox: chainAddresses[chainName]?.mailbox ?? '',
      quotedCalls: chainAddresses[chainName]?.quotedCalls ?? '',
    };
    return acc;
  }, {});
}

function getReceiptBlockNumber(receipt: TypedTransactionReceipt): number | undefined {
  const raw = receipt.receipt as {
    blockNumber?: bigint | number;
    block_number?: bigint | number;
    height?: bigint | number;
  };
  return maybeNumber(raw.blockNumber ?? raw.block_number ?? raw.height);
}

function maybeNumber(value: bigint | number | undefined): number | undefined {
  if (value == null) return undefined;
  return Number(value);
}
