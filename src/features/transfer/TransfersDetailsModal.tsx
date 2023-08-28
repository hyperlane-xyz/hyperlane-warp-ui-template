import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { MessageStatus, MessageTimeline, useMessageTimeline } from '@hyperlane-xyz/widgets';

import { ChainLogo } from '../../components/icons/ChainLogo';
import { Modal } from '../../components/layout/Modal';
import ArrowRightIcon from '../../images/icons/arrow-right.svg';
import LinkIcon from '../../images/icons/external-link-icon.svg';
import { formatTimestamp } from '../../utils/date';
import { getHypExplorerLink } from '../../utils/links';
import { logger } from '../../utils/logger';
import { toTitleCase } from '../../utils/string';
import { useTimeout } from '../../utils/timeout';
import { getTransferStatusLabel } from '../../utils/transfer';
import { getChainReference } from '../caip/chains';
import { AssetNamespace, parseCaip19Id } from '../caip/tokens';
import { getChainDisplayName, hasPermissionlessChain } from '../chains/utils';
import { getMultiProvider } from '../multiProvider';
import { getToken } from '../tokens/metadata';
import { useAccountForChain } from '../wallet/hooks';

import { TransferStatusIcon } from './components/TransferStatusIcon';
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
  const [tokenUrl, setTokenUrl] = useState<string>('');
  const [originTxUrl, setOriginTxUrl] = useState<string>('');

  const { params, status, originTxHash, msgId, timestamp, activeAccountAddress } = transfer || {};
  const { destinationCaip2Id, originCaip2Id, tokenCaip19Id, amount, recipientAddress } =
    params || {};

  const account = useAccountForChain(originCaip2Id);
  const multiProvider = getMultiProvider();
  const originChain = getChainReference(originCaip2Id);
  const destChain = getChainReference(destinationCaip2Id);
  const { address: tokenAddress, namespace: tokenNamespace } = parseCaip19Id(tokenCaip19Id);
  const isNative = tokenNamespace === AssetNamespace.native;

  const getFormUrls = useCallback(async () => {
    try {
      if (originTxHash) {
        const originTx = multiProvider.tryGetExplorerTxUrl(originChain, { hash: originTxHash });
        if (originTx) setOriginTxUrl(originTx);
      }
      const [fromUrl, toUrl, tokenUrl] = await Promise.all([
        multiProvider.tryGetExplorerAddressUrl(originChain, activeAccountAddress),
        multiProvider.tryGetExplorerAddressUrl(destChain, recipientAddress),
        multiProvider.tryGetExplorerAddressUrl(originChain, tokenAddress),
      ]);
      if (fromUrl) setFromUrl(fromUrl);
      if (toUrl) setToUrl(toUrl);
      if (tokenUrl) setTokenUrl(tokenUrl);
    } catch (error) {
      logger.error('Error fetching URLs:', error);
    }
  }, [
    activeAccountAddress,
    originTxHash,
    multiProvider,
    recipientAddress,
    originChain,
    destChain,
    tokenAddress,
  ]);

  useEffect(() => {
    if (!transfer) return;
    getFormUrls().catch((err) => logger.error(err));
  }, [transfer, getFormUrls]);

  const isAccountReady = !!account?.isReady;
  const connectorName = account?.connectorName || 'wallet';

  const isPermissionlessRoute = hasPermissionlessChain([destinationCaip2Id, originCaip2Id]);

  const explorerLink = getHypExplorerLink(originCaip2Id, msgId);
  const statusDescription = getTransferStatusLabel(
    status,
    connectorName,
    isPermissionlessRoute,
    isAccountReady,
  );
  const date = useMemo(
    () => (timestamp ? formatTimestamp(timestamp) : formatTimestamp(new Date().getTime())),
    [timestamp],
  );
  const token = getToken(tokenCaip19Id);

  const showSignWarning = useSignIssueWarning(status);

  return (
    <Modal
      showCloseBtn={false}
      isOpen={isOpen}
      close={onClose}
      title=""
      padding="p-4 md:p-6"
      width="max-w-xl-1"
    >
      <div className="flex flex-row items-center justify-between">
        <div className="flex">
          <ChainLogo chainCaip2Id={originCaip2Id} size={22} />
          <div className="flex items items-baseline">
            <span className="text-black text-base font-normal ml-1">{amount}</span>
            <span className="text-black text-base font-normal ml-1">{token?.symbol || ''}</span>
            <span className="text-black text-xs font-normal ml-1">
              ({toTitleCase(tokenNamespace)})
            </span>
          </div>
        </div>
        <div className="flex items-center">
          <div className="flex">
            <ChainLogo chainCaip2Id={originCaip2Id} size={22} />
            <span className="text-gray-900 text-base font-normal tracking-wider ml-2">
              {getChainDisplayName(originCaip2Id, true)}
            </span>
          </div>
          <Image className="mx-2.5" src={ArrowRightIcon} width={13} height={13} alt="" />
          <div className="flex">
            <ChainLogo chainCaip2Id={destinationCaip2Id} size={22} />
            <span className="text-gray-900 text-base font-normal tracking-wider ml-2">
              {getChainDisplayName(destinationCaip2Id, true)}
            </span>
          </div>
        </div>
      </div>
      <div className="relative">
        {/* TODO Timeline does not support PI messages yet */}
        {isPermissionlessRoute ? (
          <TransferStatusIcon transferStatus={status} />
        ) : (
          <Timeline transferStatus={status} originTxHash={originTxHash} />
        )}
        {status !== TransferStatus.ConfirmedTransfer && status !== TransferStatus.Delivered ? (
          <>
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
          </>
        ) : (
          <div className="mt-6 flex flex-col md:flex-row">
            <div className="flex w-full md:w-1/2">
              <div className="flex flex-col w-full md:w-min gap-4">
                <div className="flex">
                  <span className="text-gray-350 text-xs leading-normal tracking-wider mr-2 md:mr-3">
                    Time:
                  </span>
                  <span className="text-gray-350 text-xs leading-normal tracking-wider">
                    {date}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-350 text-xs leading-normal tracking-wider mr-2 md:mr-3">
                    From:
                  </span>
                  <span className="flex-1 text-gray-350 text-xs leading-normal tracking-wider truncate w-48">
                    {activeAccountAddress}
                  </span>
                  {fromUrl && (
                    <a
                      href={fromUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex ml-2.5"
                    >
                      <Image src={LinkIcon} width={12} height={12} alt="" />
                    </a>
                  )}
                </div>
                <div className="flex mb-4 justify-between">
                  <span className="text-gray-350 text-xs leading-normal tracking-wider mr-2 md:mr-7">
                    To:
                  </span>
                  <span className="flex-1 text-gray-350 text-xs leading-normal tracking-wider truncate w-48">
                    {recipientAddress}
                  </span>
                  {toUrl && (
                    <a
                      href={toUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex ml-2.5"
                    >
                      <Image src={LinkIcon} width={12} height={12} alt="" />
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="flex w-full md:w-1/2">
              <div className="flex flex-col w-full md:w-min gap-4">
                <div className="flex justify-between">
                  <span className="text-gray-350 text-xs leading-normal tracking-wider mr-2">
                    Token:
                  </span>
                  <span className="flex-1 text-gray-350 text-xs leading-normal tracking-wider truncate w-48">
                    {isNative ? 'Native currency' : tokenAddress}
                  </span>
                  {tokenUrl && !isNative && (
                    <a
                      href={tokenUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex ml-2.5"
                    >
                      <Image src={LinkIcon} width={12} height={12} alt="" />
                    </a>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-350 text-xs leading-normal tracking-wider mr-2">
                    Origin Tx:
                  </span>
                  <span className="flex-1 text-gray-350 text-xs leading-normal tracking-wider truncate w-44">
                    {originTxHash}
                  </span>
                  {originTxUrl && (
                    <a
                      href={originTxUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex ml-2.5"
                    >
                      <Image src={LinkIcon} width={12} height={12} alt="" />
                    </a>
                  )}
                </div>
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
                    <a
                      href={explorerLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex ml-2.5"
                    >
                      <Image src={LinkIcon} width={12} height={12} alt="" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Timeline({
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

// TODO: Remove this once we have a better solution for wagmi signing issue
// https://github.com/wagmi-dev/wagmi/discussions/2928
function useSignIssueWarning(status: TransferStatus) {
  const [showWarning, setShowWarning] = useState(false);
  const warningCallback = useCallback(() => {
    if (status === TransferStatus.SigningTransfer) setShowWarning(true);
  }, [status, setShowWarning]);
  useTimeout(warningCallback, 15_000);
  return showWarning;
}
