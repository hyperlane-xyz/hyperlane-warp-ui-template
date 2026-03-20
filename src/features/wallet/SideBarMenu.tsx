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
import { formatTransferHistoryTimestamp } from '../../utils/date';
import { logger } from '../../utils/logger';
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
import { TokenChainIcon } from '../tokens/TokenChainIcon';
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
  const [nowMs, setNowMs] = useState(() => Date.now());

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

  useEffect(() => {
    if (!isMenuOpen) return;
    setNowMs(Date.now());
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  }, [isMenuOpen]);

  return (
    <>
      <div
        className={`sidebar-menu fixed right-0 top-0 h-full w-88 transform bg-white bg-opacity-95 shadow-lg transition-transform duration-100 ease-in dark:border-l dark:border-primary-300/35 dark:bg-[rgba(13,6,18,0.95)] ${
          isMenuOpen
            ? 'z-10 translate-x-0 dark:shadow-[-8px_0_32px_rgba(0,0,0,0.45)]'
            : 'z-0 translate-x-full'
        }`}
      >
        {isMenuOpen && (
          <button
            className="sidebar-menu-collapse absolute left-0 top-0 flex h-full w-9 -translate-x-full items-center justify-center rounded-l bg-accent-50/30 backdrop-blur-[1.5px] transition-all dark:border-r dark:border-primary-300/25 dark:bg-[rgba(13,6,18,0.7)]"
            onClick={() => onClose()}
          >
            <Image
              src={CollapseIcon}
              width={15}
              height={24}
              alt=""
              className="dark:opacity-85 dark:invert"
            />
          </button>
        )}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex h-full w-full flex-col overflow-y-auto"
        >
          <div className="sidebar-menu-header w-full bg-accent-gradient px-3.5 py-2 text-base font-normal tracking-wider text-white shadow-accent-glow dark:shadow-none">
            Connected Wallets
          </div>
          <AccountList
            multiProvider={multiProvider}
            onClickConnectWallet={onClickConnectWallet}
            onCopySuccess={onCopySuccess}
            className=""
            chainName={originChainName}
          />
          <div className="sidebar-menu-header flex w-full items-center justify-between bg-accent-gradient px-3.5 py-2 shadow-accent-glow dark:shadow-none">
            <span className="text-base font-normal tracking-wider text-white">
              Transfer History
            </span>
            <button
              onClick={refresh}
              disabled={isLoading}
              className="sidebar-menu-refresh rounded p-1 hover:bg-accent-500/50 disabled:opacity-50"
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
          <div className="flex grow flex-col pb-4">
            {isRefreshing ? (
              <div className="flex justify-center px-3.5 py-6">
                <SpinnerIcon className="h-5 w-5" />
              </div>
            ) : (
              <>
                <div className="sidebar-menu-list flex w-full grow flex-col divide-y">
                  {mergedTransfers.length === 0 && !isLoading && (
                    <div className="sidebar-menu-empty px-3.5 py-6 text-center text-sm text-gray-500 dark:text-[#e9d8ff]">
                      No transfers yet
                    </div>
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
                      nowMs={nowMs}
                    />
                  ))}
                </div>
                {isLoading && (
                  <div className="flex justify-center px-3.5 py-4">
                    <SpinnerIcon className="h-5 w-5" />
                  </div>
                )}
                {!hasMore && mergedTransfers.length > 0 && (
                  <div className="sidebar-menu-end px-3.5 py-3 text-center text-xs text-gray-400 dark:text-[#e9d8ff]">
                    No more transfers
                  </div>
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
  nowMs,
}: {
  item: TransferItem;
  onClick: () => void;
  multiProvider: ReturnType<typeof useMultiProvider>;
  warpCore: ReturnType<typeof useWarpCore>;
  routerAddressesByChainMap: Record<ChainName, Record<string, RouterAddressInfo>>;
  nowMs: number;
}) {
  const { originChain, destChain, amount, status, token, destToken, timestamp } = useMemo(() => {
    if (item.type === TransferItemType.Local) {
      const t = item.data;
      return {
        originChain: t.origin,
        destChain: t.destination,
        amount: t.amount,
        status: t.status,
        token: tryFindToken(warpCore, t.origin, t.originTokenAddressOrDenom),
        destToken: tryFindToken(warpCore, t.destination, t.destTokenAddressOrDenom),
        timestamp: t.timestamp,
      };
    }
    const msg = item.data;
    const originChain = multiProvider.tryGetChainName(msg.originDomainId) || '';
    const destChain = multiProvider.tryGetChainName(msg.destinationDomainId) || '';
    const token = tryFindToken(warpCore, originChain, msg.sender);

    let amount = '';
    if (msg.warpTransfer?.amount && token) {
      const normalizedSender = normalizeAddress(msg.sender);
      const routerInfo = routerAddressesByChainMap[originChain]?.[normalizedSender];
      const wireDecimals = routerInfo?.wireDecimals ?? token.decimals;
      try {
        amount = fromWei(msg.warpTransfer.amount, wireDecimals);
      } catch (err) {
        logger.error('Failed to format warp transfer amount', err);
      }
    }

    return {
      originChain,
      destChain,
      amount,
      status:
        msg.status === MessageStatus.Delivered
          ? TransferStatus.Delivered
          : TransferStatus.ConfirmedTransfer,
      token,
      destToken: tryFindToken(warpCore, destChain, msg.recipient),
      timestamp: msg.origin.timestamp,
    };
  }, [item.type, item.data, multiProvider, warpCore, routerAddressesByChainMap]);

  return (
    <button onClick={onClick} className={`${styles.btn} justify-between py-3`}>
      <div className="flex gap-2.5">
        <div className="flex h-[2.25rem] w-[2.25rem] items-center justify-center">
          {token ? (
            <TokenChainIcon token={token} size={32} />
          ) : (
            <ChainLogo chainName={originChain} size={32} />
          )}
        </div>
        <div className="flex flex-col">
          <div className="flex items-baseline">
            {amount && (
              <span className="sidebar-menu-token-text text-sm font-normal text-gray-800 dark:text-[#e9d8ff]">
                {amount}
              </span>
            )}
            <span
              className={`sidebar-menu-token-text text-sm font-normal text-gray-800 dark:text-[#e9d8ff] ${amount ? 'ml-1' : ''}`}
            >
              {token?.symbol || 'Unknown token'}
            </span>
            {destToken && (
              <>
                <Image
                  className="sidebar-menu-arrow mx-1 dark:opacity-85 dark:invert"
                  src={ArrowRightIcon}
                  width={10}
                  height={10}
                  alt=""
                />
                {amount && (
                  <span className="sidebar-menu-token-text text-sm font-normal text-gray-800 dark:text-[#e9d8ff]">
                    {amount}
                  </span>
                )}
                <span className="sidebar-menu-token-text ml-1 text-sm font-normal text-gray-800 dark:text-[#e9d8ff]">
                  {destToken.symbol}
                </span>
              </>
            )}
          </div>
          <div className="mt-1 flex items-center">
            <span className="sidebar-menu-route-text text-xxs font-normal tracking-wide text-gray-900 dark:text-[#e9d8ff]">
              {getChainDisplayName(multiProvider, originChain, true)}
            </span>
            <Image
              className="sidebar-menu-arrow mx-1 dark:opacity-85 dark:invert"
              src={ArrowRightIcon}
              width={10}
              height={10}
              alt=""
            />
            <span className="sidebar-menu-route-text text-xxs font-normal tracking-wide text-gray-900 dark:text-[#e9d8ff]">
              {getChainDisplayName(multiProvider, destChain, true)}
            </span>
          </div>
          <div className="sidebar-menu-time mt-1 w-full text-left text-xxs font-normal text-gray-500 dark:text-[#e9d8ff]">
            {formatTransferHistoryTimestamp(timestamp, nowMs)}
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
  btn: 'sidebar-menu-item flex w-full cursor-pointer items-center px-3.5 py-2 text-sm transition-all duration-500 hover:bg-gray-200 active:scale-95 dark:hover:bg-primary-300/10',
};
