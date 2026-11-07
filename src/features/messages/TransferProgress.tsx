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
  estimateDeliverySeconds,
  formatEstimatedTime,
  ProgressState,
  type ConfirmationProgress,
} from './progress';
import { hexToProtocolAddress } from './queries/encoding';
import { useMessageDeliveryStatus } from './useMessageDeliveryStatus';
import {
  useMessageDiagnostics,
  connectingDiagnostics,
  type DiagnosticsState,
} from './useMessageDiagnostics';
import { useTransactionConfirmations } from './useTransactionConfirmations';
import { getTransferOverviewMsgId } from './utils';

const MESSAGE_LABELS: Record<LabeledMsgId['label'], string> = {
  warp: 'Bridge funds',
  bridge: 'Bridge funds',
  commit: 'Commit authorization',
  reveal: 'Destination delivery',
};

export interface TransferDeliveryStatus {
  messageId: string;
  delivered: boolean;
  fundsAvailable: boolean;
  destinationTxHash?: string;
  destinationChain?: string;
  explorerUrl?: string | null;
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
  const messages = transfer.msgIds ?? [];
  const primaryId = getTransferOverviewMsgId(transfer);
  const primary = messages.find(({ msgId }) => msgId === primaryId);
  const otherMessages = messages.filter(({ msgId }) => msgId !== primary?.msgId);
  const renderMessage = (message: LabeledMsgId) => (
    <MessageProgressRow
      key={message.msgId}
      message={message}
      primary={message.msgId === primary?.msgId}
      diagnostics={diagnostics[normalizeMessageId(message.msgId)] ?? connectingDiagnostics}
      transfer={transfer}
      enabled={enabled}
      onDeliveryChange={onDeliveryChange}
    />
  );
  return (
    <section aria-label="Transfer progress" className="mt-4 space-y-2">
      {!transfer.msgIds?.length && (
        <OriginTransactionProgress transfer={transfer} enabled={enabled} />
      )}
      {primary && renderMessage(primary)}
      {otherMessages.length > 0 && (
        <details className="pt-2">
          <summary className="cursor-pointer text-xxs text-foreground-muted">
            Other transfer messages ({otherMessages.length})
          </summary>
          <div className="mt-2 space-y-2">{otherMessages.map(renderMessage)}</div>
        </details>
      )}
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
  const confirmation = useTransactionConfirmations(origin, transfer.originTxHash, enabled);
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
        {confirmation.estimatedSeconds != null && (
          <span className="block text-xxs text-foreground-muted">
            {formatEstimatedTime(confirmation.estimatedSeconds)} remaining
          </span>
        )}
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
  primary,
  diagnostics,
  transfer,
  enabled,
  onDeliveryChange,
}: {
  message: LabeledMsgId;
  primary: boolean;
  diagnostics: DiagnosticsState;
  transfer: TransferHistoryItem;
  enabled: boolean;
  onDeliveryChange: (status: TransferDeliveryStatus) => void;
}) {
  const multiProvider = useMultiProvider();
  const [expanded, setExpanded] = useState(primary);
  const [selectedRelayer, setSelectedRelayer] = useState('');
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const relayers = diagnostics.data?.relayers;
  const relay = selectedRelayer
    ? relayers?.find((item) => item.relayer === selectedRelayer)
    : relayers?.[0];
  useEffect(() => {
    // Keep the first observed reporter, even as new anchors/reporters arrive.
    if (!selectedRelayer && relay) setSelectedRelayer(relay.relayer);
  }, [selectedRelayer, relay]);
  const delivery = useMessageDeliveryStatus({ msgId: message.msgId }, enabled, multiProvider);
  const origin =
    multiProvider.tryGetChainName(delivery.message?.originDomain ?? transfer.srcChain) ?? undefined;
  const destination =
    multiProvider.tryGetChainName(delivery.message?.destinationDomain ?? transfer.dstChain) ??
    undefined;
  const messageSender = delivery.message?.sender;
  const messageRecipient = delivery.message?.recipient;
  const body = delivery.message?.body;
  const token = decodeTransferBody({ label: message.label, body });
  const destinationMetadata = destination
    ? multiProvider.tryGetChainMetadata(destination)
    : undefined;
  const { data: addressLinks, isError: addressLinksError } = useQuery({
    queryKey: [
      'messageAddressLinks',
      origin,
      destination,
      messageSender,
      messageRecipient,
      token?.recipient,
      destinationMetadata,
    ],
    queryFn: async () => {
      const tokenRecipient = token
        ? hexToProtocolAddress(token.recipient, destinationMetadata)
        : undefined;
      const [senderUrl, recipientUrl, tokenRecipientUrl] = await Promise.all([
        origin ? multiProvider.tryGetExplorerAddressUrl(origin, messageSender) : null,
        destination ? multiProvider.tryGetExplorerAddressUrl(destination, messageRecipient) : null,
        destination && destinationMetadata && tokenRecipient && !/^0x0+$/.test(tokenRecipient)
          ? multiProvider.tryGetExplorerAddressUrl(destination, tokenRecipient)
          : null,
      ]);
      return { senderUrl, recipientUrl, tokenRecipient, tokenRecipientUrl };
    },
    enabled: enabled && advancedExpanded && !!delivery.message,
    staleTime: 60_000,
    retry: false,
  });
  const originTx = delivery.message?.originTxHash ?? transfer.originTxHash;
  const destinationTx = delivery.destinationTxHash;
  const originConfirmation = useTransactionConfirmations(
    origin,
    originTx,
    enabled,
    delivery.originBlockHeight,
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
  const phaseLabel =
    relay && diagnostics.connection === DiagnosticConnection.Live && status === 'Awaiting delivery'
      ? relayLabel(relay.state)
      : status === 'Awaiting delivery'
        ? diagnostics.connection === DiagnosticConnection.Live
          ? 'Waiting for relayer to pick up the message'
          : 'Awaiting relayer delivery'
        : status;
  const confirmation = delivered ? destinationConfirmation : originConfirmation;
  const confirmationCountText = delivered ? destinationCount : originCount;
  const confirmationSummary =
    !deliveryMissing && confirmation.data?.state === ProgressState.Pending
      ? `${delivered ? 'Destination' : 'Origin'} confirmations${confirmationCountText ? ` · ${confirmationCountText}` : ''}${confirmation.estimatedSeconds != null ? ` · ${formatEstimatedTime(confirmation.estimatedSeconds)} remaining` : ''}`
      : undefined;
  const subtitle =
    !expanded && confirmationCountText && confirmation.data?.state === ProgressState.Pending
      ? `${phaseLabel} · ${confirmationCountText}`
      : phaseLabel;
  const lifecycle = {
    state: relay?.state,
    delivered,
    confirmed,
    confirming: delivered && !!destinationTx && destinationState === ProgressState.Pending,
    originState,
    paused:
      deliveryMissing || originState === ProgressState.Failed || status === 'Status unavailable',
  };
  const estimatedSeconds =
    lifecycle.paused || (!delivered && (relay?.state.failure || relay?.state.phase === 'dropped'))
      ? undefined
      : delivered
        ? destinationConfirmation.estimatedSeconds
        : estimateDeliverySeconds(
            origin ? multiProvider.tryGetChainMetadata(origin)?.blocks : undefined,
            originConfirmation.data,
          );
  const explorerUrl = origin ? getHypExplorerLink(multiProvider, origin, message.msgId) : undefined;
  useEffect(() => {
    onDeliveryChange({
      messageId: message.msgId,
      delivered,
      fundsAvailable,
      destinationTxHash: delivered ? destinationTx : undefined,
      destinationChain: destination,
      explorerUrl,
    });
  }, [
    onDeliveryChange,
    message.msgId,
    delivered,
    fundsAvailable,
    destinationTx,
    destination,
    explorerUrl,
  ]);
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
    Commitment: authorization?.commitment,
    'Security module': authorization?.ism,
  };
  const links = {
    'Token recipient': {
      hash: addressLinks?.tokenRecipient ?? token?.recipient,
      url: addressLinks?.tokenRecipientUrl,
    },
    Sender: { hash: messageSender, url: addressLinks?.senderUrl },
    Recipient: { hash: messageRecipient, url: addressLinks?.recipientUrl },
    'Message ID': {
      hash: message.msgId,
      url: explorerUrl,
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
              <CopyButton
                copyValue={hash}
                width={12}
                height={12}
                aria-label={`Copy ${label.toLowerCase()}`}
                className="text-foreground-muted [&_path]:fill-current [&_rect]:stroke-current"
              />
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
              <output className="pointer-events-none block truncate text-xxs tabular-nums text-foreground-muted">
                {subtitle}
              </output>
            )}
          </span>
          {!expanded && estimatedSeconds != null && (
            <span
              className="shrink-0 text-xxs tabular-nums text-foreground-muted"
              title={
                delivered
                  ? 'Estimated time to destination confirmation'
                  : 'Estimated time to delivery'
              }
            >
              {formatEstimatedTime(estimatedSeconds)}
            </span>
          )}
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
            lifecycle={lifecycle}
            status={subtitle}
            confirmationSummary={confirmationSummary}
            selectedRelayer={selectedRelayer || relay?.relayer || ''}
            onSelectRelayer={setSelectedRelayer}
            onAdvancedToggle={setAdvancedExpanded}
          >
            <div className="mt-3">
              <h3 className="text-xxs text-foreground-muted">Transaction details</h3>
              {metadata}
              {addressLinksError && (
                <p className="mt-2 text-xxs text-foreground-muted">Address links unavailable.</p>
              )}
            </div>
          </MessageRelayProgress>
          {!primary && explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xxs underline"
            >
              Track on Hyperlane Explorer <Image src={LinkIcon} width={12} height={12} alt="" />
            </a>
          )}
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
  estimatedSeconds,
}: ReturnType<typeof useTransactionConfirmations>): string {
  if (!data) return isError ? 'Temporarily unavailable' : 'Checking…';
  if (data.confirmations != null && data.required != null)
    return data.state === ProgressState.Confirmed
      ? `Confirmed (${data.required}/${data.required})`
      : `${data.confirmations}/${data.required} blocks${estimatedSeconds != null ? ` · ${formatEstimatedTime(estimatedSeconds)} remaining` : ''}`;
  return data.reason ?? 'Waiting';
}
