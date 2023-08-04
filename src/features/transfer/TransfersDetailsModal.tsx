import Image from 'next/image';
import { useMemo } from 'react';

import { MessageStatus, MessageTimeline, useMessageTimeline } from '@hyperlane-xyz/widgets';

import { ChainLogo } from '../../components/icons/ChainLogo';
import { Modal } from '../../components/layout/Modal';
import ArrowRightIcon from '../../images/icons/arrow-right.svg';
import LinkIcon from '../../images/icons/external-link-icon.svg';
import { formatTimestamp } from '../../utils/date';
import { getHypExplorerLink } from '../../utils/links';
import { getTransferStatusLabel } from '../../utils/transfer';
import { getChainDisplayName, hasPermissionlessChain } from '../chains/utils';
import { getAllTokens } from '../tokens/metadata';
import { isNativeToken } from '../tokens/native';
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
  const { params, status, originTxHash, msgId, timestamp, activeAccountAddress, route } =
    transfer || {};
  const { destinationCaip2Id, originCaip2Id, tokenAddress, amount } = params || {};

  const account = useAccountForChain(originCaip2Id);

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
  const token = useMemo(
    () => getAllTokens().find((t) => t.address === tokenAddress),
    [tokenAddress],
  );

  return (
    <Modal
      showCloseBtn={false}
      isOpen={isOpen}
      close={onClose}
      title=""
      padding="p-6"
      width="max-w-xl-1"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex mb-2.5 md:mb-0">
          <ChainLogo caip2Id={originCaip2Id} size={22} />
          <div className="flex items items-baseline">
            <span className="text-black text-base font-normal ml-1">{amount}</span>
            <span className="text-black text-base font-normal ml-1">{token?.symbol || ''}</span>
            <span className="text-black text-xs font-normal ml-1">
              ({isNativeToken(tokenAddress) ? 'Native' : route.isNft ? 'NFT' : 'Token'})
            </span>
          </div>
        </div>
        <div className="flex items-center">
          <div className="flex">
            <ChainLogo caip2Id={originCaip2Id} size={22} />
            <span className="text-gray-900 text-base font-normal tracking-wider ml-2">
              {getChainDisplayName(originCaip2Id, true)}
            </span>
          </div>
          <Image className="mx-2.5" src={ArrowRightIcon} width={13} height={13} alt="" />
          <div className="flex">
            <ChainLogo caip2Id={destinationCaip2Id} size={22} />
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
          <div
            className={`mt-5 text-sm text-center ${
              status === TransferStatus.Failed ? 'text-red-600' : 'text-gray-600'
            }`}
          >
            {statusDescription}
          </div>
        ) : (
          <div className="flex flex-col md:flex-row">
            <div className="flex w-full md:w-1/2">
              <div className="flex flex-col w-full md:w-min">
                <div className="flex mb-5">
                  <span className="text-gray-350 text-xs leading-normal tracking-wider mr-2 md:mr-3">
                    Time:
                  </span>
                  <span className="text-gray-350 text-xs leading-normal tracking-wider">
                    {date}
                  </span>
                </div>
                <div className="flex mb-5 justify-between">
                  <span className="text-gray-350 text-xs leading-normal tracking-wider mr-2 md:mr-3">
                    From:
                  </span>
                  <span className="flex-1 text-gray-350 text-xs leading-normal tracking-wider truncate w-48">
                    {activeAccountAddress}
                  </span>
                  {explorerLink && (
                    <a
                      href={explorerLink}
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
                    {params.recipientAddress}
                  </span>
                  {explorerLink && (
                    <a
                      href={explorerLink}
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
              <div className="flex flex-col w-full md:w-min">
                <div className="flex mb-5 justify-between">
                  <span className="text-gray-350 text-xs leading-normal tracking-wider mr-2 md:mr-7">
                    Token:
                  </span>
                  <span className="flex-1 text-gray-350 text-xs leading-normal tracking-wider truncate w-48">
                    {tokenAddress}
                  </span>
                  {explorerLink && (
                    <a
                      href={explorerLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex ml-2.5"
                    >
                      <Image src={LinkIcon} width={12} height={12} alt="" />
                    </a>
                  )}
                </div>
                <div className="flex mb-5 justify-between">
                  <span className="text-gray-350 text-xs leading-normal tracking-wider mr-2">
                    Origin Tx:
                  </span>
                  <span className="flex-1 text-gray-350 text-xs leading-normal tracking-wider truncate w-44">
                    {originTxHash}
                  </span>
                  {explorerLink && (
                    <a
                      href={explorerLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex ml-2.5"
                    >
                      <Image src={LinkIcon} width={12} height={12} alt="" />
                    </a>
                  )}
                </div>
                {explorerLink && (
                  <div className="flex mb-4 justify-between">
                    <span className="text-gray-350 text-xs leading-normal tracking-wider">
                      <a
                        className="text-gray-350 text-xs leading-normal tracking-wider underline underline-offset-2 hover:opacity-80 active:opacity-70"
                        href={explorerLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View message details in Hyperlane Explorer
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
    <div className="mt-4 mb-2 w-full flex flex-col justify-center items-center timeline-container">
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
