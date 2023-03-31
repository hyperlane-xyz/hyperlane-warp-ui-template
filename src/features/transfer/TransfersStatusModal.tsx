import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

import { chainIdToMetadata } from '@hyperlane-xyz/sdk';
import { MessageStatus, MessageTimeline, useMessageTimeline } from '@hyperlane-xyz/widgets';

import { Spinner } from '../../components/animation/Spinner';
import { IconButton } from '../../components/buttons/IconButton';
import { ChevronIcon } from '../../components/icons/Chevron';
import { Modal } from '../../components/layout/Modal';
import { links } from '../../consts/links';
import { useStore } from '../store';

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
  const { address, isConnected, connector } = useAccount();
  const isAccountReady = !!(address && isConnected && connector);
  const connectorName = connector?.name || 'wallet';

  const [index, setIndex] = useState(0);
  // Auto update index to newest transfer when opening
  useEffect(() => {
    if (isOpen) setIndex(transfers.length - 1);
  }, [isOpen, transfers.length]);

  const { params, status, originTxHash, msgId } = transfers[index] || {};
  const { destinationChainId, sourceChainId } = params || {};

  const isPermissionlessRoute = !(
    chainIdToMetadata[sourceChainId] && chainIdToMetadata[destinationChainId]
  );

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
    statusDescription = 'Transfer transaction confirmed, delivering message...';
  else if (status === TransferStatus.Delivered)
    statusDescription = 'Delivery complete, transfer successful!';
  else if (status === TransferStatus.Failed)
    statusDescription = 'Transfer failed, please try again.';

  return (
    <Modal isOpen={isOpen} close={close} title="Token Transfers" width="max-w-lg">
      <div className="relative">
        <IconButton
          onClick={() => setIndex(index - 1)}
          disabled={index <= 0}
          classes="absolute bottom-0 left-0"
          title="Previous Transfer"
        >
          <ChevronIcon direction="w" width={14} height={14} classes="opacity-70" />
        </IconButton>
        <IconButton
          onClick={() => setIndex(index + 1)}
          disabled={index >= transfers.length - 1}
          classes="absolute bottom-0 right-0"
          title="Next Transfer"
        >
          <ChevronIcon direction="e" width={14} height={14} classes="opacity-70" />
        </IconButton>
        {/* TODO Timeline does not support PI messages yet */}
        {isPermissionlessRoute ? (
          <BasicSpinner />
        ) : (
          <Timeline transferStatus={status} transferIndex={index} originTxHash={originTxHash} />
        )}
        <div
          className={`mt-5 text-sm text-center ${
            status === TransferStatus.Failed ? 'text-red-600' : 'text-gray-600'
          }`}
        >
          {statusDescription}
        </div>
        {msgId && (
          <a
            className="block mt-3 text-xs text-gray-600 text-center underline underline-offset-2 hover:opacity-80 active:opacity-70"
            href={`${links.explorer}/message/${msgId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open transaction in Hyperlane Explorer
          </a>
        )}
        <div className="mt-5 text-center text-xs text-gray-500">{`Transfer ${index + 1} of ${
          transfers.length
        }`}</div>
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

function BasicSpinner() {
  return (
    <div className="py-4 flex flex-col justify-center items-center">
      <Spinner />
    </div>
  );
}
