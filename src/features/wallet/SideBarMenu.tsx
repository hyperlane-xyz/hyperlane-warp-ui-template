import type { ChainName } from '@hyperlane-xyz/sdk';
import { fromWei, normalizeAddress } from '@hyperlane-xyz/utils';
import { AccountList, RefreshIcon, SpinnerIcon, useAccounts } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { config } from '../../consts/config';
import ArrowRightIcon from '../../images/icons/arrow-right.svg';
import CollapseIcon from '../../images/icons/collapse-icon.svg';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { MessageStatus } from '../messages/types';
import {
  messageToTransferContext,
  TransferItem,
  TransferItemType,
  useMergedTransferHistory,
} from '../messages/useMergedTransferHistory';
import { useMessageHistory } from '../messages/useMessageHistory';
import { RouterAddressInfo, useStore } from '../store';
import { tryFindToken, useWarpCore } from '../tokens/hooks';
import { TransfersDetailsModal } from '../transfer/TransfersDetailsModal';
import { TransferContext, TransferStatus } from '../transfer/types';
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferContext | null>(null);

  const multiProvider = useMultiProvider();

  const { transfers, transferLoading, originChainName, routerAddressesByChainMap } = useStore(
    (s) => ({
      transfers: s.transfers,
      transferLoading: s.transferLoading,
      originChainName: s.originChainName,
      routerAddressesByChainMap: s.routerAddressesByChainMap,
    }),
  );

  // Get all connected wallet addresses (normalized for consistent matching)
  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);
  const walletAddresses = useMemo(() => {
    const addresses: string[] = [];
    for (const accountInfo of Object.values(accounts)) {
      if (accountInfo.addresses) {
        for (const addrInfo of accountInfo.addresses) {
          if (addrInfo.address) {
            addresses.push(normalizeAddress(addrInfo.address));
          }
        }
      }
    }
    return addresses;
  }, [accounts]);

  // Get all warp route addresses from configured routes (normalized)
  const warpRouteAddresses = useMemo(() => {
    const addresses: string[] = [];
    for (const addressMap of Object.values(routerAddressesByChainMap)) {
      for (const addr of Object.keys(addressMap)) {
        addresses.push(normalizeAddress(addr));
      }
    }
    return addresses;
  }, [routerAddressesByChainMap]);

  // Fetch message history from API
  const { messages, isLoading, isRefreshing, hasMore, loadMore, refresh } = useMessageHistory(
    walletAddresses,
    warpRouteAddresses,
    multiProvider,
  );

  // Merge local transfers with API messages
  const warpCore = useWarpCore();
  const allMergedTransfers = useMergedTransferHistory(transfers, messages);

  // Filter out API messages with unknown tokens
  const mergedTransfers = useMemo(
    () =>
      allMergedTransfers.filter((item) => {
        if (item.type === TransferItemType.Local) return true;
        const originChain = multiProvider.tryGetChainName(item.data.originDomainId);
        if (!originChain) return false;
        return !!tryFindToken(warpCore, originChain, item.data.sender);
      }),
    [allMergedTransfers, multiProvider, warpCore],
  );

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || isLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadMore();
    }
  }, [isLoading, hasMore, loadMore]);

  const onCopySuccess = () => {
    toast.success('Address copied to clipboard', { autoClose: 2000 });
  };

  const handleItemClick = (item: TransferItem) => {
    if (item.type === TransferItemType.Local) {
      setSelectedTransfer(item.data);
    } else {
      setSelectedTransfer(
        messageToTransferContext(item.data, multiProvider, warpCore, routerAddressesByChainMap),
      );
    }
    setIsModalOpen(true);
  };

  // Open modal for new transfer
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

  return (
    <>
      <div
        className={`fixed right-0 top-0 h-full w-88 transform bg-white bg-opacity-95 shadow-lg transition-transform duration-100 ease-in ${
          isMenuOpen ? 'z-10 translate-x-0' : 'z-0 translate-x-full'
        }`}
      >
        {isMenuOpen && (
          <button
            className="absolute left-0 top-0 flex h-full w-9 -translate-x-full items-center justify-center rounded-l bg-accent-50/30 backdrop-blur-[1.5px] transition-all"
            onClick={() => onClose()}
          >
            <Image src={CollapseIcon} width={15} height={24} alt="" />
          </button>
        )}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex h-full w-full flex-col overflow-y-auto"
        >
          <div className="w-full bg-accent-gradient px-3.5 py-2 text-base font-normal tracking-wider text-white shadow-accent-glow">
            Connected Wallets
          </div>
          <AccountList
            multiProvider={multiProvider}
            onClickConnectWallet={onClickConnectWallet}
            onCopySuccess={onCopySuccess}
            className="px-3 py-3"
            chainName={originChainName}
          />
          <div className="flex w-full items-center justify-between bg-accent-gradient px-3.5 py-2 shadow-accent-glow">
            <span className="text-base font-normal tracking-wider text-white">
              Transfer History
            </span>
            <button
              onClick={refresh}
              disabled={isLoading}
              className="rounded p-1 hover:bg-accent-500/50 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshIcon
                width={20}
                height={20}
                color="white"
                className={isLoading ? 'animate-spin' : ''}
              />
            </button>
          </div>
          <div className="flex grow flex-col px-3.5 pb-4">
            {isRefreshing ? (
              <div className="flex justify-center py-6">
                <SpinnerIcon className="h-5 w-5" />
              </div>
            ) : (
              <>
                <div className="flex w-full grow flex-col divide-y">
                  {mergedTransfers.length === 0 && !isLoading && (
                    <div className="py-6 text-center text-sm text-gray-500">No transfers yet</div>
                  )}
                  {mergedTransfers.map((item) => (
                    <TransferSummary
                      key={
                        item.type === TransferItemType.Local
                          ? `local-${item.data.timestamp}-${item.data.originTxHash || item.data.msgId || ''}`
                          : `api-${item.data.msgId}`
                      }
                      item={item}
                      onClick={() => handleItemClick(item)}
                      multiProvider={multiProvider}
                      warpCore={warpCore}
                      routerAddressesByChainMap={routerAddressesByChainMap}
                    />
                  ))}
                </div>
                {isLoading && (
                  <div className="flex justify-center py-4">
                    <SpinnerIcon className="h-5 w-5" />
                  </div>
                )}
                {!hasMore && mergedTransfers.length > 0 && (
                  <div className="py-3 text-center text-xs text-gray-400">No more transfers</div>
                )}
              </>
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
  item,
  onClick,
  multiProvider,
  warpCore,
  routerAddressesByChainMap,
}: {
  item: TransferItem;
  onClick: () => void;
  multiProvider: ReturnType<typeof useMultiProvider>;
  warpCore: ReturnType<typeof useWarpCore>;
  routerAddressesByChainMap: Record<ChainName, Record<string, RouterAddressInfo>>;
}) {
  if (item.type === TransferItemType.Local) {
    return (
      <LocalTransferSummary
        transfer={item.data}
        onClick={onClick}
        multiProvider={multiProvider}
        warpCore={warpCore}
      />
    );
  }

  const msg = item.data;
  const originChain = multiProvider.tryGetChainName(msg.originDomainId) || '';
  const destChain = multiProvider.tryGetChainName(msg.destinationDomainId) || '';
  const status =
    msg.status === MessageStatus.Delivered
      ? TransferStatus.Delivered
      : TransferStatus.ConfirmedTransfer;

  // Find token by sender (origin warp route address - the token contract)
  const token = tryFindToken(warpCore, originChain, msg.sender);

  // Format amount using wire decimals from precomputed map
  let formattedAmount = '';
  if (msg.warpTransfer?.amount && token) {
    const normalizedSender = normalizeAddress(msg.sender);
    const routerInfo = routerAddressesByChainMap[originChain]?.[normalizedSender];
    const wireDecimals = routerInfo?.wireDecimals ?? token.decimals;
    formattedAmount = fromWei(msg.warpTransfer.amount, wireDecimals);
  }

  return (
    <button onClick={onClick} className={`${styles.btn} justify-between py-3`}>
      <div className="flex gap-2.5">
        <div className="flex h-[2.25rem] w-[2.25rem] flex-col items-center justify-center rounded-full bg-gray-100 px-1.5">
          <ChainLogo chainName={originChain} size={20} />
        </div>
        <div className="flex flex-col">
          <div className="flex flex-col">
            <div className="items flex items-baseline">
              {formattedAmount && (
                <span className="text-sm font-normal text-gray-800">{formattedAmount}</span>
              )}
              <span
                className={`text-sm font-normal text-gray-800 ${formattedAmount ? 'ml-1' : ''}`}
              >
                {token?.symbol || 'Unknown token'}
              </span>
            </div>
            <div className="mt-1 flex flex-row items-center">
              <span className="text-xxs font-normal tracking-wide text-gray-900">
                {getChainDisplayName(multiProvider, originChain, true)}
              </span>
              <Image className="mx-1" src={ArrowRightIcon} width={10} height={10} alt="" />
              <span className="text-xxs font-normal tracking-wide text-gray-900">
                {getChainDisplayName(multiProvider, destChain, true)}
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

function LocalTransferSummary({
  transfer,
  onClick,
  multiProvider,
  warpCore,
}: {
  transfer: TransferContext;
  onClick: () => void;
  multiProvider: ReturnType<typeof useMultiProvider>;
  warpCore: ReturnType<typeof useWarpCore>;
}) {
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
