import { ProtocolType } from '@hyperlane-xyz/utils';
import {
  CopyButton,
  MessageStage,
  MessageStatus,
  MessageTimeline,
  Modal,
  SpinnerIcon,
  type StageTimings,
  useAccountForChain,
  useTimeout,
  useWalletDetails,
  WideChevronIcon,
} from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { TokenIcon } from '../../components/icons/TokenIcon';
import { ModalHeader } from '../../components/layout/ModalHeader';
import LinkIcon from '../../images/icons/external-link-icon.svg';
import { Color } from '../../styles/Color';
import { formatTimestamp } from '../../utils/date';
import { getHypExplorerLink } from '../../utils/links';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName, hasPermissionlessChain } from '../chains/utils';
import { useMessageDeliveryStatus } from '../messages/useMessageDeliveryStatus';
import { useStore } from '../store';
import { tryFindToken, useWarpCore } from '../tokens/hooks';
import { TransferContext, TransferStatus } from './types';
import {
  estimateDeliverySeconds,
  formatEta,
  getIconByTransferStatus,
  getTransferStatusLabel,
  isTransferFailed,
  isTransferSent,
} from './utils';

export function TransfersDetailsModal({
  isOpen,
  onClose,
  transfer,
}: {
  isOpen: boolean;
  onClose: () => void;
  transfer: TransferContext;
}) {
  const [fromUrl, setFromUrl] = useState<string>('');
  const [toUrl, setToUrl] = useState<string>('');
  const [originTxUrl, setOriginTxUrl] = useState<string>('');
  const [destTxUrl, setDestTxUrl] = useState<string>('');

  const {
    status,
    origin,
    destination,
    amount,
    sender,
    recipient,
    originTokenAddressOrDenom,
    originTxHash,
    msgId,
    timestamp,
    destinationTxHash: storedDestTxHash,
  } = transfer || {};

  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();
  const transfers = useStore((s) => s.transfers);
  const updateTransferStatus = useStore((s) => s.updateTransferStatus);

  // Find the index of this transfer in the store (for updating status)
  const transferIndex = useMemo(
    () => transfers.findIndex((t) => t === transfer || (t.msgId && t.msgId === msgId)),
    [transfers, transfer, msgId],
  );

  const isChainKnown = multiProvider.hasChain(origin);
  const account = useAccountForChain(multiProvider, isChainKnown ? origin : undefined);
  const walletDetails = useWalletDetails()[account?.protocol || ProtocolType.Ethereum];

  // Query delivery status from GraphQL when modal is open for sent transfers
  const isSent = isTransferSent(status);
  const isFailed = isTransferFailed(status);
  const shouldTrackDelivery = isSent && !isFailed && !!msgId;

  const delivery = useMessageDeliveryStatus(
    shouldTrackDelivery ? msgId : undefined,
    isOpen,
    multiProvider,
  );

  // Determine message stage from delivery data + transfer status
  // We use our own logic instead of the widget's useMessageStage to avoid
  // broken Explorer REST API dependencies (queryExplorerForBlock, /latest-nonce)
  const { stage, timings } = useMemo((): { stage: MessageStage; timings: StageTimings } => {
    const defaultTimings: StageTimings = {
      [MessageStage.Finalized]: null,
      [MessageStage.Validated]: null,
      [MessageStage.Relayed]: null,
    };

    if (delivery.isDelivered) {
      return { stage: MessageStage.Relayed, timings: defaultTimings };
    }
    // Once origin tx is confirmed, we're at least at Sent stage
    if (isSent && originTxHash) {
      return { stage: MessageStage.Sent, timings: defaultTimings };
    }
    return { stage: MessageStage.Preparing, timings: defaultTimings };
  }, [delivery.isDelivered, isSent, originTxHash]);

  // Update store when delivery is confirmed
  const hasUpdatedDelivery = useRef(false);
  useEffect(() => {
    if (
      delivery.isDelivered &&
      !hasUpdatedDelivery.current &&
      status !== TransferStatus.Delivered &&
      transferIndex >= 0
    ) {
      hasUpdatedDelivery.current = true;
      updateTransferStatus(transferIndex, TransferStatus.Delivered, {
        destinationTxHash: delivery.destinationTxHash,
      });
    }
  }, [
    delivery.isDelivered,
    delivery.destinationTxHash,
    transferIndex,
    status,
    updateTransferStatus,
  ]);

  // Resolve the destination tx hash from either store or live query
  const destinationTxHash = storedDestTxHash || delivery.destinationTxHash;

  useEffect(() => {
    if (!transfer) return;
    let cancelled = false;

    const fetchUrls = async () => {
      try {
        setFromUrl('');
        setToUrl('');
        setOriginTxUrl('');
        setDestTxUrl('');
        if (originTxHash) {
          const txUrl = multiProvider.tryGetExplorerTxUrl(origin, { hash: originTxHash });
          if (txUrl && !cancelled) setOriginTxUrl(fixDoubleSlash(txUrl));
        }
        if (destinationTxHash) {
          const txUrl = multiProvider.tryGetExplorerTxUrl(destination, {
            hash: destinationTxHash,
          });
          if (txUrl && !cancelled) setDestTxUrl(fixDoubleSlash(txUrl));
        }
        const [fetchedFromUrl, fetchedToUrl] = await Promise.all([
          multiProvider.tryGetExplorerAddressUrl(origin, sender),
          multiProvider.tryGetExplorerAddressUrl(destination, recipient),
        ]);
        if (cancelled) return;
        if (fetchedFromUrl) setFromUrl(fixDoubleSlash(fetchedFromUrl));
        if (fetchedToUrl) setToUrl(fixDoubleSlash(fetchedToUrl));
      } catch (error) {
        logger.error('Error fetching URLs:', error);
      }
    };

    fetchUrls();
    return () => {
      cancelled = true;
    };
  }, [
    transfer,
    multiProvider,
    origin,
    destination,
    originTxHash,
    destinationTxHash,
    sender,
    recipient,
  ]);

  const isAccountReady = !!account?.isReady;
  const connectorName = walletDetails.name || 'wallet';
  const token = tryFindToken(warpCore, origin, originTokenAddressOrDenom);
  const isPermissionlessRoute = hasPermissionlessChain(multiProvider, [destination, origin]);
  const isFinal = isSent || isFailed;
  const currentStatus = delivery.isDelivered ? TransferStatus.Delivered : status;
  const statusDescription = getTransferStatusLabel(
    currentStatus,
    connectorName,
    isPermissionlessRoute,
    isAccountReady,
  );
  const showSignWarning = useSignIssueWarning(status);

  const date = useMemo(
    () => (timestamp ? formatTimestamp(timestamp) : formatTimestamp(new Date().getTime())),
    [timestamp],
  );

  const explorerLink = getHypExplorerLink(multiProvider, origin, msgId);

  // ETA: only show when confirmed on origin but not yet delivered
  const showEta =
    currentStatus === TransferStatus.ConfirmedTransfer && !delivery.isDelivered && !isFailed;
  const etaSeconds = useMemo(
    () => (showEta ? estimateDeliverySeconds(origin, destination, multiProvider) : null),
    [showEta, origin, destination, multiProvider],
  );

  // Show timeline for sent (non-failed) transfers that have an origin tx hash
  const showTimeline = isSent && !isFailed && !!originTxHash;
  const messageStatus = delivery.isDelivered
    ? MessageStatus.Delivered
    : isFailed
      ? MessageStatus.Failing
      : MessageStatus.Pending;

  return (
    <Modal isOpen={isOpen} close={onClose} panelClassname="max-w-sm">
      <ModalHeader className="h-8 shadow-accent-glow" />
      <div className="p-4">
        {isFinal && (
          <div className="flex justify-between">
            <h2 className="text-xs font-normal text-gray-900">{date}</h2>
            <div className="flex items-center text-xs font-normal">
              {isSent ? (
                <h3 className="text-green-50">{delivery.isDelivered ? 'Delivered' : 'Sent'}</h3>
              ) : (
                <h3 className="text-red-500">Failed</h3>
              )}
              <Image
                src={getIconByTransferStatus(currentStatus)}
                width={16}
                height={16}
                alt=""
                className="ml-2"
              />
            </div>
          </div>
        )}

        <div>
          <div className="mt-4 flex w-full items-center justify-center rounded-sm border border-gray-400/25 bg-card-gradient py-2 shadow-card">
            <TokenIcon token={token} size={24} />
            <div className="items ml-2 flex items-baseline font-secondary text-sm font-normal">
              <span>{amount}</span>
              <span className="ml-1">{token?.symbol}</span>
            </div>
          </div>

          <div className="-mt-2 flex items-center justify-around rounded-sm border border-gray-400/25 bg-card-gradient py-5 shadow-card">
            <div className="ml-2 flex flex-col items-center">
              <ChainLogo chainName={origin} size={36} />
              <span className="mt-1 text-xs font-normal tracking-wider">
                {getChainDisplayName(multiProvider, origin, true)}
              </span>
            </div>
            <div className="mb-6 flex sm:space-x-1.5">
              <WideChevron />
              <WideChevron />
            </div>
            <div className="mr-2 flex flex-col items-center">
              <ChainLogo chainName={destination} size={36} />
              <span className="mt-1 text-xs font-normal tracking-wider">
                {getChainDisplayName(multiProvider, destination, true)}
              </span>
            </div>
          </div>
        </div>

        {showTimeline && (
          <div className="mt-4 rounded border border-gray-400/25 bg-card-gradient p-3 shadow-card">
            <h4 className="mb-1 font-secondary text-sm text-gray-900">Status</h4>
            <div className="flex w-full flex-col items-center justify-center [&_h4]:text-[clamp(0.625rem,0.7rem,0.75rem)]">
              <MessageTimeline
                status={messageStatus}
                stage={stage}
                timings={timings}
                timestampSent={delivery.originTimestamp}
                hideDescriptions={true}
                iconPosition="inline"
                barClassName="bg-accent-gradient"
                chevronColor="#A62AFF"
              />
            </div>
            {showEta && etaSeconds && (
              <p className="mt-2 text-center text-xs text-gray-500">
                Est. delivery: {formatEta(etaSeconds)}
              </p>
            )}
          </div>
        )}

        {isFinal ? (
          <div className="mt-5 flex flex-col space-y-4">
            <TransferProperty name="Sender Address" value={sender} url={fromUrl} />
            <TransferProperty name="Recipient Address" value={recipient} url={toUrl} />
            {originTxHash && (
              <TransferProperty
                name="Origin Transaction Hash"
                value={originTxHash}
                url={originTxUrl}
              />
            )}
            {destinationTxHash && (
              <TransferProperty
                name="Destination Transaction Hash"
                value={destinationTxHash}
                url={destTxUrl}
              />
            )}
            {msgId && <TransferProperty name="Message ID" value={msgId} />}
            {explorerLink && (
              <div className="flex justify-center">
                <span className="text-xxs leading-normal tracking-wider text-primary-500">
                  <a
                    className="text-xs leading-normal tracking-wider text-primary-500 underline-offset-2 hover:opacity-80 active:opacity-70"
                    href={explorerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View in Explorer
                  </a>
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4">
            <SpinnerIcon width={60} height={60} className="mt-3" />
            <div className="mt-5 text-center text-sm text-gray-600">{statusDescription}</div>
            {showSignWarning && (
              <div className="mt-3 text-center text-sm text-gray-600">
                If your wallet does not show a transaction request or never confirms, please try the
                transfer again.
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function TransferProperty({ name, value, url }: { name: string; value: string; url?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs leading-normal tracking-wider text-gray-350">{name}</label>
        <div className="flex items-center space-x-2">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Image src={LinkIcon} width={14} height={14} alt="" />
            </a>
          )}
          <CopyButton copyValue={value} width={14} height={14} className="opacity-40" />
        </div>
      </div>
      <div className="mt-1 truncate text-xs leading-normal tracking-wider text-gray-900">
        {value}
      </div>
    </div>
  );
}

function WideChevron() {
  return (
    <WideChevronIcon
      width="16"
      height="100%"
      direction="e"
      color={Color.gray['300']}
      rounded={true}
    />
  );
}

// https://github.com/wagmi-dev/wagmi/discussions/2928
function useSignIssueWarning(status: TransferStatus) {
  const [showWarning, setShowWarning] = useState(false);
  const warningCallback = useCallback(() => {
    if (status === TransferStatus.SigningTransfer || status === TransferStatus.ConfirmingTransfer)
      setShowWarning(true);
  }, [status, setShowWarning]);
  useTimeout(warningCallback, 20_000);
  return showWarning;
}

// TODO cosmos fix double slash problem in ChainMetadataManager
// Occurs when baseUrl has not other path (e.g. for manta explorer)
function fixDoubleSlash(url: string) {
  return url.replace(/([^:]\/)\/+/g, '$1');
}
