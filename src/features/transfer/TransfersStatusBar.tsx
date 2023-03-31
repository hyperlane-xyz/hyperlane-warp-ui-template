import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

import SendIcon from '../../images/icons/send.svg';
import { useStore } from '../store';

import { TransfersStatusModal } from './TransfersStatusModal';
import { TransferStatus } from './types';

// Component that displays the status of pending and complete transactions
export function TransfersStatusBar() {
  const { address, isConnected } = useAccount();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const transfers = useStore((s) => s.transfers);

  // Auto-show modal when new transfer is added
  useEffect(() => {
    setIsModalOpen(true);
  }, [transfers.length]);

  if (!transfers.length || !address || !isConnected) return null;

  const totalTxs = transfers.length;
  const pendingTxs = transfers.filter(
    (tx) => ![TransferStatus.Delivered, TransferStatus.Failed].includes(tx.status),
  ).length;
  const deliveredTxs = transfers.filter((tx) => tx.status === TransferStatus.Delivered).length;

  return (
    <div className="relative flex justify-center py-1 px-1 bg-white shadow-md rounded-md">
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-2 py-0.5 flex items-center rounded-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-500"
      >
        <div className="opacity-70">
          <Image
            src={SendIcon}
            width={23}
            height={23}
            alt=""
            className={pendingTxs > 0 ? 'animate-pulse-slow' : ''}
          />
        </div>
        <div className="ml-2.5 flex flex-col items-start">
          <div className="text-xs text-gray-500">Transfers</div>
          <div className="text-xs">{`Delivered: ${deliveredTxs} / ${totalTxs}`}</div>
        </div>
      </button>
      <TransfersStatusModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        transfers={transfers}
      />
    </div>
  );
}
