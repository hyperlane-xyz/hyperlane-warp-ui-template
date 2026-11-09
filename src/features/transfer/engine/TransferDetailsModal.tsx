import { DialogTitle } from '@headlessui/react';
import { CopyButton, Modal, SpinnerIcon } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useCallback, useMemo, useRef, useState } from 'react';

import LinkIcon from '../../../images/icons/external-link-icon.svg';
import { formatTimestamp } from '../../../utils/date';
import { getHypExplorerLink } from '../../../utils/links';
import { useMultiProvider } from '../../chains/hooks';
import { getChainDisplayName } from '../../chains/utils';
import { estimateDeliverySeconds, formatEstimatedTime } from '../../messages/progress';
import { TransferProgress, type TransferDeliveryStatus } from '../../messages/TransferProgress';
import { getTransferDeliveryMsgId, getTransferOverviewMsgId } from '../../messages/utils';
import { TransactionHistoryItemType, useStore } from '../../store';
import { getTokenByKeyFromMap, useTokenByKeyMap } from '../../tokens/hooks';
import { tokenKey } from '../../tokens/utils';
import { normalizeLabeledTransferMessages } from './messages';
import { getSwapStages, TransferRouteProgress } from './TransferRouteProgress';
import { FinalTransferStatuses, TransferStatus, type TransferHistoryItem } from './types';

const LABEL_NAMES: Record<string, string> = {
  warp: 'Bridge Message ID',
  bridge: 'Bridge Message ID',
  commit: 'Commit Message ID',
  reveal: 'Reveal Message ID',
};

const STATUS_HEADLINE: Record<TransferStatus, string> = {
  [TransferStatus.Preparing]: 'Preparing transfer',
  [TransferStatus.CreatingTxs]: 'Preparing transfer',
  [TransferStatus.SigningApprove]: 'Approve in your wallet',
  [TransferStatus.ConfirmingApprove]: 'Confirming token approval',
  [TransferStatus.SigningTransfer]: 'Confirm transfer in your wallet',
  [TransferStatus.ConfirmingOrigin]: 'Confirming origin transaction',
  [TransferStatus.Bridging]: 'Transfer in progress',
  [TransferStatus.ConfirmingDestination]: 'Checking your funds',
  [TransferStatus.ConfirmedDestination]: 'Checking delivery',
  [TransferStatus.DestTransferFailed]: 'Destination execution failed',
  [TransferStatus.FailedRecovered]: 'Funds recovered',
  [TransferStatus.DestFailed]: 'Funds need recovery',
  [TransferStatus.Failed]: 'Transfer failed',
};

const FAILURE_OUTCOME: Partial<Record<TransferStatus, string>> = {
  [TransferStatus.DestTransferFailed]:
    'Origin succeeded and delivery completed, but destination execution reverted. Funds may remain in your ICA. Please contact support.',
  [TransferStatus.FailedRecovered]:
    'Destination execution reverted and the intermediate token was automatically returned to your wallet on the destination chain.',
  [TransferStatus.DestFailed]:
    'The destination execution ran but both the transfer and fallback failed. The intermediate token remains in your ICA. Please contact support.',
  [TransferStatus.Failed]: 'Transfer failed. Check the transaction details before trying again.',
};

export function TransferDetailsModal() {
  const selectedTransactionId = useStore((s) => s.selectedTransactionId);
  const transactionHistory = useStore((s) => s.transactionHistory);
  const setSelectedTransactionId = useStore((s) => s.setSelectedTransactionId);
  const preparingTransfer = useStore((s) => s.preparingTransfer);
  const setPreparingTransfer = useStore((s) => s.setPreparingTransfer);
  const close = () => {
    setSelectedTransactionId(null);
    setPreparingTransfer(null);
  };

  const isOpen = selectedTransactionId != null || preparingTransfer != null;

  const liveRouteSteps = useStore((s) =>
    !preparingTransfer && selectedTransactionId
      ? s.transferRouteByTransactionId.get(selectedTransactionId)?.steps
      : undefined,
  );
  const item =
    selectedTransactionId != null
      ? transactionHistory.find((entry) => entry.id === selectedTransactionId)
      : undefined;
  const liveTransfer =
    preparingTransfer ??
    (item?.type === TransactionHistoryItemType.Transfer ? item.data : undefined);
  // Preserve the actual visible transfer, including preparation, during exit.
  const lastTransferRef = useRef<TransferHistoryItem | undefined>(undefined);
  if (liveTransfer) {
    lastTransferRef.current = {
      ...liveTransfer,
      routeSteps: liveTransfer.routeSteps ?? liveRouteSteps,
      msgIds: normalizeLabeledTransferMessages(liveTransfer.msgIds),
    };
  }
  const transfer = lastTransferRef.current;

  if (!transfer) return <Modal isOpen={false} close={close} />;
  return (
    <TransferDetailsModalInner
      key={transfer.timestamp}
      isOpen={isOpen}
      close={close}
      transfer={transfer}
    />
  );
}

function TransferDetailsModalInner({
  isOpen,
  close,
  transfer,
}: {
  isOpen: boolean;
  close: () => void;
  transfer: TransferHistoryItem;
}) {
  const multiProvider = useMultiProvider();
  const tokenMap = useTokenByKeyMap();
  const [messageStatuses, setMessageStatuses] = useState<Record<string, TransferDeliveryStatus>>(
    {},
  );
  const onDeliveryChange = useCallback((message: TransferDeliveryStatus) => {
    setMessageStatuses((previous) => ({ ...previous, [message.messageId]: message }));
  }, []);
  const {
    status,
    srcChain,
    dstChain,
    srcToken: srcTokenAddr,
    dstToken: dstTokenAddr,
    sender,
    recipient,
    originTxHash,
    destinationTxHash,
    msgIds,
    timestamp,
  } = transfer;

  const originChain = multiProvider.tryGetChainName(srcChain) ?? `chain ${srcChain}`;
  const destChain = multiProvider.tryGetChainName(dstChain) ?? `chain ${dstChain}`;

  const srcToken = getTokenByKeyFromMap(tokenMap, tokenKey(srcChain, srcTokenAddr));
  const dstToken = getTokenByKeyFromMap(tokenMap, tokenKey(dstChain, dstTokenAddr));
  const hasDetailedRoute = !!getSwapStages(transfer.routeSteps ?? [], srcChain, dstChain);
  const isApproving =
    status === TransferStatus.SigningApprove || status === TransferStatus.ConfirmingApprove;

  const isDelivered = status === TransferStatus.ConfirmedDestination;
  const isFinal = FinalTransferStatuses.includes(status);
  const showApprovalFlow =
    isApproving || (!!transfer.approvalRequired && !originTxHash && !isFinal);
  const approvalComplete =
    status === TransferStatus.CreatingTxs || status === TransferStatus.SigningTransfer;

  // Execution evidence validates the outcome; the overview highlights value delivery.
  const deliveryMsgId = getTransferDeliveryMsgId(msgIds);
  const deliveryStatus = deliveryMsgId ? messageStatuses[deliveryMsgId] : undefined;
  const overviewMsgId = getTransferOverviewMsgId(transfer);
  const overviewStatus = overviewMsgId ? messageStatuses[overviewMsgId] : undefined;
  const bridgeMsgId = msgIds?.find(
    (message) => message.label === 'bridge' || message.label === 'warp',
  )?.msgId;
  const bridgeDelivered = bridgeMsgId ? messageStatuses[bridgeMsgId]?.delivered : undefined;

  const showTimeline = !!originTxHash && !!overviewMsgId;
  const awaitingMessages = !!originTxHash && srcChain !== dstChain && !overviewMsgId && !isFinal;

  const fundsAvailable = showTimeline
    ? !!overviewStatus?.delivered &&
      !!deliveryStatus?.delivered &&
      (deliveryStatus.fundsAvailable || isDelivered)
    : isDelivered;
  const failureOutcome = FAILURE_OUTCOME[status];
  const outcomeIsSuccess = fundsAvailable && !failureOutcome;
  const outcome =
    failureOutcome ??
    (fundsAvailable
      ? `Funds are available to use on ${getChainDisplayName(multiProvider, destChain, true)}.`
      : undefined);

  const needsWallet =
    status === TransferStatus.SigningApprove || status === TransferStatus.SigningTransfer;
  const headline = outcomeIsSuccess
    ? 'Transfer complete'
    : outcome
      ? STATUS_HEADLINE[status]
      : showApprovalFlow && status === TransferStatus.Preparing
        ? 'Checking token permission'
        : showTimeline && overviewStatus
          ? overviewStatus.delivered
            ? 'Checking your funds'
            : 'Transfer in progress'
          : STATUS_HEADLINE[status];
  const description = outcomeIsSuccess
    ? 'Your transfer has been delivered.'
    : outcome
      ? 'See the outcome below for details.'
      : showApprovalFlow && status === TransferStatus.Preparing
        ? 'Checking token permissions before opening your wallet.'
        : status === TransferStatus.SigningApprove
          ? 'Review the token permission in your wallet. You’ll confirm the transfer separately afterward.'
          : status === TransferStatus.ConfirmingApprove
            ? 'Waiting for the token permission to confirm on chain. Your transfer has not started yet.'
            : status === TransferStatus.SigningTransfer
              ? 'Token permissions are ready. Confirm this transaction to start your transfer.'
              : status === TransferStatus.Preparing || status === TransferStatus.CreatingTxs
                ? 'Checking the route and preparing your transaction.'
                : 'No action needed. We’ll update this as the transaction progresses.';

  const date = useMemo(
    () => (timestamp ? formatTimestamp(timestamp) : formatTimestamp(Date.now())),
    [timestamp],
  );

  const { data: addressUrls } = useQuery({
    queryKey: ['transferAddressLinks', originChain, destChain, sender, recipient],
    queryFn: () =>
      Promise.all([
        multiProvider.tryGetExplorerAddressUrl(originChain, sender),
        multiProvider.tryGetExplorerAddressUrl(destChain, recipient),
      ]),
    enabled: isOpen && isFinal && !showTimeline,
    staleTime: 60_000,
  });
  const originTxUrl = originTxHash
    ? multiProvider.tryGetExplorerTxUrl(originChain, { hash: originTxHash })
    : undefined;
  // Live evidence owns this link; persisted hashes can be stale after a rollback.
  const destinationHash = showTimeline ? overviewStatus?.destinationTxHash : destinationTxHash;
  const destinationChain = overviewStatus?.destinationChain ?? destChain;
  const destTxUrl = destinationHash
    ? multiProvider.tryGetExplorerTxUrl(destinationChain, { hash: destinationHash })
    : undefined;
  const messageExplorerUrl =
    overviewStatus?.explorerUrl ??
    (overviewMsgId ? getHypExplorerLink(multiProvider, originChain, overviewMsgId) : undefined);
  const estimatedSeconds = estimateDeliverySeconds(
    multiProvider.tryGetChainMetadata(srcChain)?.blocks,
  );

  return (
    <Modal
      isOpen={isOpen}
      close={close}
      dialogProps={{ unmount: false, onClose: close }}
      panelClassname={`transfer-details-modal ${hasDetailedRoute ? 'max-w-xl' : 'max-w-lg'}`}
    >
      <div className="h-1 bg-accent-gradient" />
      <div data-testid="transfer-details" data-status={status} className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 text-xxs text-foreground-muted">
          <span>Transfer details</span>
          <span>{date}</span>
        </div>
        {showApprovalFlow ? (
          <ol
            aria-label="Before sending"
            className="mt-6 flex items-center justify-center gap-4 text-xs"
          >
            <li
              aria-current={!approvalComplete ? 'step' : undefined}
              className="flex items-center gap-2"
            >
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 items-center justify-center rounded-full ${approvalComplete ? 'bg-green-50/10 text-green-600 dark:text-green-50' : 'bg-primary-500/10 text-primary-500'}`}
              >
                {approvalComplete ? (
                  '✓'
                ) : status === TransferStatus.Preparing ||
                  status === TransferStatus.ConfirmingApprove ? (
                  <SpinnerIcon
                    width={14}
                    height={14}
                    color="currentColor"
                    className="message-status-spinner"
                  />
                ) : (
                  '1'
                )}
              </span>
              <span>Token permission</span>
            </li>
            <li
              aria-current={approvalComplete ? 'step' : undefined}
              className={`flex items-center gap-2 ${approvalComplete ? 'text-foreground-primary' : 'text-foreground-muted'}`}
            >
              <span aria-hidden="true" className="mr-2">
                →
              </span>
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 items-center justify-center rounded-full ${approvalComplete ? 'bg-primary-500/10 text-primary-500' : 'border border-gray-400/25'}`}
              >
                {status === TransferStatus.CreatingTxs ? (
                  <SpinnerIcon
                    width={14}
                    height={14}
                    color="currentColor"
                    className="message-status-spinner"
                  />
                ) : (
                  '2'
                )}
              </span>
              <span>Send transfer</span>
            </li>
          </ol>
        ) : (
          <TransferRouteProgress
            transfer={transfer}
            srcToken={srcToken}
            dstToken={dstToken}
            bridgeDelivered={bridgeDelivered}
            executionDelivered={deliveryStatus?.delivered}
            fundsAvailable={!!fundsAvailable}
          />
        )}
        <div
          className={
            showTimeline
              ? 'mt-3 border-t border-gray-400/25 pt-3'
              : 'mt-3 min-h-[76px] border-t border-gray-400/25 pt-4'
          }
          aria-live="polite"
          aria-atomic="true"
        >
          <DialogTitle
            as="h2"
            data-testid="transfer-headline"
            className={`text-base font-medium transition-colors duration-200 motion-reduce:transition-none ${outcomeIsSuccess ? 'text-green-600 dark:text-green-50' : 'text-foreground-primary'}`}
          >
            {headline}
          </DialogTitle>
          {!showTimeline && (
            <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{description}</p>
          )}
          {!isFinal &&
            !fundsAvailable &&
            !overviewStatus?.delivered &&
            estimatedSeconds != null && (
              <p
                data-testid="transfer-estimate"
                className="mt-1 text-xs text-foreground-muted"
                title="Based on configured chain timings. Actual times can vary."
              >
                Estimated delivery {formatEstimatedTime(estimatedSeconds)}
              </p>
            )}
        </div>

        {destinationHash && (
          <div
            data-testid="destination-transaction"
            className="mt-3 rounded-md border border-green-300/70 bg-green-50/10 p-3 text-green-800 dark:border-green-400 dark:bg-green-900/60 dark:text-green-100"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
              <p className="flex items-center gap-2 font-medium">
                {(overviewStatus?.delivered || isDelivered) && <span aria-hidden="true">✓</span>}
                Delivery transaction
              </p>
              {outcomeIsSuccess && <span>Successful delivery</span>}
            </div>
            <div className="mt-2 flex items-center gap-2">
              {destTxUrl ? (
                <a
                  href={destTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View delivery transaction on block explorer"
                  title={destinationHash}
                  className="inline-flex min-w-0 items-center gap-1 text-xs font-medium underline decoration-green-300 underline-offset-4 dark:decoration-green-400"
                >
                  <span className="break-all text-green-800 dark:text-green-100">
                    {getChainDisplayName(multiProvider, destinationChain, true)}:{' '}
                    {destinationHash.slice(0, 10)}…{destinationHash.slice(-8)}
                  </span>
                  <Image src={LinkIcon} width={13} height={13} alt="" />
                </a>
              ) : (
                <p className="font-mono min-w-0 break-all text-xxs">{destinationHash}</p>
              )}
              <CopyButton
                copyValue={destinationHash}
                width={14}
                height={14}
                aria-label="Copy delivery transaction hash"
                className="shrink-0 text-foreground-muted [&_path]:fill-current [&_rect]:stroke-current"
              />
            </div>
          </div>
        )}

        {(showTimeline || awaitingMessages) && (
          <TransferProgress
            transfer={transfer}
            enabled={isOpen}
            onDeliveryChange={onDeliveryChange}
          />
        )}

        {isFinal && !showTimeline && (
          <div className="mt-5 flex flex-col space-y-4">
            <TransferProperty name="Sender Address" value={sender} url={addressUrls?.[0]} />
            <TransferProperty name="Recipient Address" value={recipient} url={addressUrls?.[1]} />
            {originTxHash && (
              <TransferProperty
                name="Origin Transaction Hash"
                value={originTxHash}
                url={originTxUrl}
              />
            )}
            {msgIds?.map(({ msgId: id, label }) => (
              <TransferProperty
                key={id}
                name={LABEL_NAMES[label] ?? 'Message ID'}
                value={id}
                url={getHypExplorerLink(multiProvider, originChain, id) ?? undefined}
              />
            ))}
          </div>
        )}
        {outcome && !outcomeIsSuccess && (
          <div
            data-testid="transfer-outcome"
            role="alert"
            className={`mt-4 rounded-lg border p-3 text-xs leading-relaxed ${
              status === TransferStatus.FailedRecovered
                ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200'
                : 'border-red-300 bg-red-100/20 text-red-600 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200'
            }`}
          >
            {outcome}
          </div>
        )}
        <div
          data-testid="transfer-footer"
          className="mt-3 flex min-h-[52px] items-center justify-between gap-4 border-t border-gray-400/25 pt-3"
        >
          <div className="flex min-w-0 flex-col gap-2">
            {outcomeIsSuccess ? (
              <output
                data-testid="transfer-outcome"
                className={
                  messageExplorerUrl ? 'sr-only' : 'text-xxs text-green-600 dark:text-green-50'
                }
              >
                {outcome}
              </output>
            ) : (
              <span className="text-xxs text-foreground-muted">
                {originTxHash && !isFinal && !fundsAvailable
                  ? 'You can close this. Your transfer will continue.'
                  : needsWallet
                    ? 'Your wallet needs your confirmation.'
                    : ''}
              </span>
            )}
            {messageExplorerUrl && (
              <a
                href={messageExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xxs underline underline-offset-2"
              >
                Track on Hyperlane Explorer <Image src={LinkIcon} width={12} height={12} alt="" />
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-lg border border-gray-400/25 px-4 py-2 text-xs font-medium transition-colors hover:bg-primary-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 motion-reduce:transition-none"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TransferProperty({
  name,
  value,
  url,
}: {
  name: string;
  value: string;
  url?: string | null;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs leading-normal tracking-wider text-foreground-muted">
          {name}
        </label>
        <div className="flex items-center space-x-2">
          {url && (
            <a href={fixDoubleSlash(url)} target="_blank" rel="noopener noreferrer">
              <Image src={LinkIcon} width={14} height={14} alt="" />
            </a>
          )}
          <CopyButton
            copyValue={value}
            width={14}
            height={14}
            className="text-foreground-muted [&_path]:fill-current [&_rect]:stroke-current"
          />
        </div>
      </div>
      <div className="mt-1 truncate text-xs leading-normal tracking-wider text-gray-900 dark:text-foreground-primary">
        {value}
      </div>
    </div>
  );
}

function fixDoubleSlash(url: string) {
  return url.replace(/([^:]\/)\/+/g, '$1');
}
