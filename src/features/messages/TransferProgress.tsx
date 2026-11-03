import { CopyButton } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useEffect } from 'react';

import LinkIcon from '../../images/icons/external-link-icon.svg';
import { getHypExplorerLink } from '../../utils/links';
import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';
import type { LabeledMsgId, TransferHistoryItem } from '../transfer/engine/types';
import { decodeAuthorizationBody, decodeTransferBody, ProgressState } from './progress';
import { useEvmMailboxDeliveryStatus } from './useEvmMailboxDeliveryStatus';
import { useMessageDeliveryStatus } from './useMessageDeliveryStatus';
import { useSolanaMailboxDeliveryStatus } from './useSolanaMailboxDeliveryStatus';
import { useTransactionConfirmations } from './useTransactionConfirmations';
import { getTransferDeliveryMsgId } from './utils';

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
      {transfer.msgIds?.map((message) => (
        <MessageProgressRow
          key={message.msgId}
          message={message}
          transfer={transfer}
          enabled={enabled}
          onDeliveryChange={
            message.msgId === getTransferDeliveryMsgId(transfer.msgIds)
              ? onDeliveryChange
              : undefined
          }
        />
      ))}
    </section>
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
  onDeliveryChange?: (status: TransferDeliveryStatus) => void;
}) {
  const multiProvider = useMultiProvider();
  const chainAddresses = useStore((s) => s.chainAddresses);
  const indexed = useMessageDeliveryStatus(message.msgId, enabled, multiProvider, true);
  const origin =
    multiProvider.tryGetChainName(indexed.message?.originDomain ?? transfer.srcChain) ?? undefined;
  const destination =
    multiProvider.tryGetChainName(indexed.message?.destinationDomain ?? transfer.dstChain) ??
    undefined;
  const evm = useEvmMailboxDeliveryStatus({
    msgId: message.msgId,
    destinationChain: destination,
    chainAddresses,
    multiProvider,
    enabled: enabled && !indexed.destinationTxHash,
  });
  const solana = useSolanaMailboxDeliveryStatus({
    msgId: message.msgId,
    destinationChain: destination,
    chainAddresses,
    multiProvider,
    enabled: enabled && !indexed.isDelivered && !evm.isDelivered,
  });
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
  const destinationTx = indexed.destinationTxHash ?? evm.destinationTxHash;
  const originConfirmation = useTransactionConfirmations(origin, originTx, enabled);
  const destinationConfirmation = useTransactionConfirmations(destination, destinationTx, enabled);
  const delivered = indexed.isDelivered || evm.isDelivered || solana.isDelivered;
  const deliveryMissing =
    destinationConfirmation.data?.included === false ||
    destinationConfirmation.data?.state === ProgressState.Failed;
  const isDirectBridge =
    transfer.msgIds?.length === 1 &&
    (message.label === 'bridge' || message.label === 'warp') &&
    !transfer.destinationOutcome &&
    !transfer.solanaDestSwapPda;
  const fundsAvailable = isDirectBridge && delivered && !deliveryMissing;
  useEffect(() => {
    onDeliveryChange?.({
      messageId: message.msgId,
      delivered: delivered && !deliveryMissing,
      fundsAvailable,
    });
  }, [onDeliveryChange, message.msgId, delivered, deliveryMissing, fundsAvailable]);
  const confirmed =
    delivered &&
    !deliveryMissing &&
    !destinationConfirmation.isError &&
    destinationConfirmation.data?.state === ProgressState.Confirmed;
  const originState = originConfirmation.isError
    ? ProgressState.Unavailable
    : (originConfirmation.data?.state ?? ProgressState.Pending);
  const originConfirmed = originState === ProgressState.Confirmed;
  const destinationState = destinationConfirmation.isError
    ? ProgressState.Unavailable
    : (destinationConfirmation.data?.state ?? ProgressState.Pending);
  const steps = [
    {
      label: 'Origin confirmed',
      state: originState,
      active: !originConfirmed && !delivered,
    },
    {
      label: 'Delivered',
      state:
        delivered && !deliveryMissing
          ? ProgressState.Confirmed
          : indexed.error
            ? ProgressState.Unavailable
            : ProgressState.Pending,
      active:
        (!delivered || deliveryMissing) &&
        (originConfirmed || originState === ProgressState.Unavailable),
    },
    {
      label: 'Confirmed',
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
          : indexed.error
            ? 'Status unavailable'
            : !originConfirmed && originState === ProgressState.Pending
              ? 'Confirming origin'
              : 'Awaiting delivery';
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
      className="rounded-md border border-gray-400/25 bg-surface px-3 py-2 text-xs"
    >
      <div>
        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="font-medium">{MESSAGE_LABELS[message.label]}</span>
          <output
            className={`rounded-full px-2 py-0.5 text-xxs ${confirmed || fundsAvailable ? 'bg-green-50/10 text-green-600 dark:text-green-50' : 'bg-primary-500/10 text-primary-700 dark:text-primary-200'}`}
          >
            {status}
          </output>
        </span>
        <ol aria-label="Message milestones" className="mt-2 grid grid-cols-3 gap-2">
          {steps.map(({ label, state, active }) => (
            <MessageMilestone key={label} label={label} state={state} active={active} />
          ))}
        </ol>
        {!confirmed && (
          <span className="mt-1.5 block text-xxs text-foreground-muted">
            {fundsAvailable && 'Destination confirmations: '}
            {activity}
          </span>
        )}
      </div>
      <details className="group">
        <summary className="mt-1 flex cursor-pointer list-none items-center justify-end gap-1 text-xxs text-foreground-muted [&::-webkit-details-marker]:hidden">
          Message details
          <span
            aria-hidden="true"
            className="inline-block transition-transform group-open:rotate-90"
          >
            ›
          </span>
        </summary>
        <dl className="mt-3 space-y-2 border-t border-gray-400/25 pt-3">
          {Object.entries(fields).map(([label, value]) =>
            value == null ? null : (
              <div key={label} className="flex justify-between gap-3">
                <dt className="shrink-0 text-gray-500">{label}</dt>
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
                <dt className="text-gray-500">{label}</dt>
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
              <dt className="text-gray-500">Message body</dt>
              <dd className="font-mono mt-1 max-h-24 overflow-auto break-all text-xxs">{body}</dd>
            </div>
          )}
        </dl>
      </details>
    </article>
  );
}

function confirmationText({
  data,
  isError,
}: ReturnType<typeof useTransactionConfirmations>): string {
  if (isError) return 'Temporarily unavailable';
  if (!data) return 'Checking…';
  if (data.confirmations != null && data.required != null)
    return data.state === ProgressState.Confirmed
      ? `Confirmed (${data.required}/${data.required})`
      : `${data.confirmations}/${data.required} blocks`;
  return data.reason ?? 'Waiting';
}

function MessageMilestone({
  label,
  state,
  active,
}: {
  label: string;
  state: ProgressState;
  active: boolean;
}) {
  const complete = state === ProgressState.Confirmed;
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
      aria-label={`${label}: ${description}`}
      aria-current={current ? 'step' : undefined}
      className={color}
    >
      <span
        aria-hidden="true"
        className={`mb-1 block h-1 rounded-full ${complete ? 'bg-primary-500' : current ? 'message-progress-active bg-primary-300' : 'bg-gray-400/25'}`}
      />
      <span className="flex items-start gap-1 text-xxs leading-tight">
        <span aria-hidden="true">
          {complete ? '✓' : unavailable ? '?' : failed ? '!' : current ? '◉' : '○'}
        </span>
        <span>{label}</span>
      </span>
      {(unavailable || failed) && <span className="mt-1 block text-xxs">{description}</span>}
    </li>
  );
}
