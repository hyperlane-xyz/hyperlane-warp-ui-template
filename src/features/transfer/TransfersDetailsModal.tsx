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
import LinkIcon from '../../images/icons/external-link-icon.svg';
import { Color } from '../../styles/Color';
import { formatTimestamp } from '../../utils/date';
import { getHypExplorerLink } from '../../utils/links';
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

  const getMessageUrls = useCallback(async () => {
    try {
      if (originTxHash) {
        const originTxUrl = multiProvider.tryGetExplorerTxUrl(origin, { hash: originTxHash });
        if (originTxUrl) setOriginTxUrl(fixDoubleSlash(originTxUrl));
      }
      const [fromUrl, toUrl] = await Promise.all([
        multiProvider.tryGetExplorerAddressUrl(origin, sender),
        multiProvider.tryGetExplorerAddressUrl(destination, recipient),
      ]);
      if (fromUrl) setFromUrl(fixDoubleSlash(fromUrl));
      if (toUrl) setToUrl(fixDoubleSlash(toUrl));
    } catch (error) {
      logger.error('Error fetching URLs:', error);
    }
  }, [sender, recipient, originTxHash, multiProvider, origin, destination]);

  useEffect(() => {
    if (!transfer) return;
    getMessageUrls().catch((err) =>
      logger.error('Error getting message URLs for details modal', err),
    );
  }, [transfer, getMessageUrls]);

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

  return (
    <Modal isOpen={isOpen} close={onClose} panelClassname="p-4 md:p-5 max-w-sm">
      {isFinal && (
        <div className="flex justify-between">
          <h2 className="font-medium text-gray-600">{date}</h2>
          <div className="flex items-center font-medium">
            {isSent ? (
              <h3 className="text-primary-500">Sent</h3>
            ) : (
              <h3 className="text-red-500">Failed</h3>
            )}
            <Image
              src={getIconByTransferStatus(status)}
              width={25}
              height={25}
              alt=""
              className="ml-2"
            />
          </div>
        </div>
      )}

      <div className="mt-4 flex w-full items-center justify-center rounded-full bg-primary-200 p-3">
        <TokenIcon token={token} size={30} />
        <div className="items ml-2 flex items-baseline">
          <span className="text-xl font-medium">{amount}</span>
          <span className="ml-1 text-xl font-medium">{token?.symbol}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-around">
        <div className="ml-2 flex flex-col items-center">
          <ChainLogo chainName={origin} size={64} background={true} />
          <span className="mt-1 font-medium tracking-wider">
            {getChainDisplayName(multiProvider, origin, true)}
          </span>
        </div>
        <div className="mb-6 flex sm:space-x-1.5">
          <WideChevron />
          <WideChevron />
        </div>
        <div className="mr-2 flex flex-col items-center">
          <ChainLogo chainName={destination} size={64} background={true} />
          <span className="mt-1 font-medium tracking-wider">
            {getChainDisplayName(multiProvider, destination, true)}
          </span>
        </div>
      </div>

      {isFinal ? (
        <div className="mt-5 flex flex-col space-y-4">
          <TransferProperty name="Sender Address" value={sender} url={fromUrl} />
          <TransferProperty name="Recipient Address" value={recipient} url={toUrl} />
          {token?.addressOrDenom && (
            <TransferProperty name="Token Address or Denom" value={token.addressOrDenom} />
          )}
          {originTxHash && (
            <TransferProperty
              name="Origin Transaction Hash"
              value={originTxHash}
              url={originTxUrl}
            />
          )}
          {msgId && <TransferProperty name="Message ID" value={msgId} />}
          {explorerLink && (
            <div className="flex justify-between">
              <span className="text-xs leading-normal tracking-wider text-gray-350">
                <a
                  className="text-xs leading-normal tracking-wider text-gray-350 underline underline-offset-2 hover:opacity-80 active:opacity-70"
                  href={explorerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View message in Hyperlane Explorer
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
        <label className="text-sm leading-normal tracking-wider text-gray-350">{name}</label>
        <div className="flex items-center space-x-2">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Image src={LinkIcon} width={14} height={14} alt="" />
            </a>
          )}
          <CopyButton copyValue={value} width={14} height={14} className="opacity-40" />
        </div>
      </div>
      <div className="mt-1 truncate text-sm leading-normal tracking-wider">{value}</div>
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
