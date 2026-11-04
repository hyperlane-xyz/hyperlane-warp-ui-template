import { CopyButton, SpinnerIcon } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useEffect } from 'react';

import LinkIcon from '../../images/icons/external-link-icon.svg';
import { getHypExplorerLink } from '../../utils/links';
import { useMultiProvider } from '../chains/hooks';
import type { LabeledMsgId, TransferHistoryItem } from '../transfer/engine/types';
import {
  decodeAuthorizationBody,
  decodeTransferBody,
  ProgressState,
  type ConfirmationProgress,
} from './progress';
import { useMessageDeliveryStatus } from './useMessageDeliveryStatus';
import { useTransactionConfirmations } from './useTransactionConfirmations';

const MESSAGE_LABELS: Record<LabeledMsgId['label'], string> = {
  warp: 'Bridge funds',
  bridge: 'Bridge funds',
  commit: 'Commit authorization',
  reveal: 'Reveal authorization',
};

export interface TransferDeliveryStatus {
  messageId: string;
  delivered: boolean;
  fundsAvailable: boolean;
  status: string;
  activity: string;
}

export function TransferProgress({
  transfer,
  enabled,
  onDeliveryChange,
}: {
  transfer: TransferHistoryItem;
  enabled: boolean;
  onDeliveryChange: (status: TransferDeliveryStatus) => void;
}) {
  return (
    <section aria-label="Transfer progress" className="mt-4 space-y-2">
      {!transfer.msgIds?.length && (
        <OriginTransactionProgress transfer={transfer} enabled={enabled} />
      )}
      {transfer.msgIds?.map((message) => (
        <MessageProgressRow
          key={message.msgId}
          message={message}
          transfer={transfer}
          enabled={enabled}
          onDeliveryChange={onDeliveryChange}
        />
      ))}
    </section>
  );
}

// Dispatch IDs are only available after origin inclusion/receipt decoding.
function OriginTransactionProgress({
  transfer,
  enabled,
}: {
  transfer: TransferHistoryItem;
  enabled: boolean;
}) {
  const multiProvider = useMultiProvider();
  const origin = multiProvider.tryGetChainName(transfer.srcChain) ?? undefined;
  const confirmation = useTransactionConfirmations(
    origin,
    transfer.originTxHash,
    enabled,
    transfer.originBlockNumber,
  );
  const count = confirmationCount(confirmation.data);
  const status = confirmation.isError
    ? 'Origin status unavailable'
    : confirmation.data?.state === ProgressState.Confirmed
      ? 'Origin confirmed · Finding dispatched messages'
      : count
        ? `Confirming origin · ${count}`
        : (confirmation.data?.reason ?? 'Waiting for origin inclusion');
  const url =
    origin && transfer.originTxHash
      ? multiProvider.tryGetExplorerTxUrl(origin, { hash: transfer.originTxHash })
      : undefined;
  return (
    <article
      aria-label="Origin transaction"
      className="flex min-h-[56px] items-center gap-3 rounded-lg border border-gray-400/25 bg-surface px-3 py-2 text-xs"
    >
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-700 dark:text-primary-200"
      >
        <SpinnerIcon
          width={14}
          height={14}
          color="currentColor"
          className="message-status-spinner"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Origin transaction</span>
        <output className="block text-xxs tabular-nums text-foreground-muted">{status}</output>
      </span>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View origin transaction"
        >
          <Image src={LinkIcon} alt="" width={14} height={14} />
        </a>
      )}
    </article>
  );
}

function MessageProgressRow({
  message,
  transfer,
  enabled,
  onDeliveryChange,
}: {
  message: LabeledMsgId;
  transfer: TransferHistoryItem;
  enabled: boolean;
  onDeliveryChange: (status: TransferDeliveryStatus) => void;
}) {
  const multiProvider = useMultiProvider();
  const indexed = useMessageDeliveryStatus({ msgId: message.msgId }, enabled, multiProvider, true);
  const origin =
    multiProvider.tryGetChainName(indexed.message?.originDomain ?? transfer.srcChain) ?? undefined;
  const destination =
    multiProvider.tryGetChainName(indexed.message?.destinationDomain ?? transfer.dstChain) ??
    undefined;
  const messageSender = indexed.message?.sender;
  const messageRecipient = indexed.message?.recipient;
  const { data: addressLinks } = useQuery({
    queryKey: ['messageAddressLinks', origin, destination, messageSender, messageRecipient],
    queryFn: () =>
      Promise.all([
        origin ? multiProvider.tryGetExplorerAddressUrl(origin, messageSender) : null,
        destination ? multiProvider.tryGetExplorerAddressUrl(destination, messageRecipient) : null,
      ]),
    enabled: enabled && !!indexed.message,
    staleTime: 60_000,
  });
  const originTx = indexed.message?.originTxHash ?? transfer.originTxHash;
  const destinationTx = indexed.destinationTxHash;
  const originConfirmation = useTransactionConfirmations(
    origin,
    originTx,
    enabled,
    indexed.originBlockHeight,
  );
  const destinationConfirmation = useTransactionConfirmations(
    destination,
    destinationTx,
    enabled,
    indexed.destinationBlockHeight,
  );
  const delivered = indexed.isDelivered;
  const deliveryMissing =
    destinationConfirmation.data?.included === false ||
    destinationConfirmation.data?.state === ProgressState.Failed;
  const isDirectBridge =
    transfer.msgIds?.length === 1 &&
    (message.label === 'bridge' || message.label === 'warp') &&
    !transfer.destinationOutcome &&
    !transfer.solanaDestSwapPda;
  const fundsAvailable = isDirectBridge && delivered && !deliveryMissing;
  const confirmed =
    delivered &&
    !deliveryMissing &&
    destinationConfirmation.data?.state === ProgressState.Confirmed;
  const originState =
    originConfirmation.data?.state ??
    (originConfirmation.isError ? ProgressState.Unavailable : ProgressState.Pending);
  const originConfirmed = originState === ProgressState.Confirmed;
  const destinationState =
    destinationConfirmation.data?.state ??
    (destinationConfirmation.isError ? ProgressState.Unavailable : ProgressState.Pending);
  const originCount = confirmationCount(originConfirmation.data);
  const destinationCount = confirmationCount(destinationConfirmation.data);
  const steps = [
    {
      label: 'Origin confirmed',
      pendingLabel: 'Origin confirming',
      count: originCount,
      state: originState,
      active: !originConfirmed && !delivered,
    },
    {
      label: 'Delivered',
      pendingLabel: 'Delivering',
      state:
        delivered && !deliveryMissing
          ? ProgressState.Confirmed
          : indexed.error && !indexed.message
            ? ProgressState.Unavailable
            : ProgressState.Pending,
      active:
        (!delivered || deliveryMissing) &&
        (originConfirmed || originState === ProgressState.Unavailable),
    },
    {
      label: 'Confirmed',
      pendingLabel: 'Confirming',
      count: delivered && !deliveryMissing ? destinationCount : undefined,
      state: delivered && !deliveryMissing ? destinationState : ProgressState.Pending,
      active: delivered && !deliveryMissing && !!destinationTx,
    },
  ];
  const status = deliveryMissing
    ? 'Rechecking delivery'
    : confirmed
      ? 'Confirmed'
      : delivered
        ? fundsAvailable || destinationState === ProgressState.Unavailable
          ? 'Delivered'
          : 'Confirming destination'
        : originState === ProgressState.Failed
          ? 'Origin transaction failed'
          : indexed.error && !indexed.message
            ? 'Status unavailable'
            : !originConfirmed && originState === ProgressState.Pending
              ? 'Confirming origin'
              : 'Awaiting delivery';
  const subtitle =
    status === 'Confirming origin' && originCount
      ? `Confirming origin · ${originCount}`
      : status === 'Awaiting delivery'
        ? 'Awaiting relayer delivery'
        : delivered && !deliveryMissing && !confirmed && destinationCount
          ? `${status} · ${destinationCount}${fundsAvailable ? ' confirmations' : ''}`
          : status;
  const activity = deliveryMissing
    ? 'Rechecking the destination transaction'
    : !delivered && indexed.error
      ? 'Delivery status is temporarily unavailable'
      : delivered && !deliveryMissing
        ? destinationTx
          ? confirmationText(destinationConfirmation)
          : 'Waiting for destination transaction details'
        : originConfirmed
          ? 'Waiting for the destination to receive this message'
          : confirmationText(originConfirmation);
  useEffect(() => {
    onDeliveryChange({
      messageId: message.msgId,
      delivered: delivered && !deliveryMissing,
      fundsAvailable,
      status,
      activity,
    });
  }, [
    onDeliveryChange,
    message.msgId,
    delivered,
    deliveryMissing,
    fundsAvailable,
    status,
    activity,
  ]);
  const body = indexed.message?.body;
  const token = decodeTransferBody({ label: message.label, body });
  const authorization = decodeAuthorizationBody(body);
  const fields = {
    'Origin confirmations': confirmationText(originConfirmation),
    ...(delivered
      ? {
          'Destination confirmations': destinationTx
            ? confirmationText(destinationConfirmation)
            : 'Waiting for transaction',
        }
      : {}),
    'Amount (atomic units)': token?.amount,
    'Token recipient': token?.recipient,
    Commitment: authorization?.commitment,
    'Security module': authorization?.ism,
  };
  const links = {
    Sender: { hash: messageSender, url: addressLinks?.[0] },
    Recipient: { hash: messageRecipient, url: addressLinks?.[1] },
    'Message ID': {
      hash: message.msgId,
      url: origin ? getHypExplorerLink(multiProvider, origin, message.msgId) : undefined,
    },
    'Origin transaction': {
      hash: originTx,
      url:
        origin && originTx
          ? multiProvider.tryGetExplorerTxUrl(origin, { hash: originTx })
          : undefined,
    },
    'Destination transaction': {
      hash: destinationTx,
      url:
        destination && destinationTx
          ? multiProvider.tryGetExplorerTxUrl(destination, { hash: destinationTx })
          : undefined,
    },
  };
  return (
    <article
      aria-label={MESSAGE_LABELS[message.label]}
      className="rounded-lg border border-gray-400/25 bg-surface text-xs"
    >
      <details className="group">
        <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${delivered && !deliveryMissing ? 'bg-green-50/10 text-green-600 dark:text-green-50' : 'bg-primary-500/10 text-primary-700 dark:text-primary-200'}`}
          >
            {delivered && !deliveryMissing ? (
              '✓'
            ) : originState === ProgressState.Failed ? (
              '!'
            ) : status === 'Status unavailable' ? (
              '?'
            ) : (
              <SpinnerIcon
                width={14}
                height={14}
                color="currentColor"
                className="message-status-spinner"
              />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{MESSAGE_LABELS[message.label]}</span>
            <output className="pointer-events-none block text-xxs tabular-nums text-foreground-muted">
              {subtitle}
            </output>
          </span>
          <span
            aria-hidden="true"
            className="text-lg text-foreground-muted transition-transform group-open:rotate-90 motion-reduce:transition-none"
          >
            ›
          </span>
          <span className="sr-only">Message details</span>
        </summary>
        <div className="border-t border-gray-400/25 px-3 pb-3 pt-3">
          <ol aria-label="Message milestones" className="grid grid-cols-3 gap-2">
            {steps.map(({ label, pendingLabel, state, active, count }) => (
              <MessageMilestone
                key={label}
                label={label}
                pendingLabel={pendingLabel}
                state={state}
                active={active}
                count={count}
              />
            ))}
          </ol>
          <p className="mt-2 text-xxs text-foreground-muted">{activity}</p>
          <dl className="mt-3 space-y-2 border-t border-gray-400/25 pt-3">
            {Object.entries(fields).map(([label, value]) =>
              value == null ? null : (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-foreground-muted">{label}</dt>
                  <dd className="min-w-0 break-all text-right">{value}</dd>
                </div>
              ),
            )}
            {Object.entries(links).map(([label, { hash, url }]) =>
              !hash ? null : (
                <div
                  key={label}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
                >
                  <dt className="text-foreground-muted">{label}</dt>
                  <dd className="flex min-w-0 items-center gap-2">
                    {url ? (
                      <a
                        className="inline-flex items-center gap-1 underline"
                        href={url}
                        title={hash}
                        aria-label={`${label} (opens in new tab)`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {hash.slice(0, 8)}…{hash.slice(-6)}
                        <Image src={LinkIcon} width={12} height={12} alt="" />
                      </a>
                    ) : (
                      <span title={hash}>
                        {hash.slice(0, 8)}…{hash.slice(-6)}
                      </span>
                    )}
                    <CopyButton copyValue={hash} width={12} height={12} />
                  </dd>
                </div>
              ),
            )}
            {body && (
              <div>
                <dt className="text-foreground-muted">Message body</dt>
                <dd className="font-mono mt-1 max-h-24 overflow-auto break-all text-xxs">{body}</dd>
              </div>
            )}
          </dl>
        </div>
      </details>
    </article>
  );
}

function confirmationCount(progress: ConfirmationProgress | undefined) {
  if (progress?.confirmations == null || progress.required == null) return undefined;
  return `${Math.min(progress.confirmations, progress.required)}/${progress.required}`;
}

function confirmationText({
  data,
  isError,
}: ReturnType<typeof useTransactionConfirmations>): string {
  if (!data) return isError ? 'Temporarily unavailable' : 'Checking…';
  if (data.confirmations != null && data.required != null)
    return data.state === ProgressState.Confirmed
      ? `Confirmed (${data.required}/${data.required})`
      : `${data.confirmations}/${data.required} blocks`;
  return data.reason ?? 'Waiting';
}

function MessageMilestone({
  label,
  pendingLabel,
  state,
  active,
  count,
}: {
  label: string;
  pendingLabel: string;
  state: ProgressState;
  active: boolean;
  count?: string;
}) {
  const complete = state === ProgressState.Confirmed;
  const displayLabel = complete ? label : pendingLabel;
  const unavailable = state === ProgressState.Unavailable;
  const failed = state === ProgressState.Failed;
  const current = state === ProgressState.Pending && active;
  const description = complete
    ? 'Complete'
    : unavailable
      ? 'Unavailable'
      : failed
        ? 'Failed'
        : current
          ? 'In progress'
          : 'Waiting';
  const color = complete
    ? 'text-primary-700 dark:text-primary-200'
    : current
      ? 'text-foreground-primary'
      : 'text-foreground-muted';
  return (
    <li
      aria-label={`${displayLabel}: ${description}`}
      aria-current={current ? 'step' : undefined}
      className={color}
    >
      <span
        aria-hidden="true"
        className={`mb-1 block h-1 rounded-full ${complete ? 'bg-primary-500' : current ? 'bg-primary-300' : 'bg-gray-400/25'}`}
      />
      <span className="flex items-start gap-1 text-xxs leading-tight">
        <span aria-hidden="true">
          {current ? (
            <SpinnerIcon
              width={10}
              height={10}
              color="currentColor"
              className="message-status-spinner mt-0.5"
            />
          ) : complete ? (
            '✓'
          ) : unavailable ? (
            '?'
          ) : failed ? (
            '!'
          ) : (
            '○'
          )}
        </span>
        <span>{displayLabel}</span>
      </span>
      {count && <span className="mt-1 block text-xxs tabular-nums">{count}</span>}
      {(unavailable || failed) && <span className="mt-1 block text-xxs">{description}</span>}
    </li>
  );
}
