import Image from 'next/image';
import { useEffect, useState } from 'react';

import { getChainDisplayName } from '../../features/chains/utils';
import { useStore } from '../../features/store';
import { isNativeToken } from '../../features/tokens/native';
import { TransfersDetailsModal } from '../../features/transfer/TransfersDetailsModal';
import { TransferContext, TransferStatus } from '../../features/transfer/types';
import { useAccounts } from '../../features/wallet/hooks';
import ArrowRightIcon from '../../images/icons/arrow-right.svg';
import CollapseIcon from '../../images/icons/collapse-icon.svg';
import ConfirmedIcon from '../../images/icons/confirmed-icon.svg';
import DeliveredIcon from '../../images/icons/delivered-icon.svg';
import Logout from '../../images/icons/logout.svg';
import WarningIcon from '../../images/icons/transfer-warning-status.svg';
import Wallet from '../../images/icons/wallet.svg';
import { ChainLogo } from '../icons/ChainLogo';
import { Identicon } from '../icons/Identicon';

const getIconByTransferStatus = (status: TransferStatus) => {
  switch (status) {
    case TransferStatus.Delivered:
      return DeliveredIcon;
    case TransferStatus.ConfirmedTransfer:
      return ConfirmedIcon;
    default:
      return WarningIcon;
  }
};

export function SideBarMenu({ isOpen, onClose }: { isOpen: boolean; onClose?: () => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferContext | null>(null);

  const transfers = useStore((s) => s.transfers);

  const { readyAccounts } = useAccounts();

  useEffect(() => {
    setIsMenuOpen(isOpen);
  }, [isOpen]);

  const handleToggleMenu = (isOpen: boolean) => {
    setIsMenuOpen(isOpen);
    if (!isOpen) onClose?.();
  };

  return (
    <>
      <div
        className={`fixed right-0 top-1.5 h-full w-96 bg-white bg-opacity-95 shadow-lg transform ease-in duration-100 transition-transform ${
          isMenuOpen ? 'translate-x-0 z-10' : 'translate-x-full z-0'
        }`}
      >
        <button
          className="absolute bg-opacity-60 -translate-x-full left-0 top-0 h-full w-10 bg-white rounded-l-md flex items-center justify-center"
          onClick={() => handleToggleMenu(!isMenuOpen)}
        >
          <Image
            className={`${!isMenuOpen ? 'rotate-180' : ''}`}
            src={CollapseIcon}
            width={15}
            height={24}
            alt=""
          />
        </button>
        <div className="w-full h-full">
          <div className="w-full rounded-t-md bg-blue-500 pt-3 pb-3 pl-5 pr-5">
            <span className="text-white text-lg font-medium tracking-wider">Connected Wallets</span>
          </div>
          <div className="mb-2 px-3.5 mt-2">
            {readyAccounts.map((a, i) => (
              <button
                key={a.address}
                className={`${styles.btn} border border-gray-300 rounded-md mb-2`}
                onClick={() => {}}
              >
                <div className="shrink-0">
                  <Identicon address={a.address} size={40} />
                </div>
                <div className="flex flex-col mx-3 items-start">
                  <div className="text-gray-800 text-sm font-normal">
                    {a.connectorName || 'Wallet'}
                  </div>
                  <div className="text-xs truncate w-64">{a.address ? a.address : 'Unknown'}</div>
                </div>
              </button>
            ))}

            <button className={styles.btn} onClick={() => {}}>
              <Icon src={Wallet} alt="" size={18} className="invert" />
              <div className="ml-2">Connect wallet</div>
            </button>

            <button className={styles.btn} onClick={() => {}}>
              <Icon src={Logout} alt="" size={20} />
              <div className="ml-2">Disconnect all wallets</div>
            </button>
          </div>
          <div className="w-full bg-blue-500 pt-3 pb-3 pl-5 pr-5 mb-3">
            <span className="text-white text-lg font-medium tracking-wider">Transfer History</span>
          </div>
          <div className="h-2/4 overflow-y-auto flex flex-col px-3.5">
            {transfers?.length > 0 &&
              transfers.map((t) => (
                <button
                  onClick={() => {
                    setSelectedTransfer(t);
                    setIsModalOpen(true);
                  }}
                  className="flex justify-between items-center rounded-md border border-gray-300 p-3 mb-2.5 hover:bg-gray-100 active:bg-gray-200 transition-all duration-500"
                >
                  <div className="flex">
                    <div className="mr-2.5 flex flex-col items-center justify-center rounded-full bg-gray-100 h-[2.25rem] w-[2.25rem] p-1.5">
                      <ChainLogo caip2Id={t.params.originCaip2Id} size={20} />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex flex-col">
                        <div className="flex items items-baseline">
                          <span className="text-gray-800 text-sm font-normal">
                            {t.params.amount}
                          </span>
                          <span className="text-gray-800 text-sm font-normal ml-1">{'ETH'}</span>
                          <span className="text-black text-xs font-normal ml-1">
                            (
                            {isNativeToken(t.params.tokenAddress)
                              ? 'Native'
                              : t.route.isNft
                              ? 'NFT'
                              : 'Token'}
                            )
                          </span>
                        </div>
                        <div className="mt-1 flex flex-row items-center">
                          <span className="text-thin text-gray-900 font-normal tracking-wide">
                            {getChainDisplayName(t.params.originCaip2Id, true)}
                          </span>
                          <Image
                            className="mx-1"
                            src={ArrowRightIcon}
                            width={10}
                            height={10}
                            alt=""
                          />
                          <span className="text-thin text-gray-900 font-normal tracking-wide">
                            {getChainDisplayName(t.params.destinationCaip2Id, true)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex">
                    <Image src={getIconByTransferStatus(t.status)} width={25} height={25} alt="" />
                  </div>
                </button>
              ))}
          </div>
        </div>
      </div>
      {selectedTransfer && (
        <TransfersDetailsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          transfer={selectedTransfer}
        />
      )}
    </>
  );
}

function Icon({
  src,
  alt,
  size,
  className,
}: {
  src: any;
  alt?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center w-[20px] ${className}`}>
      <Image src={src} alt={alt || ''} width={size ?? 16} height={size ?? 16} />
    </div>
  );
}

const styles = {
  btn: 'w-full flex items-center px-3.5 py-2 text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-500',
};
