import { useFormikContext } from 'formik';
import { useAccount } from 'wagmi';

import { Spinner } from '../../components/animation/Spinner';
import { Modal } from '../../components/layout/Modal';
import { RouteType, RoutesMap, getTokenRoute } from '../tokens/routes';

import { TransferFormValues } from './types';

export function TransferTransactionsModal({
  isOpen,
  close,
  tokenRoutes,
}: {
  isOpen: boolean;
  close: () => void;
  tokenRoutes: RoutesMap;
}) {
  const { address, isConnected, connector } = useAccount();
  const isAccountReady = !!(address && isConnected && connector);

  const {
    values: { sourceChainId, destinationChainId, tokenAddress },
  } = useFormikContext<TransferFormValues>();
  const route = getTokenRoute(sourceChainId, destinationChainId, tokenAddress, tokenRoutes);
  const requiresApprove = route?.type === RouteType.NativeToRemote;

  return (
    <Modal isOpen={isOpen} title="Token Transfer" close={close}>
      <div className="my-6 flex flex-col justify-center items-center">
        <Spinner />
        {isAccountReady ? (
          <>
            <div className="mt-5 text-sm text-center text-gray-500">
              {requiresApprove
                ? 'Attempting to send two transactions: Approve and TransferRemote'
                : 'Attempting to send transaction: TransferRemote'}
            </div>
            <div className="mt-3 text-sm text-center text-gray-500">{`Sign with ${connector.name} to proceed`}</div>
          </>
        ) : (
          <div className="mt-5 text-sm text-center text-gray-500">
            Please connect wallet to proceed
          </div>
        )}
      </div>
    </Modal>
  );
}
