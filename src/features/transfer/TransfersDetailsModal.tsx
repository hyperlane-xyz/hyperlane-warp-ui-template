import { ProtocolType } from '@hyperlane-xyz/utils';
import {
  CopyButton,
  MessageStatus,
  MessageTimeline,
  Modal,
  SpinnerIcon,
  useAccountForChain,
  useMessageTimeline,
  useTimeout,
  useWalletDetails,
  WideChevronIcon,
} from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { TokenIcon } from '../../components/icons/TokenIcon';
import { ModalHeader } from '../../components/layout/ModalHeader';
import LinkIcon from '../../images/icons/external-link-icon.svg';
import { Color } from '../../styles/Color';
import { formatTimestamp } from '../../utils/date';
import { getHypExplorerLink, getHypExplorerSearchLink } from '../../utils/links';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName, hasPermissionlessChain } from '../chains/utils';
import { tryFindToken, useWarpCore } from '../tokens/hooks';
import { TransferContext, TransferStatus } from './types';
import {
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
  } = transfer || {};

  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const isChainKnown = multiProvider.hasChain(origin);
  const account = useAccountForChain(multiProvider, isChainKnown ? origin : undefined);
  const walletDetails = useWalletDetails()[account?.protocol || ProtocolType.Ethereum];

  useEffect(() => {
    if (!transfer) return;
    let cancelled = false;

    const fetchUrls = async () => {
      try {
        setFromUrl('');
        setToUrl('');
        if (originTxHash) {
          const txUrl = multiProvider.tryGetExplorerTxUrl(origin, { hash: originTxHash });
          if (txUrl && !cancelled) setOriginTxUrl(fixDoubleSlash(txUrl));
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
  }, [transfer, multiProvider, origin, destination, originTxHash, sender, recipient]);

  const isAccountReady = !!account?.isReady;
  const connectorName = walletDetails.name || 'wallet';
  const token = tryFindToken(warpCore, origin, originTokenAddressOrDenom);
  const isPermissionlessRoute = hasPermissionlessChain(multiProvider, [destination, origin]);
  const isSent = isTransferSent(status);
  const isFailed = isTransferFailed(status);
  const isFinal = isSent || isFailed;
  const statusDescription = getTransferStatusLabel(
    status,
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
  const explorerSearchLink =
    !explorerLink && (msgId || originTxHash || sender || recipient)
      ? getHypExplorerSearchLink(msgId || originTxHash || sender || recipient)
      : null;
  const hyperlaneExplorerLink = explorerLink || explorerSearchLink;

  return (
    <Modal isOpen={isOpen} close={onClose} panelClassname="max-w-sm">
      <ModalHeader className="h-8 shadow-accent-glow" />
      <div className="p-4">
        {isFinal && (
          <div className="flex justify-between">
            <h2 className="text-xs font-normal text-gray-900">{date}</h2>
            <div className="flex items-center text-xs font-normal">
              {isSent ? (
                <h3 className="text-green-50">Sent</h3>
              ) : (
                <h3 className="text-red-500">Failed</h3>
              )}
              <Image
                src={getIconByTransferStatus(status)}
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

        {isFinal ? (
          <div className="mt-5 flex flex-col space-y-4">
            <TransferProperty name="Sender Address" value={sender} url={fromUrl} />
            <TransferProperty name="Recipient Address" value={recipient} url={toUrl} />
            {/* {token?.addressOrDenom && (
              <TransferProperty name="Token Address or Denom" value={token.addressOrDenom} />
            )} */}
            {originTxHash && (
              <TransferProperty
                name="Origin Transaction Hash"
                value={originTxHash}
                url={originTxUrl}
              />
            )}
            {msgId && <TransferProperty name="Message ID" value={msgId} />}
            {hyperlaneExplorerLink && (
              <div className="flex justify-center">
                <span className="text-xxs leading-normal tracking-wider text-primary-500">
                  <a
                    className="text-xs leading-normal tracking-wider text-primary-500 underline-offset-2 hover:opacity-80 active:opacity-70"
                    href={hyperlaneExplorerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {explorerLink ? 'View in Hyperlane Explorer' : 'Search in Hyperlane Explorer'}
                  </a>
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4">
            <SpinnerIcon width={60} height={60} className="mt-3" />
            <div
              className={`mt-5 text-center text-sm ${isFailed ? 'text-red-600' : 'text-gray-600'}`}
            >
              {statusDescription}
            </div>
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

// TODO consider re-enabling timeline
export function Timeline({
  transferStatus,
  originTxHash,
}: {
  transferStatus: TransferStatus;
  originTxHash?: string;
}) {
  const isFailed = transferStatus === TransferStatus.Failed;
  const multiProtocolProvider = useMultiProvider();
  const { stage, timings, message } = useMessageTimeline({
    originTxHash: isFailed ? undefined : originTxHash,
    multiProvider: multiProtocolProvider.toMultiProvider(),
  });
  const messageStatus = isFailed ? MessageStatus.Failing : message?.status || MessageStatus.Pending;

  return (
    <div className="timeline-container mb-2 mt-6 flex w-full flex-col items-center justify-center">
      <MessageTimeline
        status={messageStatus}
        stage={stage}
        timings={timings}
        timestampSent={message?.origin?.timestamp}
        hideDescriptions={true}
      />
    </div>
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
