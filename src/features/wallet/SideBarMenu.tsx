import { AccountList, SpinnerIcon, WalletIcon } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { ChainLogo } from '../../components/icons/ChainLogo';
import ArrowRightIcon from '../../images/icons/arrow-right.svg';
import ResetIcon from '../../images/icons/reset-icon.svg';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { useStore } from '../store';
import { tryFindToken, useWarpCore } from '../tokens/hooks';
import { TransfersDetailsModal } from '../transfer/TransfersDetailsModal';
import { TransferContext } from '../transfer/types';
import { getIconByTransferStatus, STATUSES_WITH_ICON } from '../transfer/utils';

export function SideBarMenu({
  onClickConnectWallet,
  isOpen,
  onClose,
}: {
  onClickConnectWallet: () => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  const didMountRef = useRef(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferContext | null>(null);

  const multiProvider = useMultiProvider();

  const { transfers, resetTransfers, transferLoading, originChainName } = useStore((s) => ({
    transfers: s.transfers,
    resetTransfers: s.resetTransfers,
    transferLoading: s.transferLoading,
    originChainName: s.originChainName,
  }));

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
    } else if (transferLoading) {
      setSelectedTransfer(transfers[transfers.length - 1]);
      setIsModalOpen(true);
    }
  }, [transfers, transferLoading]);

  useEffect(() => {
    setIsMenuOpen(isOpen);
  }, [isOpen]);

  const sortedTransfers = useMemo(
    () => [...transfers].sort((a, b) => b.timestamp - a.timestamp) || [],
    [transfers],
  );

  const onCopySuccess = () => {
    toast.success('Address copied to clipboard', { autoClose: 2000 });
  };

  return (
    <>
      <div
        className={`fixed right-0 top-0 flex h-full items-center justify-end overflow-hidden rounded-l-2xl transition-transform duration-100 ease-in ${
          isMenuOpen ? 'z-10 translate-x-0' : 'z-0 translate-x-full'
        }`}
        style={{ width: '400px' }}
      >
        {/* Background image with blur */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-l-2xl backdrop-blur-[2px]">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-200/40 to-purple-300/40" />
        </div>

        {/* Close button */}
        {isMenuOpen && (
          <div className="z-10 flex h-full shrink-0 items-center bg-purple-900/20 p-2 backdrop-blur-sm">
            <button
              className="flex size-6 items-center justify-center transition-transform hover:rotate-180"
              onClick={() => onClose()}
              title="Close sidebar"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M14 5L7 12L14 19"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Main content */}
        <div className="relative z-10 flex h-full w-[352px] shrink-0 flex-col gap-4 overflow-y-auto bg-[#f8f8ff]">
          {/* Connected Wallets Header */}
          <div className="w-full bg-[#8e4ec6] px-4 py-2">
            <p className="text-xs font-semibold text-white">Connected Wallets</p>
          </div>

          {/* Account List */}
          <div className="flex flex-col gap-2 px-4">
            <AccountList
              multiProvider={multiProvider}
              onClickConnectWallet={onClickConnectWallet}
              onCopySuccess={onCopySuccess}
              className=""
              chainName={originChainName}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-6 border-y border-gray-200 py-2">
            <button
              onClick={onClickConnectWallet}
              className="flex items-center gap-2 px-4 py-0 text-sm font-medium text-gray-900 transition-colors hover:text-primary-600"
            >
              <WalletIcon width={24} height={24} />
              <span>Connect wallet</span>
            </button>
            <button
              onClick={() => {
                // Add disconnect all logic here if needed
                toast.info('Disconnect all wallets');
              }}
              className="flex items-center gap-2 px-4 py-0 text-sm font-medium text-gray-900 transition-colors hover:text-primary-600"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Disconnect all wallets</span>
            </button>
          </div>

          {/* Transfer History Header */}
          <div className="w-full bg-[#8e4ec6] px-4 py-2">
            <p className="text-xs font-semibold text-white">Transfer History</p>
          </div>

          {/* Transfer List */}
          <div className="flex grow flex-col px-4">
            <div className="flex w-full grow flex-col divide-y">
              {sortedTransfers?.length > 0 &&
                sortedTransfers.map((t, i) => (
                  <TransferSummary
                    key={i}
                    transfer={t}
                    onClick={() => {
                      setSelectedTransfer(t);
                      setIsModalOpen(true);
                    }}
                  />
                ))}
            </div>
            {sortedTransfers?.length > 0 && (
              <button onClick={resetTransfers} className={`${styles.btn} mx-2 my-5`}>
                <Image className="mr-4" src={ResetIcon} width={17} height={17} alt="" />
                <span className="text-sm font-normal text-gray-900">Reset transaction history</span>
              </button>
            )}
          </div>
        </div>
      </div>
      {selectedTransfer && (
        <TransfersDetailsModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTransfer(null);
          }}
          transfer={selectedTransfer}
        />
      )}
    </>
  );
}

function TransferSummary({
  transfer,
  onClick,
}: {
  transfer: TransferContext;
  onClick: () => void;
}) {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const { amount, origin, destination, status, timestamp, originTokenAddressOrDenom } = transfer;

  const token = tryFindToken(warpCore, origin, originTokenAddressOrDenom);

  return (
    <button key={timestamp} onClick={onClick} className={`${styles.btn} justify-between py-3`}>
      <div className="flex gap-2.5">
        <div className="flex h-[2.25rem] w-[2.25rem] flex-col items-center justify-center rounded-full bg-gray-100 px-1.5">
          <ChainLogo chainName={origin} size={20} />
        </div>
        <div className="flex flex-col">
          <div className="flex flex-col">
            <div className="items flex items-baseline">
              <span className="text-sm font-normal text-gray-800">{amount}</span>
              <span className="ml-1 text-sm font-normal text-gray-800">{token?.symbol || ''}</span>
            </div>
            <div className="mt-1 flex flex-row items-center">
              <span className="text-xxs font-normal tracking-wide text-gray-900">
                {getChainDisplayName(multiProvider, origin, true)}
              </span>
              <Image className="mx-1" src={ArrowRightIcon} width={10} height={10} alt="" />
              <span className="text-xxs font-normal tracking-wide text-gray-900">
                {getChainDisplayName(multiProvider, destination, true)}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex h-5 w-5">
        {STATUSES_WITH_ICON.includes(status) ? (
          <Image src={getIconByTransferStatus(status)} width={25} height={25} alt="" />
        ) : (
          <SpinnerIcon className="-ml-1 mr-3 h-5 w-5" />
        )}
      </div>
    </button>
  );
}

const styles = {
  btn: 'w-full flex items-center px-1 py-2 text-sm hover:bg-gray-200 active:scale-95 transition-all duration-500 cursor-pointer rounded-sm',
};
