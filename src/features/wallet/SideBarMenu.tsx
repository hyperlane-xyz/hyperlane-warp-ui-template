import {
  SpinnerIcon,
  WalletIcon,
  useAccounts as useProtocolAccounts,
  useDisconnectFns,
  useWalletDetails,
} from '@hyperlane-xyz/widgets';
import { useAccounts as useBtcAccounts, useDisconnect } from '@midl-xyz/midl-js-react';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useMultiProvider } from '../chains/hooks';
import { ChainLogo } from '../../components/icons/ChainLogo';
import ArrowRightIcon from '../../images/icons/arrow-right.svg';
import ResetIcon from '../../images/icons/reset-icon.svg';
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

  // Bitcoin wallet hooks
  const { isConnected: isBtcConnected, accounts: btcAccounts } = useBtcAccounts();
  const { disconnect: disconnectBtc } = useDisconnect();

  // Other protocol wallets
  const wallets = useWalletDetails();
  const { readyAccounts } = useProtocolAccounts(multiProvider);
  const disconnectFns = useDisconnectFns();

  const { transfers, resetTransfers, transferLoading } = useStore((s) => ({
    transfers: s.transfers,
    resetTransfers: s.resetTransfers,
    transferLoading: s.transferLoading,
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
            {/* Bitcoin Wallet */}
            {isBtcConnected && btcAccounts?.[0] && (
              <div className="flex items-center gap-3 rounded-xl bg-[#eae7ec] px-2 py-2 pr-3">
                {/* Bitcoin Icon */}
                <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-orange-400 to-orange-600">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 32 32"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M23.189 14.02C23.519 11.93 21.939 10.79 19.779 10.02L20.479 7.21L18.779 6.78L18.099 9.51C17.639 9.4 17.169 9.3 16.699 9.2L17.389 6.45L15.689 6.02L14.989 8.82C14.609 8.74 14.239 8.66 13.879 8.57L13.879 8.56L11.539 7.98L11.079 9.77C11.079 9.77 12.339 10.05 12.309 10.07C13.009 10.24 13.129 10.71 13.109 11.1L12.309 14.31C12.359 14.32 12.419 14.34 12.489 14.37L12.309 14.32L11.159 18.78C11.079 18.98 10.869 19.29 10.369 19.16C10.389 19.19 9.13899 18.87 9.13899 18.87L8.27899 20.79L10.509 21.34C10.939 21.45 11.359 21.56 11.769 21.66L11.059 24.49L12.759 24.92L13.459 22.11C13.939 22.24 14.409 22.36 14.869 22.47L14.169 25.26L15.869 25.69L16.579 22.87C19.539 23.42 21.779 23.19 22.759 20.51C23.569 18.31 22.779 17.03 21.219 16.18C22.359 15.91 23.219 15.14 23.189 14.02ZM19.499 19.27C18.949 21.53 15.119 20.27 13.879 19.96L14.819 16.21C16.059 16.52 20.079 16.89 19.499 19.27ZM20.049 13.98C19.549 16.02 16.369 15.01 15.359 14.76L16.209 11.33C17.219 11.58 20.569 11.84 20.049 13.98Z"
                      fill="white"
                    />
                  </svg>
                </div>

                {/* Wallet Info */}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium leading-normal text-[#202020]">
                    Bitcoin
                  </div>
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold leading-normal text-[#202020]">
                    {btcAccounts[0].address}
                  </div>
                </div>

                {/* Close/Disconnect Button */}
                <button
                  onClick={() => {
                    disconnectBtc();
                    toast.success('Bitcoin wallet disconnected');
                  }}
                  className="flex h-4 w-4 shrink-0 items-center justify-center transition-opacity hover:opacity-70"
                  title="Disconnect"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M12 4L4 12M4 4L12 12"
                      stroke="#202020"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )}

            {/* Other protocol wallets */}
            {readyAccounts.map((accountInfo) => {
              if (!accountInfo?.addresses?.[0]?.address) return null;

              const protocolType = accountInfo.protocol;
              const wallet = wallets[protocolType];
              const disconnectFn = disconnectFns[protocolType];
              const address = accountInfo.addresses[0].address;

              return (
                <div
                  key={`${protocolType}-${address}`}
                  className="flex items-center gap-3 rounded-xl bg-[#eae7ec] px-2 py-2 pr-3"
                >
                  {/* Wallet Icon */}
                  {wallet?.logoUrl && (
                    <img
                      src={wallet.logoUrl}
                      alt={wallet.name || protocolType}
                      className="h-6 w-6 shrink-0 rounded-full"
                    />
                  )}

                  {/* Wallet Info */}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium leading-normal text-[#202020]">
                      {wallet?.name || protocolType}
                    </div>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold leading-normal text-[#202020]">
                      {address}
                    </div>
                  </div>

                  {/* Close/Disconnect Button */}
                  <button
                    onClick={async () => {
                      if (disconnectFn) {
                        await disconnectFn();
                        toast.success(`${wallet?.name || protocolType} wallet disconnected`);
                      }
                    }}
                    className="flex h-4 w-4 shrink-0 items-center justify-center transition-opacity hover:opacity-70"
                    title="Disconnect"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M12 4L4 12M4 4L12 12"
                        stroke="#202020"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              );
            })}
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
                if (isBtcConnected) {
                  disconnectBtc();
                  toast.success('Bitcoin wallet disconnected');
                } else {
                  toast.info('No wallets to disconnect');
                }
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
