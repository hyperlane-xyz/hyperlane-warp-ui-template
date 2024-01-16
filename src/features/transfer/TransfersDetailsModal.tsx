import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { isZeroishAddress, toTitleCase } from '@hyperlane-xyz/utils';
import { MessageStatus, MessageTimeline, useMessageTimeline } from '@hyperlane-xyz/widgets';

import { Spinner } from '../../components/animation/Spinner';
import { CopyButton } from '../../components/buttons/CopyButton';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { TokenIcon } from '../../components/icons/TokenIcon';
import { WideChevron } from '../../components/icons/WideChevron';
import { Modal } from '../../components/layout/Modal';
import LinkIcon from '../../images/icons/external-link-icon.svg';
import { formatTimestamp } from '../../utils/date';
import { getHypExplorerLink } from '../../utils/links';
import { logger } from '../../utils/logger';
import { useTimeout } from '../../utils/timeout';
import {
  getIconByTransferStatus,
  getTransferStatusLabel,
  isTransferFailed,
  isTransferSent,
} from '../../utils/transfer';
import { getChainReference } from '../caip/chains';
import { AssetNamespace, parseCaip19Id } from '../caip/tokens';
import { getChainDisplayName, hasPermissionlessChain } from '../chains/utils';
import { getMultiProvider } from '../multiProvider';
import { getToken } from '../tokens/metadata';
import { useAccountForChain } from '../wallet/hooks/multiProtocol';

import { TransferContext, TransferStatus } from './types';

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

  const { params, status, originTxHash, msgId, timestamp, activeAccountAddress } = transfer || {};
  const { destinationCaip2Id, originCaip2Id, tokenCaip19Id, amount, recipientAddress } =
    params || {};

  const account = useAccountForChain(originCaip2Id);
  const multiProvider = getMultiProvider();
  const originChain = getChainReference(originCaip2Id);
  const destChain = getChainReference(destinationCaip2Id);
  const { address: tokenAddress, namespace: tokenNamespace } = parseCaip19Id(tokenCaip19Id);
  const isNative = tokenNamespace === AssetNamespace.native || isZeroishAddress(tokenAddress);

  const getMessageUrls = useCallback(async () => {
    try {
      if (originTxHash) {
        const originTxUrl = multiProvider.tryGetExplorerTxUrl(originChain, { hash: originTxHash });
        if (originTxUrl) setOriginTxUrl(fixDoubleSlash(originTxUrl));
      }
      const [fromUrl, toUrl] = await Promise.all([
        multiProvider.tryGetExplorerAddressUrl(originChain, activeAccountAddress),
        multiProvider.tryGetExplorerAddressUrl(destChain, recipientAddress),
      ]);
      if (fromUrl) setFromUrl(fixDoubleSlash(fromUrl));
      if (toUrl) setToUrl(fixDoubleSlash(toUrl));
    } catch (error) {
      logger.error('Error fetching URLs:', error);
    }
  }, [activeAccountAddress, originTxHash, multiProvider, recipientAddress, originChain, destChain]);

  useEffect(() => {
    if (!transfer) return;
    getMessageUrls().catch((err) =>
      logger.error('Error getting message URLs for details modal', err),
    );
  }, [transfer, getMessageUrls]);

  const isAccountReady = !!account?.isReady;
  const connectorName = account?.connectorName || 'wallet';
  const token = getToken(tokenCaip19Id);

  const isPermissionlessRoute = hasPermissionlessChain([destinationCaip2Id, originCaip2Id]);

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

  const explorerLink = getHypExplorerLink(originCaip2Id, msgId);

  return (
    <Modal
      showCloseBtn={false}
      isOpen={isOpen}
      close={onClose}
      title=""
      padding="p-4 md:p-5"
      width="max-w-sm"
    >
      {isFinal && (
        <div className="flex justify-between">
          <h2 className="text-gray-600 font-medium">{date}</h2>
          <div className="flex items-center font-medium">
            {isSent ? (
              <h3 className="text-blue-500">Sent</h3>
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

      <div className="mt-4 p-3 flex items-center justify-center w-full rounded-full bg-blue-200">
        <TokenIcon token={token} size={30} />
        <div className="ml-2 flex items items-baseline">
          <span className="text-xl font-medium">{amount}</span>
          <span className="text-xl font-medium ml-1">{token?.symbol || ''}</span>
          <span className="font-semibold ml-1">({toTitleCase(tokenNamespace)})</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-around">
        <div className="ml-2 flex flex-col items-center">
          <ChainLogo chainCaip2Id={originCaip2Id} size={64} background={true} />
          <span className="mt-1 font-medium tracking-wider">
            {getChainDisplayName(originCaip2Id, true)}
          </span>
        </div>
        <div className="flex mb-6 sm:space-x-1.5">
          <WideChevron />
          <WideChevron />
        </div>
        <div className="mr-2 flex flex-col items-center">
          <ChainLogo chainCaip2Id={destinationCaip2Id} size={64} background={true} />
          <span className="mt-1 font-medium tracking-wider">
            {getChainDisplayName(destinationCaip2Id, true)}
          </span>
        </div>
      </div>

      {isFinal ? (
        <div className="mt-5 flex flex-col space-y-4">
          <TransferProperty name="Sender Address" value={activeAccountAddress} url={fromUrl} />
          <TransferProperty name="Recipient Address" value={recipientAddress} url={toUrl} />
          {!isNative && <TransferProperty name="Token Address" value={tokenAddress} />}
          {originTxHash && (
            <TransferProperty
              name="Origin Transaction Hash"
              value={originTxHash}
              url={originTxUrl}
            />
          )}
          {explorerLink && (
            <div className="flex justify-between">
              <span className="text-gray-350 text-xs leading-normal tracking-wider">
                <a
                  className="text-gray-350 text-xs leading-normal tracking-wider underline underline-offset-2 hover:opacity-80 active:opacity-70"
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
        <div className="py-4 flex flex-col justify-center items-center">
          <Spinner />
          <div
            className={`mt-5 text-sm text-center ${
              status === TransferStatus.Failed ? 'text-red-600' : 'text-gray-600'
            }`}
          >
            {statusDescription}
          </div>
          {showSignWarning && (
            <div className="mt-3 text-sm text-center text-gray-600">
              If your wallet does not show a transaction request, please try the transfer again.
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
  const { stage, timings, message } = useMessageTimeline({
    originTxHash: isFailed ? undefined : originTxHash,
  });
  const messageStatus = isFailed ? MessageStatus.Failing : message?.status || MessageStatus.Pending;

  return (
    <div className="mt-6 mb-2 w-full flex flex-col justify-center items-center timeline-container">
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
      <div className="flex justify-between items-center">
        <label className="text-gray-350 text-sm leading-normal tracking-wider">{name}</label>
        <div className="flex items-center space-x-2">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Image src={LinkIcon} width={14} height={14} alt="" />
            </a>
          )}
          <CopyButton copyValue={value} width={14} height={14} />
        </div>
      </div>
      <div className="mt-1 text-sm leading-normal tracking-wider truncate">{value}</div>
    </div>
  );
}

// TODO: Remove this once we have a better solution for wagmi signing issue
// https://github.com/wagmi-dev/wagmi/discussions/2928
function useSignIssueWarning(status: TransferStatus) {
  const [showWarning, setShowWarning] = useState(false);
  const warningCallback = useCallback(() => {
    if (status === TransferStatus.SigningTransfer) setShowWarning(true);
  }, [status, setShowWarning]);
  useTimeout(warningCallback, 20_000);
  return showWarning;
}

// TODO cosmos fix double slash problem in ChainMetadataManager
// Occurs when baseUrl has not other path (e.g. for manta explorer)
function fixDoubleSlash(url: string) {
  return url.replace(/([^:]\/)\/+/g, '$1');
}
