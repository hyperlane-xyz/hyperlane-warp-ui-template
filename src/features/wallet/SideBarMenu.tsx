import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { toTitleCase } from '@hyperlane-xyz/utils';

import { SmallSpinner } from '../../components/animation/SmallSpinner';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { Identicon } from '../../components/icons/Identicon';
import { PLACEHOLDER_COSMOS_CHAIN } from '../../consts/values';
import ArrowRightIcon from '../../images/icons/arrow-right.svg';
import CollapseIcon from '../../images/icons/collapse-icon.svg';
import Logout from '../../images/icons/logout.svg';
import ResetIcon from '../../images/icons/reset-icon.svg';
import Wallet from '../../images/icons/wallet.svg';
import { tryClipboardSet } from '../../utils/clipboard';
import { STATUSES_WITH_ICON, getIconByTransferStatus } from '../../utils/transfer';
import { getAssetNamespace } from '../caip/tokens';
import { getChainDisplayName } from '../chains/utils';
import { useStore } from '../store';
import { getToken } from '../tokens/metadata';
import { TransfersDetailsModal } from '../transfer/TransfersDetailsModal';
import { TransferContext } from '../transfer/types';

import { useAccounts, useDisconnectFns } from './hooks/multiProtocol';

export function SideBarMenu({
  onConnectWallet,
  isOpen,
  onClose,
}: {
  onConnectWallet: () => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferContext | null>(null);
  const disconnects = useDisconnectFns();
  const { readyAccounts } = useAccounts();
  const didMountRef = useRef(false);

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

  const onClickCopy = (value?: string) => async () => {
    if (!value) return;
    await tryClipboardSet(value);
    toast.success('Address copied to clipboard', { autoClose: 2000 });
  };

  const onClickDisconnect = async () => {
    for (const disconnectFn of Object.values(disconnects)) {
      await disconnectFn();
    }
  };

  const sortedTransfers = useMemo(
    () => [...transfers].sort((a, b) => b.timestamp - a.timestamp) || [],
    [transfers],
  );

  return (
    <>
      <div
        className={`fixed right-0 top-0 h-full w-88 bg-white bg-opacity-95 shadow-lg transform ease-in duration-100 transition-transform ${
          isMenuOpen ? 'translate-x-0 z-30' : 'translate-x-full z-0'
        }`}
      >
        {isMenuOpen && (
          <button
            className="absolute flex items-center justify-center w-9 h-full -translate-x-full left-0 top-0 bg-white bg-opacity-60 hover:bg-opacity-80 rounded-l-md transition-all"
            onClick={() => onClose()}
          >
            <Image src={CollapseIcon} width={15} height={24} alt="" />
          </button>
        )}
        <div className="w-full h-full flex flex-col overflow-y-auto">
          <div className="w-full rounded-t-md bg-blue-500 py-2 px-3.5 text-white text-base font-normal tracking-wider">
            Connected Wallets
          </div>
          <div className="my-3 px-3 space-y-3">
            {readyAccounts.map((acc) =>
              acc.addresses.map((addr) => {
                if (addr?.chainCaip2Id?.includes(PLACEHOLDER_COSMOS_CHAIN)) return null;
                return (
                  <button
                    key={addr.address}
                    onClick={onClickCopy(addr.address)}
                    className={`${styles.btn} border border-gray-200 rounded-xl`}
                  >
                    <div className="shrink-0">
                      <Identicon address={addr.address} size={40} />
                    </div>
                    <div className="flex flex-col mx-3 items-start">
                      <div className="text-gray-800 text-sm font-normal">
                        {acc.connectorName || 'Wallet'}
                      </div>
                      <div className="text-xs text-left truncate w-64">
                        {addr.address ? addr.address : 'Unknown'}
                      </div>
                    </div>
                  </button>
                );
              }),
            )}
            <button onClick={onConnectWallet} className={styles.btn}>
              <Icon src={Wallet} alt="" size={18} />
              <div className="ml-2">Connect wallet</div>
            </button>
            <button onClick={onClickDisconnect} className={styles.btn}>
              <Icon src={Logout} alt="" size={20} />
              <div className="ml-2">Disconnect all wallets</div>
            </button>
          </div>
          <div className="w-full bg-blue-500 py-2 px-3.5 mb-4 text-white text-base font-normal tracking-wider">
            Transfer History
          </div>
          <div className="flex grow flex-col px-3.5">
            <div className="grow flex flex-col w-full">
              {sortedTransfers?.length > 0 &&
                sortedTransfers.map((t) => (
                  <button
                    key={t.timestamp}
                    onClick={() => {
                      setSelectedTransfer(t);
                      setIsModalOpen(true);
                    }}
                    className="flex justify-between items-center rounded-xl border border-gray-200 px-2.5 py-2 mb-2.5 hover:bg-gray-200 active:bg-gray-300 transition-all duration-500"
                  >
                    <div className="flex">
                      <div className="mr-2.5 flex flex-col items-center justify-center rounded-full bg-gray-100 h-[2.25rem] w-[2.25rem] p-1.5">
                        <ChainLogo chainCaip2Id={t.params.originCaip2Id} size={20} />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex flex-col">
                          <div className="flex items items-baseline">
                            <span className="text-gray-800 text-sm font-normal">
                              {t.params.amount}
                            </span>
                            <span className="text-gray-800 text-sm font-normal ml-1">
                              {getToken(t.params.tokenCaip19Id)?.symbol || ''}
                            </span>
                            <span className="text-black text-xs font-normal ml-1">
                              ({toTitleCase(getAssetNamespace(t.params.tokenCaip19Id))})
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
                    <div className="flex w-6 h-6">
                      {STATUSES_WITH_ICON.includes(t.status) ? (
                        <Image
                          src={getIconByTransferStatus(t.status)}
                          width={25}
                          height={25}
                          alt=""
                        />
                      ) : (
                        <SmallSpinner />
                      )}
                    </div>
                  </button>
                ))}
            </div>
            {sortedTransfers?.length > 0 && (
              <button onClick={resetTransfers} className="my-5 mx-2 flex flex-row items-center">
                <Image className="mr-4" src={ResetIcon} width={17} height={17} alt="" />
                <span className="text-gray-900 text-sm font-normal">Reset transaction history</span>
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
  btn: 'w-full flex items-center px-2.5 py-2 text-sm hover:bg-gray-200 active:bg-gray-300 rounded transition-all duration-500',
};
