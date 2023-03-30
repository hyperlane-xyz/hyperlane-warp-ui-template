import { useState } from 'react';
import { useAccount } from 'wagmi';

import { chainIdToMetadata } from '@hyperlane-xyz/sdk';
import { MessageStatus, MessageTimeline, useMessageTimeline } from '@hyperlane-xyz/widgets';

import { Spinner } from '../../components/animation/Spinner';
import { IconButton } from '../../components/buttons/IconButton';
import { ChevronIcon } from '../../components/icons/Chevron';
import { Modal } from '../../components/layout/Modal';
import { links } from '../../consts/links';
import { trimLeading0x } from '../../utils/addresses';
import { RouteType } from '../tokens/routes';

import { TransferContext } from './types';

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

  // TODO
  const { params, route, status, originTxHash, msgId } = transfers[index] || {};
  const { amount, destinationChainId, recipientAddress, sourceChainId, tokenAddress } =
    params || {};

  const requiresApprove = route?.type === RouteType.NativeToRemote;

  const isPermissionlessRoute = !(
    chainIdToMetadata[sourceChainId] && chainIdToMetadata[destinationChainId]
  );

  return (
    <Modal isOpen={isOpen} close={close} title="Transfers" width="max-w-lg">
      <div className="relative">
        <IconButton
          onClick={() => setIndex(index - 1)}
          disabled={index <= 0}
          classes="absolute -bottom-2 left-0"
          title="Previous Transfer"
        >
          <ChevronIcon direction="w" width={16} height={16} classes="opacity-70" />
        </IconButton>
        <IconButton
          onClick={() => setIndex(index + 1)}
          disabled={index >= transfers.length - 1}
          classes="absolute -bottom-2 right-0"
          title="Next Transfer"
        >
          <ChevronIcon direction="e" width={16} height={16} classes="opacity-70" />
        </IconButton>
        {isPermissionlessRoute ? (
          <BasicSpinner
            isAccountReady={isAccountReady}
            requiresApprove={requiresApprove}
            connectorName={connectorName}
          />
        ) : (
          <Timeline
            isAccountReady={isAccountReady}
            requiresApprove={requiresApprove}
            connectorName={connectorName}
            originTxHash={undefined} //TODO
          />
        )}
      </div>
    </Modal>
  );
}

function Timeline({
  isAccountReady,
  requiresApprove,
  connectorName,
  originTxHash,
}: {
  isAccountReady: boolean;
  requiresApprove: boolean;
  connectorName: string;
  originTxHash?: string | null;
}) {
  const { stage, timings, message } = useMessageTimeline({
    originTxHash: originTxHash || undefined,
  });
  return (
    <div className="mt-4 mb-2 w-full flex flex-col justify-center items-center timeline-container">
      <MessageTimeline
        status={message?.status || MessageStatus.Pending}
        stage={stage}
        timings={timings}
        timestampSent={message?.origin?.timestamp}
        hideDescriptions={true}
      />
      {isAccountReady ? (
        <>
          <div className="mt-5 text-sm text-center text-gray-500">
            {requiresApprove
              ? 'Attempting to send two transactions: Approve and TransferRemote'
              : 'Attempting to send transaction: TransferRemote'}
          </div>
          <div className="mt-3 text-sm text-center text-gray-500">{`Sign with ${connectorName} to proceed`}</div>
        </>
      ) : (
        <div className="mt-5 text-sm text-center text-gray-500">
          Please connect wallet to proceed
        </div>
      )}
      {message && (
        <a
          className="mt-4 text-gray-500 underline underline-offset-2"
          href={`${links.explorer}/message/${trimLeading0x(message.id)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Transaction in Hyperlane Explorer
        </a>
      )}
    </div>
  );
}

function BasicSpinner({
  isAccountReady,
  requiresApprove,
  connectorName,
}: {
  isAccountReady: boolean;
  requiresApprove: boolean;
  connectorName: string;
}) {
  return (
    <div className="my-6 flex flex-col justify-center items-center">
      <Spinner />
      {isAccountReady ? (
        <>
          <div className="mt-5 text-sm text-center text-gray-500">
            {requiresApprove
              ? 'Attempting to send two transactions: Approve and TransferRemote'
              : 'Attempting to send transaction: TransferRemote'}
          </div>
          <div className="mt-3 text-sm text-center text-gray-500">{`Sign with ${connectorName} to proceed`}</div>
        </>
      ) : (
        <div className="mt-5 text-sm text-center text-gray-500">
          Please connect wallet to proceed
        </div>
      )}
    </div>
  );
}
