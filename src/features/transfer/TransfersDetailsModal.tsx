import { ProtocolType } from '@hyperlane-xyz/utils';
import { CopyButton } from '@hyperlane-xyz/widgets/components/CopyButton';
import { SpinnerIcon } from '@hyperlane-xyz/widgets/icons/Spinner';
import { WideChevronIcon } from '@hyperlane-xyz/widgets/icons/WideChevron';
import { Modal } from '@hyperlane-xyz/widgets/layout/Modal';
import { MessageTimeline } from '@hyperlane-xyz/widgets/messages/MessageTimeline';
import type { StageTimings } from '@hyperlane-xyz/widgets/messages/types';
import { MessageStage, MessageStatus } from '@hyperlane-xyz/widgets/messages/types';
import { useTimeout } from '@hyperlane-xyz/widgets/utils/timeout';
import {
  useAccountForChain,
  useWalletDetails,
} from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ChainLogo } from '../../components/icons/ChainLogo';
import { ModalHeader } from '../../components/layout/ModalHeader';
import ArrowRightIcon from '../../images/icons/arrow-right.svg';
import LinkIcon from '../../images/icons/external-link-icon.svg';
import { Color } from '../../styles/Color';
import { formatTimestamp } from '../../utils/date';
import { getHypExplorerLink } from '../../utils/links';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName, hasPermissionlessChain } from '../chains/utils';
import { useMessageDeliveryStatus } from '../messages/useMessageDeliveryStatus';
import { useOriginFinality } from '../messages/useOriginFinality';
import { useStore } from '../store';
import { tryFindToken, useWarpCore } from '../tokens/hooks';
import { TokenChainIcon } from '../tokens/TokenChainIcon';
import { TransferContext, TransferStatus } from './types';
import {
  estimateDeliverySeconds,
  formatEta,
  getIconByTransferStatus,
  getTransferStatusLabel,
  isTransferFailed,
  isTransferSent,
} from './utils';

const DEFAULT_TIMINGS: StageTimings = {
  [MessageStage.Finalized]: null,
  [MessageStage.Validated]: null,
  [MessageStage.Relayed]: null,
};

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
    destTokenAddressOrDenom,
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
    () => transfers.findIndex((t) => t === transfer || (t.msgId && t.msgId === transfer?.msgId)),
    [transfers, transfer],
  );

  const isChainKnown = multiProvider.hasChain(origin);
  const account = useAccountForChain(multiProvider, isChainKnown ? origin : undefined);
  const walletDetails = useWalletDetails()[account?.protocol || ProtocolType.Ethereum];

  // Query delivery status from GraphQL when modal is open for sent transfers
  const isSent = isTransferSent(transfer?.status);
  const isFailed = isTransferFailed(transfer?.status);
  const shouldTrackDelivery = isSent && !isFailed && !!msgId;

  const delivery = useMessageDeliveryStatus(
    shouldTrackDelivery ? msgId : undefined,
    isOpen,
    multiProvider,
  );

  // Combine store + live query to avoid flicker when reopening modal
  const isDelivered = status === TransferStatus.Delivered || delivery.isDelivered;

  // Origin block number: prefer store (hot path), fall back to GraphQL (cold path after refresh)
  const originBlockNumber = transfer?.originBlockNumber ?? delivery.originBlockHeight;

  const isFinalized = useOriginFinality(
    origin,
    originBlockNumber,
    isSent && !isFailed && !isDelivered && !!originBlockNumber && isOpen,
  );

  const stage = useMemo((): MessageStage => {
    if (isDelivered) return MessageStage.Relayed;
    if (isFinalized) return MessageStage.Finalized;
    if (isTransferSent(transfer?.status) && transfer?.originTxHash) return MessageStage.Sent;
    return MessageStage.Preparing;
  }, [isDelivered, isFinalized, transfer]);

  // Resolve the destination tx hash from either store or live query
  const destinationTxHash = storedDestTxHash || delivery.destinationTxHash;

  const isAccountReady = !!account?.isReady;
  const connectorName = walletDetails.name || 'wallet';
  const token = tryFindToken(warpCore, origin, originTokenAddressOrDenom);
  const destToken = tryFindToken(warpCore, destination, destTokenAddressOrDenom);
  const isPermissionlessRoute = hasPermissionlessChain(multiProvider, [destination, origin]);
  const isFinal = isSent || isFailed;
  const currentStatus = isDelivered ? TransferStatus.Delivered : status;
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
  const showEta = currentStatus === TransferStatus.ConfirmedTransfer && !isDelivered && !isFailed;
  const etaSeconds = useMemo(
    () => (showEta ? estimateDeliverySeconds(origin, destination, multiProvider) : null),
    [showEta, origin, destination, multiProvider],
  );

  // Show timeline for sent (non-failed) transfers that have an origin tx hash
  const showTimeline = isSent && !isFailed && !!originTxHash;
  const messageStatus = isDelivered
    ? MessageStatus.Delivered
    : isFailed
      ? MessageStatus.Failing
      : MessageStatus.Pending;

  // Reset delivery tracking when viewing a different transfer
  const hasUpdatedDelivery = useRef(false);
  useEffect(() => {
    hasUpdatedDelivery.current = false;
  }, [msgId]);

  // Update store when delivery is confirmed
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

  // Fetch explorer URLs for addresses and transactions
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

  return (
    <Modal isOpen={isOpen} close={onClose} panelClassname="transfer-details-modal max-w-sm">
      <ModalHeader className="h-8 shadow-accent-glow" />
      <div className="p-4">
        {isFinal && (
          <div className="flex justify-between">
            <h2 className="text-xs font-normal text-gray-900">{date}</h2>
            <div className="flex items-center text-xs font-normal">
              {isSent ? (
                <h3 className="text-green-50">{isDelivered ? 'Delivered' : 'Sent'}</h3>
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
            <div className="flex items-center font-secondary text-sm font-normal">
              <span>{amount}</span>
              <span className="ml-1">{token?.symbol || ''}</span>
              {destToken && (
                <>
                  <Image className="mx-2" src={ArrowRightIcon} width={10} height={10} alt="" />
                  <span>{amount}</span>
                  <span className="ml-1">{destToken.symbol}</span>
                </>
              )}
            </div>
          </div>

          <div className="-mt-2 grid grid-cols-[1fr_auto_1fr] items-center rounded-sm border border-gray-400/25 bg-card-gradient py-5 shadow-card">
            <div className="flex flex-col items-center">
              {token ? (
                <TokenChainIcon token={token} size={36} />
              ) : (
                <ChainLogo chainName={origin} size={36} />
              )}
              <span className="mt-1 text-xs font-medium tracking-wider">{token?.symbol || ''}</span>
              <span className="text-xxs font-normal tracking-wider text-gray-500">
                {getChainDisplayName(multiProvider, origin, true)}
              </span>
            </div>
            <div className="mb-6 flex justify-center sm:space-x-1.5">
              <WideChevron />
              <WideChevron />
            </div>
            <div className="flex flex-col items-center">
              {destToken ? (
                <TokenChainIcon token={destToken} size={36} />
              ) : (
                <ChainLogo chainName={destination} size={36} />
              )}
              <span className="mt-1 text-xs font-medium tracking-wider">
                {destToken?.symbol || ''}
              </span>
              <span className="text-xxs font-normal tracking-wider text-gray-500">
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
                timings={DEFAULT_TIMINGS}
                timestampSent={delivery.originTimestamp}
                hideDescriptions={true}
                iconPosition="inline"
                barClassName="bg-accent-gradient"
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
            <SpinnerIcon width={60} height={60} className="transfer-details-spinner mt-3" />
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
