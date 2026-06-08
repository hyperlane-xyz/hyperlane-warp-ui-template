import { normalizeAddress } from '@hyperlane-xyz/utils';
import { RefreshIcon, SpinnerIcon } from '@hyperlane-xyz/widgets';
import { AccountList } from '@hyperlane-xyz/widgets/walletIntegrations/AccountList';
import { useAccounts } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { ChainLogo } from '../../components/icons/ChainLogo';
import { TokenChainIcon } from '../../components/icons/TokenChainIcon';
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
import {
  type AppState,
  type TransactionHistoryItem,
  TransactionHistoryItemType,
  useStore,
} from '../store';
import { formatBalance as formatSwapBalance } from '../swap/balances/utils';
import { getTokenByKeyFromMap } from '../swap/tokens/hooks';
import { SwapHistoryItem, SwapStatus } from '../swap/types';
import { tryFindToken, useWarpCore } from '../tokens/hooks';
import { computeDestAmount, formatMessageAmount } from '../transfer/scaleUtils';
import { TransfersDetailsModal } from '../transfer/TransfersDetailsModal';
import { TransferContext, TransferStatus } from '../transfer/types';
import { getIconByTransferStatus, STATUSES_WITH_ICON } from '../transfer/utils';
import { startRelativeTimeTicker } from './relativeTimeTicker';

const HistoryItemType = {
  ...TransferItemType,
  Swap: 'swap',
} as const;

type HistoryItem =
  | TransferItem
  | { type: typeof HistoryItemType.Swap; data: SwapHistoryItem; transactionId: string };

export function SideBarMenu({
  onClickConnectWallet,
  isOpen,
  onClose,
}: {
  onClickConnectWallet: () => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<{
    transactionId?: string;
    data: TransferContext;
  } | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const multiProvider = useMultiProvider();

  const { transactionHistory, originChainName, routerAddressesByChainMap, knownTokens } = useStore(
    (s) => ({
      transactionHistory: s.transactionHistory,
      originChainName: s.originChainName,
      routerAddressesByChainMap: s.routerAddressesByChainMap,
      knownTokens: s.knownTokens,
    }),
  );
  const setSelectedTransactionId = useStore((s) => s.setSelectedTransactionId);

  const bridgeTransactions = useMemo(
    () =>
      transactionHistory.filter(
        (item): item is Extract<TransactionHistoryItem, { type: 'bridge' }> =>
          item.type === TransactionHistoryItemType.Bridge,
      ),
    [transactionHistory],
  );
  const prevBridgeTransactionsLengthRef = useRef(bridgeTransactions.length);

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

  // Get all warp route addresses from configured routes (already normalized)
  const warpRouteAddresses = useMemo(() => {
    const addresses: string[] = [];
    for (const addressSet of Object.values(routerAddressesByChainMap)) {
      for (const addr of addressSet) {
        addresses.push(addr);
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

  const swapMessageIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of transactionHistory) {
      if (item.type !== TransactionHistoryItemType.Swap) continue;
      for (const msg of item.data.msgIds ?? []) ids.add(msg.msgId);
    }
    return ids;
  }, [transactionHistory]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => !swapMessageIds.has(message.msgId)),
    [messages, swapMessageIds],
  );

  // Merge local bridge transactions with API messages
  const warpCore = useWarpCore();
  const allMergedTransfers = useMergedTransferHistory(
    bridgeTransactions.map((item) => item.data),
    visibleMessages,
  );

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

  const historyItems = useMemo<HistoryItem[]>(() => {
    const swapItems: HistoryItem[] = transactionHistory
      .filter(
        (item): item is Extract<TransactionHistoryItem, { type: 'swap' }> =>
          item.type === TransactionHistoryItemType.Swap,
      )
      .map((item) => ({
        type: HistoryItemType.Swap,
        data: item.data,
        transactionId: item.id,
      }));
    return [...mergedTransfers, ...swapItems].sort(
      (a, b) => getItemTimestamp(b) - getItemTimestamp(a),
    );
  }, [mergedTransfers, transactionHistory]);

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

  const handleItemClick = (item: HistoryItem) => {
    if (item.type === HistoryItemType.Swap) {
      setSelectedTransactionId(item.transactionId);
      return;
    }
    if (item.type === HistoryItemType.Local) {
      const transactionId = bridgeTransactions.find((entry) => entry.data === item.data)?.id;
      setSelectedTransfer({ transactionId, data: item.data });
    } else {
      setSelectedTransfer({ data: messageToTransferContext(item.data, multiProvider, warpCore) });
    }
    setIsModalOpen(true);
  };

  // Open modal when a new transfer is added (avoids showing stale data from the
  // previous transfer, which would happen if we triggered on transferLoading
  // because addTransfer is called after setTransferLoading(true)).
  useEffect(() => {
    const prev = prevBridgeTransactionsLengthRef.current;
    prevBridgeTransactionsLengthRef.current = bridgeTransactions.length;
    if (bridgeTransactions.length > prev) {
      const latest = bridgeTransactions[bridgeTransactions.length - 1];
      if (latest) {
        setSelectedTransfer({ transactionId: latest.id, data: latest.data });
        setIsModalOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- transfers.length increasing guarantees a new transfers ref; listing transfers would re-run on status updates
  }, [bridgeTransactions.length]);

  useEffect(() => {
    setIsMenuOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    return startRelativeTimeTicker({
      onTick: () => setNowMs(Date.now()),
    });
  }, [isMenuOpen]);

  return (
    <>
      <div
        className={`sidebar-menu fixed right-0 top-0 h-full w-88 transform bg-white/95 shadow-lg transition-transform duration-100 ease-in dark:border-l dark:border-primary-300/35 dark:bg-surface/95 ${
          isMenuOpen
            ? 'z-10 translate-x-0 dark:shadow-[-8px_0_32px_rgba(0,0,0,0.45)]'
            : 'z-0 translate-x-full'
        }`}
      >
        {isMenuOpen && (
          <button
            className="sidebar-menu-collapse absolute left-0 top-0 flex h-full w-9 -translate-x-full items-center justify-center rounded-l bg-accent-50/30 backdrop-blur-[1.5px] transition-all dark:border-r dark:border-primary-300/25 dark:bg-surface/70"
            onClick={() => onClose()}
          >
            <Image
              src={CollapseIcon}
              width={15}
              height={24}
              alt=""
              className="dark:opacity-85 dark:brightness-0 dark:invert"
            />
          </button>
        )}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex h-full w-full flex-col overflow-y-auto"
        >
          <div className="sidebar-menu-header w-full bg-accent-gradient px-3.5 py-2 text-base font-normal tracking-wider text-white shadow-accent-glow dark:!shadow-none">
            Connected Wallets
          </div>
          <AccountList
            multiProvider={multiProvider}
            onClickConnectWallet={onClickConnectWallet}
            onCopySuccess={onCopySuccess}
            className=""
            chainName={originChainName}
          />
          <div className="sidebar-menu-header flex w-full items-center justify-between bg-accent-gradient px-3.5 py-2 shadow-accent-glow dark:!shadow-none">
            <span className="text-base font-normal tracking-wider text-white">
              Transaction History
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
                  {historyItems.length === 0 && !isLoading && (
                    <div className="sidebar-menu-empty px-3.5 py-6 text-center text-sm text-gray-500 dark:text-foreground-primary">
                      No transactions yet
                    </div>
                  )}
                  {historyItems.map((item) => (
                    <TransferSummary
                      key={getItemKey(item)}
                      item={item}
                      onClick={() => handleItemClick(item)}
                      multiProvider={multiProvider}
                      warpCore={warpCore}
                      knownTokens={knownTokens}
                      nowMs={nowMs}
                    />
                  ))}
                </div>
                {isLoading && (
                  <div className="flex justify-center px-3.5 py-4">
                    <SpinnerIcon className="h-5 w-5" />
                  </div>
                )}
                {!hasMore && historyItems.length > 0 && (
                  <div className="sidebar-menu-end px-3.5 py-3 text-center text-xs text-gray-400 dark:text-foreground-primary">
                    No more transactions
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
          transfer={selectedTransfer.data}
          transactionId={selectedTransfer.transactionId}
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
  knownTokens,
  nowMs,
}: {
  item: HistoryItem;
  onClick: () => void;
  multiProvider: ReturnType<typeof useMultiProvider>;
  warpCore: ReturnType<typeof useWarpCore>;
  knownTokens: AppState['knownTokens'];
  nowMs: number;
}) {
  const {
    originChain,
    destChain,
    amount,
    destAmount,
    status,
    token,
    destToken,
    tokenSymbol,
    destTokenSymbol,
    timestamp,
  } = useMemo(() => {
    if (item.type === HistoryItemType.Swap) {
      const swap = item.data;
      const srcToken = getTokenByKeyFromMap(
        knownTokens,
        `${swap.srcChain}-${swap.srcToken.toLowerCase()}`,
      );
      const dstToken = getTokenByKeyFromMap(
        knownTokens,
        `${swap.dstChain}-${swap.dstToken.toLowerCase()}`,
      );
      const originChain =
        srcToken?.chainName ??
        swap.srcTokenMeta?.chainName ??
        multiProvider.tryGetChainName(swap.srcChain) ??
        '';
      const destChain =
        dstToken?.chainName ??
        swap.dstTokenMeta?.chainName ??
        multiProvider.tryGetChainName(swap.dstChain) ??
        '';
      const srcDecimals = srcToken?.decimals ?? swap.srcTokenMeta?.decimals;
      const dstDecimals = dstToken?.decimals ?? swap.dstTokenMeta?.decimals;
      return {
        originChain,
        destChain,
        amount: formatSwapHistoryAmount(swap.amountIn, srcDecimals),
        destAmount: formatSwapHistoryAmount(swap.amountOut, dstDecimals),
        status: swapStatusToTransferStatus(swap.status),
        token: srcToken,
        destToken: dstToken,
        tokenSymbol: srcToken?.symbol ?? swap.srcTokenMeta?.symbol,
        destTokenSymbol: dstToken?.symbol ?? swap.dstTokenMeta?.symbol,
        timestamp: swap.timestamp,
      };
    }
    if (item.type === TransferItemType.Local) {
      const t = item.data;
      const originToken = tryFindToken(warpCore, t.origin, t.originTokenAddressOrDenom);
      const destinationToken = tryFindToken(warpCore, t.destination, t.destTokenAddressOrDenom);
      return {
        originChain: t.origin,
        destChain: t.destination,
        amount: t.amount,
        destAmount: computeDestAmount(t.amount, originToken, destinationToken),
        status: t.status,
        token: originToken,
        destToken: destinationToken,
        timestamp: t.timestamp,
      };
    }
    const msg = item.data;
    const originChain = multiProvider.tryGetChainName(msg.originDomainId) || '';
    const destChain = multiProvider.tryGetChainName(msg.destinationDomainId) || '';
    const token = tryFindToken(warpCore, originChain, msg.sender);

    let amount = '';
    if (msg.warpTransfer?.amount && token) {
      try {
        amount = formatMessageAmount(msg.warpTransfer.amount, token);
      } catch (err) {
        logger.error('Failed to format warp transfer amount', err);
      }
    }

    const destToken = tryFindToken(warpCore, destChain, msg.recipient);

    return {
      originChain,
      destChain,
      amount,
      destAmount: computeDestAmount(amount, token, destToken),
      status:
        msg.status === MessageStatus.Delivered
          ? TransferStatus.Delivered
          : TransferStatus.ConfirmedTransfer,
      token,
      destToken,
      timestamp: msg.origin.timestamp,
    };
  }, [item.type, item.data, multiProvider, warpCore, knownTokens]);

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
              <span className="sidebar-menu-token-text text-sm font-normal text-gray-800 dark:text-foreground-primary">
                {amount}
              </span>
            )}
            <span
              className={`sidebar-menu-token-text text-sm font-normal text-gray-800 dark:text-foreground-primary ${amount ? 'ml-1' : ''}`}
            >
              {token?.symbol || tokenSymbol || 'Unknown token'}
            </span>
            {(destToken || destTokenSymbol) && (
              <>
                <Image
                  className="sidebar-menu-arrow mx-1 dark:opacity-85 dark:brightness-0 dark:invert"
                  src={ArrowRightIcon}
                  width={10}
                  height={10}
                  alt=""
                />
                {(destAmount || amount) && (
                  <span className="sidebar-menu-token-text text-sm font-normal text-gray-800 dark:text-foreground-primary">
                    {destAmount || amount}
                  </span>
                )}
                <span className="sidebar-menu-token-text ml-1 text-sm font-normal text-gray-800 dark:text-foreground-primary">
                  {destToken?.symbol || destTokenSymbol}
                </span>
              </>
            )}
          </div>
          <div className="mt-1 flex items-center">
            <span className="sidebar-menu-route-text text-xxs font-normal tracking-wide text-gray-900 dark:text-foreground-primary">
              {getChainDisplayName(multiProvider, originChain, true)}
            </span>
            <Image
              className="sidebar-menu-arrow mx-1 dark:opacity-85 dark:brightness-0 dark:invert"
              src={ArrowRightIcon}
              width={10}
              height={10}
              alt=""
            />
            <span className="sidebar-menu-route-text text-xxs font-normal tracking-wide text-gray-900 dark:text-foreground-primary">
              {getChainDisplayName(multiProvider, destChain, true)}
            </span>
          </div>
          <div className="sidebar-menu-time mt-1 w-full text-left text-xxs font-normal text-gray-500 dark:text-foreground-primary">
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

function getItemTimestamp(item: HistoryItem): number {
  if (item.type === HistoryItemType.Swap || item.type === HistoryItemType.Local)
    return item.data.timestamp;
  return item.data.origin.timestamp;
}

function getItemKey(item: HistoryItem): string {
  if (item.type === HistoryItemType.Swap) {
    return `swap-${item.transactionId}`;
  }
  if (item.type === TransferItemType.Local) {
    return `local-${item.data.timestamp}-${item.data.originTxHash || item.data.msgId || ''}`;
  }
  return `api-${item.data.msgId}`;
}

function formatSwapHistoryAmount(amount: string, decimals: number | undefined): string {
  if (decimals == null) return '';
  try {
    return formatSwapBalance(BigInt(amount), decimals);
  } catch {
    return '';
  }
}

function swapStatusToTransferStatus(status: SwapStatus): TransferStatus {
  if (status === SwapStatus.ConfirmedDestination) return TransferStatus.Delivered;
  if (status === SwapStatus.Failed || status === SwapStatus.DestSwapFailed)
    return TransferStatus.Failed;
  if (
    status === SwapStatus.Bridging ||
    status === SwapStatus.ConfirmingDestination ||
    status === SwapStatus.ConfirmingOrigin
  )
    return TransferStatus.ConfirmedTransfer;
  return TransferStatus.ConfirmingTransfer;
}

const styles = {
  btn: 'sidebar-menu-item flex w-full cursor-pointer items-center px-3.5 py-2 text-sm transition-all duration-500 hover:bg-gray-200 active:scale-95 dark:hover:bg-primary-300/10',
};
