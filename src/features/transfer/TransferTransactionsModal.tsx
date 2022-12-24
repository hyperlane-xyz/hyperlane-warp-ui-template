import { useAccount } from 'wagmi';

import { Spinner } from '../../components/animation/Spinner';
import { Modal } from '../../components/layout/Modal';

export function TransferTransactionsModal({
  isOpen,
  close,
}: {
  isOpen: boolean;
  close: () => void;
}) {
  const { address, isConnected, connector } = useAccount();
  const isAccountReady = !!(address && isConnected && connector);

  return (
    <Modal isOpen={isOpen} title="Token Transfer" close={close}>
      <div className="my-6 flex flex-col justify-center items-center">
        <Spinner />
        {isAccountReady ? (
          <>
            <div className="mt-5 text-sm text-center text-gray-500">
              Attempting to send two transactions: Approve and TransferRemote
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
