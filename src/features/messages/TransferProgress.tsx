import { CopyButton, SpinnerIcon } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import LinkIcon from '../../images/icons/external-link-icon.svg';
import { getHypExplorerLink } from '../../utils/links';
import { useMultiProvider } from '../chains/hooks';
import type { LabeledMsgId, TransferHistoryItem } from '../transfer/engine/types';
import { DiagnosticConnection, relayLabel } from './diagnostics';
import { MessageRelayProgress } from './MessageRelayProgress';
import { normalizeMessageId } from './messageStream';
import {
  decodeAuthorizationBody,
  decodeTransferBody,
  ProgressState,
  type ConfirmationProgress,
} from './progress';
import { useMessageDeliveryStatus } from './useMessageDeliveryStatus';
import {
  useMessageDiagnostics,
  connectingDiagnostics,
  type DiagnosticsState,
} from './useMessageDiagnostics';
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
  const diagnostics = useMessageDiagnostics(
    transfer.msgIds?.map((message) => message.msgId) ?? [],
    enabled,
  );
  return (
    <section aria-label="Transfer progress" className="mt-4 space-y-2">
      {!transfer.msgIds?.length && (
        <OriginTransactionProgress transfer={transfer} enabled={enabled} />
      )}
      {transfer.msgIds?.map((message) => (
        <MessageProgressRow
          key={message.msgId}
          message={message}
          diagnostics={diagnostics[normalizeMessageId(message.msgId)] ?? connectingDiagnostics}
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
  diagnostics,
  transfer,
  enabled,
  onDeliveryChange,
}: {
  message: LabeledMsgId;
  diagnostics: DiagnosticsState;
  transfer: TransferHistoryItem;
  enabled: boolean;
  onDeliveryChange: (status: TransferDeliveryStatus) => void;
}) {
  const multiProvider = useMultiProvider();
  const [expanded, setExpanded] = useState(transfer.msgIds?.length === 1);
  const [selectedRelayer, setSelectedRelayer] = useState('');
  const [metadataExpanded, setMetadataExpanded] = useState(false);
  const relayers = diagnostics.data?.relayers;
  const relay = selectedRelayer
    ? relayers?.find((item) => item.relayer === selectedRelayer)
    : relayers?.[0];
  useEffect(() => {
    // Keep the first observed reporter, even as new anchors/reporters arrive.
    if (!selectedRelayer && relay) setSelectedRelayer(relay.relayer);
  }, [selectedRelayer, relay]);
  const delivery = useMessageDeliveryStatus({ msgId: message.msgId }, enabled, multiProvider, {
    destinationChain: multiProvider.tryGetChainName(transfer.dstChain) ?? undefined,
    recheckDelivered: true,
  });
  const origin =
    multiProvider.tryGetChainName(delivery.message?.originDomain ?? transfer.srcChain) ?? undefined;
  const destination =
    multiProvider.tryGetChainName(delivery.message?.destinationDomain ?? transfer.dstChain) ??
    undefined;
  const messageSender = delivery.message?.sender;
  const messageRecipient = delivery.message?.recipient;
  const { data: addressLinks } = useQuery({
    queryKey: ['messageAddressLinks', origin, destination, messageSender, messageRecipient],
    queryFn: () =>
      Promise.all([
        origin ? multiProvider.tryGetExplorerAddressUrl(origin, messageSender) : null,
        destination ? multiProvider.tryGetExplorerAddressUrl(destination, messageRecipient) : null,
      ]),
    enabled: enabled && metadataExpanded && !!delivery.message,
    staleTime: 60_000,
  });
  const originTx = delivery.message?.originTxHash ?? transfer.originTxHash;
  const destinationTx = delivery.destinationTxHash;
  const originConfirmation = useTransactionConfirmations(
    origin,
    originTx,
    enabled,
    delivery.originBlockHeight ?? transfer.originBlockNumber,
  );
  const destinationConfirmation = useTransactionConfirmations(
    destination,
    destinationTx,
    enabled,
    delivery.destinationBlockHeight,
  );
  const deliveryMissing =
    destinationConfirmation.data?.included === false ||
    destinationConfirmation.data?.state === ProgressState.Failed;
  const delivered = delivery.isDelivered && !deliveryMissing;
  const isDirectBridge =
    transfer.msgIds?.length === 1 &&
    (message.label === 'bridge' || message.label === 'warp') &&
    !transfer.destinationOutcome &&
    !transfer.solanaDestSwapPda;
  const fundsAvailable = isDirectBridge && delivered;
  const confirmed = delivered && destinationConfirmation.data?.state === ProgressState.Confirmed;
  const originState =
    originConfirmation.data?.state ??
    (originConfirmation.isError ? ProgressState.Unavailable : ProgressState.Pending);
  const originConfirmed = originState === ProgressState.Confirmed;
  const destinationState =
    destinationConfirmation.data?.state ??
    (destinationConfirmation.isError ? ProgressState.Unavailable : ProgressState.Pending);
  const originCount = confirmationCount(originConfirmation.data);
  const destinationCount = confirmationCount(destinationConfirmation.data);
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
          : delivery.error && !delivery.message
            ? 'Status unavailable'
            : !originConfirmed && originState === ProgressState.Pending
              ? 'Confirming origin'
              : 'Awaiting delivery';
  const subtitle =
    status === 'Confirming origin' && originCount
      ? `Confirming origin · ${originCount}`
      : status === 'Awaiting delivery'
        ? relay && diagnostics.connection === DiagnosticConnection.Live
          ? relayLabel(relay.state)
          : 'Awaiting relayer delivery'
        : delivered && !confirmed && destinationCount
          ? `${status} · ${destinationCount}${fundsAvailable ? ' confirmations' : ''}`
          : status;
  const activity = deliveryMissing
    ? 'Rechecking the destination transaction'
    : !delivered && delivery.error
      ? 'Delivery status is temporarily unavailable'
      : delivered
        ? destinationTx
          ? confirmationText(destinationConfirmation)
          : 'Waiting for destination transaction details'
        : originConfirmed
          ? 'Waiting for the destination to receive this message'
          : confirmationText(originConfirmation);
  useEffect(() => {
    onDeliveryChange({
      messageId: message.msgId,
      delivered,
      fundsAvailable,
      status,
      activity,
    });
  }, [onDeliveryChange, message.msgId, delivered, fundsAvailable, status, activity]);
  const body = delivery.message?.body;
  const token = decodeTransferBody({ label: message.label, body });
  const authorization = decodeAuthorizationBody(body);
  const fields = {
    'Origin confirmations': confirmationText(originConfirmation),
    ...(delivery.isDelivered
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
  const metadata = (
    <dl className="mt-2 space-y-2">
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
          <div key={label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
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
  );
  return (
    <article aria-label={MESSAGE_LABELS[message.label]} className="relay-card text-xs">
      <details
        className="message-disclosure"
        open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${delivered ? 'bg-green-50/10 text-green-600 dark:text-green-50' : 'bg-primary-500/10 text-primary-700 dark:text-primary-200'}`}
          >
            {delivered ? (
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
            {!expanded && (
              <output className="pointer-events-none block text-xxs tabular-nums text-foreground-muted">
                {subtitle}
              </output>
            )}
          </span>
          <span
            aria-hidden="true"
            className="message-disclosure-chevron text-lg text-foreground-muted transition-transform motion-reduce:transition-none"
          >
            ›
          </span>
          <span className="sr-only">Message details</span>
        </summary>
        <div className="px-3 pb-3">
          <MessageRelayProgress
            diagnostics={diagnostics}
            destination={destination}
            observation={relay}
            delivered={delivered}
            confirmed={confirmed}
            confirming={delivered && !!destinationTx && destinationState === ProgressState.Pending}
            status={subtitle}
            selectedRelayer={selectedRelayer || relay?.relayer || ''}
            onSelectRelayer={setSelectedRelayer}
          />
          <details
            open={metadataExpanded}
            onToggle={(event) => setMetadataExpanded(event.currentTarget.open)}
            className="mt-3 border-t border-gray-400/25 pt-3"
          >
            <summary className="cursor-pointer text-xxs text-foreground-muted">
              Transaction details
            </summary>
            {metadata}
          </details>
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
