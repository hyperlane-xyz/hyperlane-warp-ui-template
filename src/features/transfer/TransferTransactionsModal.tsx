import { useFormikContext } from 'formik';
import { useAccount } from 'wagmi';

import { chainIdToMetadata } from '@hyperlane-xyz/sdk';
import { MessageStatus, MessageTimeline, useMessageTimeline } from '@hyperlane-xyz/widgets';

import { Spinner } from '../../components/animation/Spinner';
import { Modal } from '../../components/layout/Modal';
import { links } from '../../consts/links';
import { trimLeading0x } from '../../utils/addresses';
import { RouteType, RoutesMap, getTokenRoute } from '../tokens/routes';

import { TransferFormValues } from './types';

export function TransferTransactionsModal({
  isOpen,
  close,
  tokenRoutes,
  originTxHash,
}: {
  isOpen: boolean;
  close: () => void;
  tokenRoutes: RoutesMap;
  originTxHash: string | null;
}) {
  const { address, isConnected, connector } = useAccount();
  const isAccountReady = !!(address && isConnected && connector);
  const connectorName = connector?.name || 'wallet';

  const {
    values: { sourceChainId, destinationChainId, tokenAddress },
  } = useFormikContext<TransferFormValues>();
  const route = getTokenRoute(sourceChainId, destinationChainId, tokenAddress, tokenRoutes);
  const requiresApprove = route?.type === RouteType.NativeToRemote;

  const isPermisionlessRoute = !(
    chainIdToMetadata[sourceChainId] && chainIdToMetadata[destinationChainId]
  );

  return (
    <Modal
      isOpen={isOpen}
      title="Token Transfer"
      close={close}
      width={isPermisionlessRoute ? 'max-w-xs' : 'max-w-lg'}
    >
      {isPermisionlessRoute ? (
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
          originTxHash={originTxHash}
        />
      )}
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
  originTxHash: string | null;
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
        timestampSent={message?.originTransaction.timestamp}
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
