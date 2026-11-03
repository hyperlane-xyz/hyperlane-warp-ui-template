import { DialogTitle } from '@headlessui/react';
import { CopyButton, Modal, SpinnerIcon } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import LinkIcon from '../../../images/icons/external-link-icon.svg';
import { formatTimestamp } from '../../../utils/date';
import { getHypExplorerLink } from '../../../utils/links';
import { logger } from '../../../utils/logger';
import type { QuoteStep } from '../../api/types';
import { useMultiProvider } from '../../chains/hooks';
import { getChainDisplayName } from '../../chains/utils';
import { TransferProgress, type TransferDeliveryStatus } from '../../messages/TransferProgress';
import { getTransferDeliveryMsgId } from '../../messages/utils';
import { TransactionHistoryItemType, useStore } from '../../store';
import { getTokenByKeyFromMap, useTokenByKeyMap } from '../../tokens/hooks';
import { tokenKey } from '../../tokens/utils';
import { getSwapStages, HyperswapProgress } from './HyperswapProgress';
import { normalizeLabeledTransferMessages } from './messages';
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
  [TransferStatus.Bridging]: 'Waiting for message delivery',
  [TransferStatus.ConfirmingDestination]: 'Checking destination execution',
  [TransferStatus.ConfirmedDestination]: 'Checking delivery',
  [TransferStatus.DestTransferFailed]: 'Destination execution failed',
  [TransferStatus.FailedRecovered]: 'Funds recovered',
  [TransferStatus.DestFailed]: 'Funds need recovery',
  [TransferStatus.Failed]: 'Transfer failed',
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

  // Keep the last transfer mounted during the closing transition.
  const lastIdRef = useRef<string | null>(null);
  if (selectedTransactionId != null) lastIdRef.current = selectedTransactionId;

  const renderedId = lastIdRef.current;
  const liveRouteSteps = useStore((s) =>
    renderedId ? s.transferRouteByTransactionId.get(renderedId)?.steps : undefined,
  );
  const item =
    renderedId != null ? transactionHistory.find((entry) => entry.id === renderedId) : undefined;
  const transfer =
    preparingTransfer ??
    (item?.type === TransactionHistoryItemType.Transfer ? item.data : undefined);

  if (!transfer) return <Modal isOpen={false} close={close} />;
  return (
    <TransferDetailsModalInner
      key={transfer.timestamp}
      isOpen={isOpen}
      close={close}
      transfer={transfer}
      routeSteps={transfer.routeSteps ?? liveRouteSteps}
    />
  );
}

function TransferDetailsModalInner({
  isOpen,
  close,
  transfer,
  routeSteps,
}: {
  isOpen: boolean;
  close: () => void;
  transfer: TransferHistoryItem;
  routeSteps?: QuoteStep[];
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
  const hasDetailedRoute = !!getSwapStages(routeSteps ?? [], srcChain, dstChain);
  const isApproving =
    status === TransferStatus.SigningApprove || status === TransferStatus.ConfirmingApprove;

  const isFailed = status === TransferStatus.Failed;
  const isDestFailed = status === TransferStatus.DestTransferFailed;
  const isDelivered = status === TransferStatus.ConfirmedDestination;
  const isFailedRecovered = status === TransferStatus.FailedRecovered;
  const isRevealFailed = status === TransferStatus.DestFailed;
  const isFinal = FinalTransferStatuses.includes(status);
  const showApprovalFlow =
    isApproving || (!!transfer.approvalRequired && !originTxHash && !isFinal);
  const approvalComplete =
    status === TransferStatus.CreatingTxs || status === TransferStatus.SigningTransfer;

  // Poll the reveal message when present — its delivery tx IS the ICA
  // execution on the destination chain, which is what actually completes
  // the transfer. Direct bridge routes fall back to the bridge/warp
  // message. Same-chain transfers have no msgIds.
  const pollingMsgId = getTransferDeliveryMsgId(msgIds);
  const deliveryStatus = pollingMsgId ? messageStatuses[pollingMsgId] : undefined;
  const bridgeMsgId = msgIds?.find(
    (message) => message.label === 'bridge' || message.label === 'warp',
  )?.msgId;
  const bridgeDelivered = bridgeMsgId ? messageStatuses[bridgeMsgId]?.delivered : undefined;
  const displayMsgIds = useMemo(() => normalizeLabeledTransferMessages(msgIds), [msgIds]);

  const showTimeline = !!originTxHash && !!pollingMsgId;

  const fundsAvailable = showTimeline
    ? deliveryStatus?.messageId === pollingMsgId &&
      deliveryStatus?.delivered &&
      (deliveryStatus.fundsAvailable || isDelivered)
    : isDelivered;
  const outcome = isDestFailed
    ? 'Origin succeeded and delivery completed, but destination execution reverted. Funds may remain in your ICA. Please contact support.'
    : isFailedRecovered
      ? 'Destination execution reverted and the intermediate token was automatically returned to your wallet on the destination chain.'
      : isRevealFailed
        ? 'The destination execution ran but both the transfer and fallback failed. The intermediate token remains in your ICA. Please contact support.'
        : isFailed
          ? 'Transfer failed. Check the transaction details before trying again.'
          : fundsAvailable
            ? `Funds are available to use on ${getChainDisplayName(multiProvider, destChain, true)}.`
            : undefined;
  const outcomeIsSuccess =
    !!fundsAvailable && !isFailed && !isDestFailed && !isRevealFailed && !isFailedRecovered;

  const messageStatus = deliveryStatus?.messageId === pollingMsgId ? deliveryStatus : undefined;
  const needsWallet =
    status === TransferStatus.SigningApprove || status === TransferStatus.SigningTransfer;
  const headline = outcomeIsSuccess
    ? 'Transfer complete'
    : outcome
      ? STATUS_HEADLINE[status]
      : showApprovalFlow && status === TransferStatus.Preparing
        ? 'Checking token permission'
        : showTimeline && messageStatus
          ? messageStatus.delivered
            ? 'Checking destination execution'
            : messageStatus.status === 'Awaiting delivery'
              ? 'Waiting for message delivery'
              : messageStatus.status
          : STATUS_HEADLINE[status];
  const description = outcomeIsSuccess
    ? showTimeline
      ? 'Delivered. Confirmation details are available below.'
      : 'Your transfer has been delivered.'
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
              : showTimeline && messageStatus && !messageStatus.delivered
                ? messageStatus.activity
                : status === TransferStatus.Preparing || status === TransferStatus.CreatingTxs
                  ? 'Checking the route and preparing your transaction.'
                  : 'No action needed. We’ll update this as the transaction progresses.';

  const date = useMemo(
    () => (timestamp ? formatTimestamp(timestamp) : formatTimestamp(Date.now())),
    [timestamp],
  );

  const [fromUrl, setFromUrl] = useState('');
  const [toUrl, setToUrl] = useState('');
  const [originTxUrl, setOriginTxUrl] = useState('');
  const [destTxUrl, setDestTxUrl] = useState('');
  useEffect(() => {
    let cancelled = false;
    setFromUrl('');
    setToUrl('');
    setOriginTxUrl('');
    setDestTxUrl('');
    (async () => {
      try {
        if (originTxHash) {
          const url = multiProvider.tryGetExplorerTxUrl(originChain, { hash: originTxHash });
          if (url && !cancelled) setOriginTxUrl(fixDoubleSlash(url));
        }
        if (destinationTxHash) {
          const url = multiProvider.tryGetExplorerTxUrl(destChain, { hash: destinationTxHash });
          if (url && !cancelled) setDestTxUrl(fixDoubleSlash(url));
        }
        const [f, t] = await Promise.all([
          multiProvider.tryGetExplorerAddressUrl(originChain, sender),
          multiProvider.tryGetExplorerAddressUrl(destChain, recipient),
        ]);
        if (cancelled) return;
        if (f) setFromUrl(fixDoubleSlash(f));
        if (t) setToUrl(fixDoubleSlash(t));
      } catch (err) {
        logger.error('Error fetching explorer URLs', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [multiProvider, originChain, destChain, originTxHash, destinationTxHash, sender, recipient]);

  return (
    <Modal
      isOpen={isOpen}
      close={close}
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
          <HyperswapProgress
            transfer={routeSteps === transfer.routeSteps ? transfer : { ...transfer, routeSteps }}
            srcToken={srcToken}
            dstToken={dstToken}
            bridgeDelivered={bridgeDelivered}
            executionDelivered={deliveryStatus?.delivered}
            fundsAvailable={!!fundsAvailable}
          />
        )}
        <div
          className="mt-5 min-h-[76px] border-t border-gray-400/25 pt-4"
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
          <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{description}</p>
        </div>

        {showTimeline && (
          <TransferProgress
            transfer={transfer}
            enabled={isOpen}
            onDeliveryChange={onDeliveryChange}
          />
        )}

        {isFinal ? (
          <div className="mt-5 flex flex-col space-y-4 empty:hidden">
            {!showTimeline && (
              <>
                <TransferProperty name="Sender Address" value={sender} url={fromUrl} />
                <TransferProperty name="Recipient Address" value={recipient} url={toUrl} />
              </>
            )}
            {!showTimeline && originTxHash && (
              <TransferProperty
                name="Origin Transaction Hash"
                value={originTxHash}
                url={originTxUrl}
              />
            )}
            {!showTimeline && destinationTxHash && (
              <TransferProperty
                name="Destination Transaction Hash"
                value={destinationTxHash}
                url={destTxUrl}
              />
            )}
            {!showTimeline &&
              displayMsgIds?.map(({ msgId: id, label }) => (
                <TransferProperty
                  key={id}
                  name={LABEL_NAMES[label] ?? 'Message ID'}
                  value={id}
                  url={getHypExplorerLink(multiProvider, originChain, id) ?? undefined}
                />
              ))}
          </div>
        ) : null}
        <div className="mt-4 min-h-[52px]">
          {outcome && (
            <div
              data-testid="transfer-outcome"
              role={outcomeIsSuccess ? 'status' : 'alert'}
              className={`rounded-lg border p-3 text-xs leading-relaxed ${
                outcomeIsSuccess
                  ? 'border-green-50/30 bg-green-50/10 text-green-600 dark:text-green-50'
                  : isFailedRecovered
                    ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200'
                    : 'border-red-300 bg-red-100/20 text-red-600 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200'
              }`}
            >
              {outcome}
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-4 border-t border-gray-400/25 pt-3">
          <span className="text-xxs text-foreground-muted">
            {originTxHash && !isFinal && !fundsAvailable
              ? 'You can close this. Your transfer will continue.'
              : needsWallet
                ? 'Your wallet needs your confirmation.'
                : ''}
          </span>
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

function TransferProperty({ name, value, url }: { name: string; value: string; url?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs leading-normal tracking-wider text-foreground-muted">
          {name}
        </label>
        <div className="flex items-center space-x-2">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Image src={LinkIcon} width={14} height={14} alt="" />
            </a>
          )}
          <CopyButton copyValue={value} width={14} height={14} className="opacity-40" />
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
