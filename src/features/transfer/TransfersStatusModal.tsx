import Image from 'next/image';
import { useEffect, useState } from 'react';

import { MessageStatus, MessageTimeline, useMessageTimeline } from '@hyperlane-xyz/widgets';

import { Spinner } from '../../components/animation/Spinner';
import { Modal } from '../../components/layout/Modal';
import { links } from '../../consts/links';
import CheckmarkCircleIcon from '../../images/icons/checkmark-circle.svg';
import EnvelopeHeartIcon from '../../images/icons/envelope-heart.svg';
import ErrorCircleIcon from '../../images/icons/error-circle.svg';
import LinkIcon from '../../images/icons/external-link-icon.svg';
import { toBase64 } from '../../utils/base64';
import { parseCaip2Id } from '../chains/caip2';
import { hasPermissionlessChain, isPermissionlessChain } from '../chains/utils';
import { getMultiProvider } from '../multiProvider';
import { useStore } from '../store';
import { useAccountForChain } from '../wallet/hooks';

import { TransferContext, TransferStatus } from './types';

export function TransfersStatusModal({
  isOpen,
  close,
  transfers,
}: {
  isOpen: boolean;
  close: () => void;
  transfers: TransferContext[];
}) {
  const [index, setIndex] = useState(0);
  // Auto update index to newest transfer when opening
  useEffect(() => {
    if (isOpen) setIndex(transfers.length - 1);
  }, [isOpen, transfers.length]);

  const { params, status, originTxHash, msgId, timestamp } = transfers[index] || {};
  const { destinationCaip2Id, originCaip2Id, tokenAddress } = params || {};

  const account = useAccountForChain(originCaip2Id);

  const isAccountReady = !!account?.isReady;
  const connectorName = account?.connectorName || 'wallet';

  const isPermissionlessRoute = hasPermissionlessChain([destinationCaip2Id, originCaip2Id]);

  let statusDescription = '...';
  if (!isAccountReady) statusDescription = 'Please connect wallet to continue';
  else if (status === TransferStatus.Preparing)
    statusDescription = 'Preparing for token transfer...';
  else if (status === TransferStatus.CreatingApprove)
    statusDescription = 'Preparing approve transaction...';
  else if (status === TransferStatus.SigningApprove)
    statusDescription = `Sign approve transaction in ${connectorName} to continue.`;
  else if (status === TransferStatus.ConfirmingApprove)
    statusDescription = 'Confirming approve transaction...';
  else if (status === TransferStatus.CreatingTransfer)
    statusDescription = 'Preparing transfer transaction...';
  else if (status === TransferStatus.SigningTransfer)
    statusDescription = `Sign transfer transaction in ${connectorName} to continue.`;
  else if (status === TransferStatus.ConfirmingTransfer)
    statusDescription = 'Confirming transfer transaction...';
  else if (status === TransferStatus.ConfirmedTransfer)
    if (!isPermissionlessRoute)
      statusDescription = 'Transfer transaction confirmed, delivering message...';
    else
      statusDescription =
        'Transfer confirmed, the funds will arrive when the message is delivered.';
  else if (status === TransferStatus.Delivered)
    statusDescription = 'Delivery complete, transfer successful!';
  else if (status === TransferStatus.Failed)
    statusDescription = 'Transfer failed, please try again.';

  const explorerLink = getHypExplorerLink(originCaip2Id, msgId);

  return (
    <Modal isOpen={isOpen} close={close} title="" padding="p-6" width="max-w-xl-1">
      <div className="flex">HEADER</div>
      <div className="relative">
        {/* TODO Timeline does not support PI messages yet */}
        {isPermissionlessRoute ? (
          <BasicSpinner transferStatus={status} />
        ) : (
          <Timeline transferStatus={status} transferIndex={index} originTxHash={originTxHash} />
        )}
        <div className="flex">
          <div className="flex w-1/2">
            <div className="flex flex-col">
              <div className="flex mb-5">
                <span className="text-gray-350 text-xs leading-normal tracking-wider mr-3">
                  Time:
                </span>
                <span className="text-gray-350 text-xs leading-normal tracking-wider">
                  {timestamp || '10:38pm July 1 2023'}
                </span>
              </div>
              <div className="flex mb-5 justify-between">
                <span className="text-gray-350 text-xs leading-normal tracking-wider mr-3">
                  From:
                </span>
                <span className="text-gray-350 text-xs leading-normal tracking-wider truncate w-48">
                  {params.recipientAddress}
                </span>
                <a href={'/'} target="_blank" rel="noopener noreferrer" className="flex ml-2.5">
                  <Image src={LinkIcon} width={12} height={12} alt="" />
                </a>
              </div>
              <div className="flex mb-4 justify-between">
                <span className="text-gray-350 text-xs leading-normal tracking-wider mr-7">
                  To:
                </span>
                <span className="text-gray-350 text-xs leading-normal tracking-wider truncate w-48">
                  {params.recipientAddress}
                </span>
                <a href={'/'} target="_blank" rel="noopener noreferrer" className="flex ml-2.5">
                  <Image src={LinkIcon} width={12} height={12} alt="" />
                </a>
              </div>
            </div>
          </div>
          <div className="flex w-1/2">
            <div className="flex flex-col">
              <div className="flex mb-5 justify-between">
                <span className="text-gray-350 text-xs leading-normal tracking-wider mr-7">
                  Token:
                </span>
                <span className="text-gray-350 text-xs leading-normal tracking-wider truncate w-48">
                  {tokenAddress}
                </span>
                <a href={'/'} target="_blank" rel="noopener noreferrer" className="flex ml-2.5">
                  <Image src={LinkIcon} width={12} height={12} alt="" />
                </a>
              </div>
              <div className="flex mb-5 justify-between">
                <span className="text-gray-350 text-xs leading-normal tracking-wider mr-3">
                  Origin Tx:
                </span>
                <span className="text-gray-350 text-xs leading-normal tracking-wider truncate w-48">
                  {originTxHash}
                </span>
                <a href={'/'} target="_blank" rel="noopener noreferrer" className="flex ml-2.5">
                  <Image src={LinkIcon} width={12} height={12} alt="" />
                </a>
              </div>
              <div className="flex mb-4 justify-between">
                <span className="text-gray-350 text-xs leading-normal tracking-wider">
                  {explorerLink && (
                    <a
                      className="text-gray-350 text-xs leading-normal tracking-wider underline underline-offset-2 hover:opacity-80 active:opacity-70"
                      href={explorerLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View message details in Hyperlane Explorer
                    </a>
                  )}
                </span>
                <a href={'/'} target="_blank" rel="noopener noreferrer" className="flex ml-2.5">
                  <Image src={LinkIcon} width={12} height={12} alt="" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Timeline({
  transferStatus,
  transferIndex,
  originTxHash,
}: {
  transferStatus: TransferStatus;
  transferIndex: number;
  originTxHash?: string;
}) {
  const isFailed = transferStatus === TransferStatus.Failed;
  const { stage, timings, message } = useMessageTimeline({
    originTxHash: isFailed ? undefined : originTxHash,
  });
  const messageStatus = isFailed ? MessageStatus.Failing : message?.status || MessageStatus.Pending;

  // TODO move this so it runs even if timeline isn't open
  const updateTransferStatus = useStore((s) => s.updateTransferStatus);
  useEffect(() => {
    if (messageStatus === MessageStatus.Delivered) {
      updateTransferStatus(transferIndex, TransferStatus.Delivered);
    }
  }, [transferIndex, messageStatus, updateTransferStatus]);

  return (
    <div className="mt-4 mb-7 w-full flex flex-col justify-center items-center timeline-container">
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

function BasicSpinner({ transferStatus }: { transferStatus: TransferStatus }) {
  let content;
  if (transferStatus === TransferStatus.Delivered) {
    content = (
      <Image
        src={CheckmarkCircleIcon}
        alt="Delivered"
        width={80}
        height={80}
        className="opacity-80"
      />
    );
  } else if (transferStatus === TransferStatus.ConfirmedTransfer) {
    content = (
      <Image
        src={EnvelopeHeartIcon}
        alt="Delivering"
        width={80}
        height={80}
        className="opacity-80"
      />
    );
  } else if (transferStatus === TransferStatus.Failed) {
    content = (
      <Image src={ErrorCircleIcon} alt="Failed" width={86} height={86} className="opacity-80" />
    );
  } else {
    content = <Spinner />;
  }
  return <div className="py-4 flex flex-col justify-center items-center">{content}</div>;
}

// TODO test with solana chain config, or disallow it
function getHypExplorerLink(originCaip2Id: Caip2Id, msgId?: string) {
  if (!originCaip2Id || !msgId) return null;
  const baseLink = `${links.explorer}/message/${msgId}`;
  if (isPermissionlessChain(originCaip2Id)) {
    const { reference } = parseCaip2Id(originCaip2Id);
    const chainConfig = getMultiProvider().getChainMetadata(reference);
    const serializedConfig = toBase64([chainConfig]);
    if (serializedConfig) {
      const params = new URLSearchParams({ chains: serializedConfig });
      return `${baseLink}?${params.toString()}`;
    }
  }
  return baseLink;
}
