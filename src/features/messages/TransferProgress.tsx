import { CopyButton } from '@hyperlane-xyz/widgets';

import { getHypExplorerLink } from '../../utils/links';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { useStore } from '../store';
import type { LabeledMsgId, TransferHistoryItem } from '../transfer/engine/types';
import { decodeAuthorizationBody, decodeTransferBody, ProgressState } from './progress';
import { useEvmMailboxDeliveryStatus } from './useEvmMailboxDeliveryStatus';
import { useMessageDeliveryStatus } from './useMessageDeliveryStatus';
import { useSolanaMailboxDeliveryStatus } from './useSolanaMailboxDeliveryStatus';
import { useTransactionConfirmations } from './useTransactionConfirmations';

const MESSAGE_LABELS: Record<LabeledMsgId['label'], string> = {
  warp: 'Bridge funds',
  bridge: 'Bridge funds',
  commit: 'Commit authorization',
  reveal: 'Reveal authorization',
};

export function TransferProgress({
  transfer,
  enabled,
}: {
  transfer: TransferHistoryItem;
  enabled: boolean;
}) {
  return (
    <section
      aria-label="Transfer progress"
      className="mt-4 space-y-2 rounded border border-gray-400/25 bg-card-gradient p-3 shadow-card"
    >
      <h4 className="font-secondary text-sm">Messages</h4>
      {transfer.msgIds?.map((message) => (
        <MessageProgressRow
          key={message.msgId}
          message={message}
          transfer={transfer}
          enabled={enabled}
        />
      ))}
    </section>
  );
}

function MessageProgressRow({
  message,
  transfer,
  enabled,
}: {
  message: LabeledMsgId;
  transfer: TransferHistoryItem;
  enabled: boolean;
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
  const originTx = indexed.message?.originTxHash ?? transfer.originTxHash;
  const destinationTx = indexed.destinationTxHash ?? evm.destinationTxHash;
  const originConfirmation = useTransactionConfirmations(origin, originTx, enabled);
  const destinationConfirmation = useTransactionConfirmations(destination, destinationTx, enabled);
  const delivered = indexed.isDelivered || evm.isDelivered || solana.isDelivered;
  const deliveryMissing =
    destinationConfirmation.data?.included === false ||
    destinationConfirmation.data?.state === ProgressState.Failed;
  const confirmed =
    delivered &&
    !deliveryMissing &&
    !destinationConfirmation.isError &&
    destinationConfirmation.data?.state === ProgressState.Confirmed;
  const status = deliveryMissing
    ? 'Rechecking delivery'
    : confirmed
      ? 'Confirmed'
      : delivered
        ? 'Delivered'
        : indexed.error
          ? 'Status unavailable'
          : 'Awaiting delivery';
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
    <details className="rounded border border-gray-400/25 px-3 py-2 text-xs">
      <summary className="cursor-pointer marker:text-gray-500">
        <span className="ml-1 font-medium">{MESSAGE_LABELS[message.label]}</span>
        <span
          className={`float-right ${delivered && !deliveryMissing ? 'text-green-50' : 'text-gray-500'}`}
        >
          {status}
        </span>
        <span className="ml-4 mt-1 block text-xxs text-gray-500">
          {origin ? getChainDisplayName(multiProvider, origin, true) : 'Origin'} →{' '}
          {destination ? getChainDisplayName(multiProvider, destination, true) : 'Destination'}
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
            <div key={label}>
              <dt className="text-gray-500">{label}</dt>
              <dd className="mt-1 flex items-center gap-2">
                <a
                  className="truncate underline"
                  href={url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {hash}
                </a>
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
