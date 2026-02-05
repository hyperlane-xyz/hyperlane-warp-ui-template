import { fromWei } from '@hyperlane-xyz/utils';
import { useAccounts, AccountList, SpinnerIcon, RefreshIcon } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { config } from '../../consts/config';
import ArrowRightIcon from '../../images/icons/arrow-right.svg';
import CollapseIcon from '../../images/icons/collapse-icon.svg';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { useMessageHistory } from '../messages/useMessageHistory';
import { MessageStatus, MessageStub } from '../messages/types';
import { useStore } from '../store';
import { tryFindToken, useWarpCore } from '../tokens/hooks';
import { TransfersDetailsModal } from '../transfer/TransfersDetailsModal';
import { TransferContext, TransferStatus } from '../transfer/types';
import { getIconByTransferStatus, STATUSES_WITH_ICON } from '../transfer/utils';

// Union type for transfer items from both local state and API
type TransferItem =
  | { type: 'local'; data: TransferContext }
  | { type: 'api'; data: MessageStub };

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

  // Get all connected wallet addresses
  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);
  const walletAddresses = useMemo(() => {
    const addresses: string[] = [];
    Object.values(accounts).forEach((accountInfo) => {
      if (accountInfo.addresses) {
        accountInfo.addresses.forEach((addrInfo) => {
          if (addrInfo.address) addresses.push(addrInfo.address);
        });
      }
    });
    return addresses;
  }, [accounts]);

  // Get all warp route addresses from configured routes
  const warpRouteAddresses = useMemo(() => {
    const addresses: string[] = [];
    Object.values(routerAddressesByChainMap).forEach((addressSet) => {
      addressSet.forEach((addr) => addresses.push(addr));
    });
    return addresses;
  }, [routerAddressesByChainMap]);

  // Fetch message history from API
  const { messages, isLoading, hasMore, loadMore, refresh } = useMessageHistory(
    walletAddresses,
    warpRouteAddresses,
    multiProvider,
  );

  // Merge local transfers with API messages
  const mergedTransfers = useMemo((): TransferItem[] => {
    const apiMsgIds = new Set(messages.map((m) => m.msgId));

    // Local transfers that aren't in API yet
    const localItems: TransferItem[] = transfers
      .filter((t) => !t.msgId || !apiMsgIds.has(t.msgId))
      .map((t) => ({ type: 'local' as const, data: t }));

    // API messages
    const apiItems: TransferItem[] = messages.map((m) => ({ type: 'api' as const, data: m }));

    // Sort by timestamp descending
    return [...localItems, ...apiItems].sort((a, b) => {
      const tsA = a.type === 'local' ? a.data.timestamp : a.data.origin.timestamp;
      const tsB = b.type === 'local' ? b.data.timestamp : b.data.origin.timestamp;
      return tsB - tsA;
    });
  }, [transfers, messages]);

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

  const warpCore = useWarpCore();

  const handleItemClick = (item: TransferItem) => {
    if (item.type === 'local') {
      setSelectedTransfer(item.data);
    } else {
      // Convert API message to TransferContext for modal
      const msg = item.data;
      const originChain = multiProvider.tryGetChainName(msg.originDomainId) || '';
      const destChain = multiProvider.tryGetChainName(msg.destinationDomainId) || '';

      // Use actual sender (tx sender) and recipient (from warp message body)
      const actualSender = msg.origin.from;
      const actualRecipient = msg.warpTransfer?.recipient || msg.recipient;

      // Format amount if available
      let formattedAmount = '';
      const token = tryFindToken(warpCore, originChain, msg.sender);
      if (msg.warpTransfer?.amount && token?.decimals) {
        formattedAmount = fromWei(msg.warpTransfer.amount, token.decimals);
      }

      setSelectedTransfer({
        status:
          msg.status === MessageStatus.Delivered
            ? TransferStatus.Delivered
            : TransferStatus.ConfirmedTransfer,
        origin: originChain,
        destination: destChain,
        amount: formattedAmount,
        sender: actualSender,
        recipient: actualRecipient,
        originTxHash: msg.origin.hash,
        msgId: msg.msgId,
        timestamp: msg.origin.timestamp,
        // Store the warp route address to look up the token
        originTokenAddressOrDenom: msg.sender,
      });
    }
    setIsModalOpen(true);
  };

  return (
    <>
      <div
        className={`fixed right-0 top-0 h-full w-88 transform bg-white bg-opacity-95 shadow-lg transition-transform duration-100 ease-in ${
          isMenuOpen ? 'z-10 translate-x-0' : 'z-0 translate-x-full'
        }`}
      >
        {isMenuOpen && (
          <button
            className="absolute left-0 top-0 flex h-full w-9 -translate-x-full items-center justify-center rounded-l-md bg-white bg-opacity-60 transition-all hover:bg-opacity-80"
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
          <div className="w-full rounded-t-md bg-primary-500 px-3.5 py-2 text-base font-normal tracking-wider text-white">
            Connected Wallets
          </div>
          <AccountList
            multiProvider={multiProvider}
            onClickConnectWallet={onClickConnectWallet}
            onCopySuccess={onCopySuccess}
            className="px-3 py-3"
            chainName={originChainName}
          />
          <div className="flex w-full items-center justify-between bg-primary-500 px-3.5 py-2">
            <span className="text-base font-normal tracking-wider text-white">
              Transfer History
            </span>
            <button
              onClick={refresh}
              disabled={isLoading}
              className="rounded p-1 hover:bg-primary-400 disabled:opacity-50"
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
            <div className="flex w-full grow flex-col divide-y">
              {mergedTransfers.length === 0 && !isLoading && (
                <div className="py-6 text-center text-sm text-gray-500">No transfers yet</div>
              )}
              {mergedTransfers.map((item, i) => (
                <TransferSummary key={i} item={item} onClick={() => handleItemClick(item)} />
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

function TransferSummary({ item, onClick }: { item: TransferItem; onClick: () => void }) {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  if (item.type === 'local') {
    return <LocalTransferSummary transfer={item.data} onClick={onClick} />;
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

  // Format amount if available
  let formattedAmount = '';
  if (msg.warpTransfer?.amount && token?.decimals) {
    formattedAmount = fromWei(msg.warpTransfer.amount, token.decimals);
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
              <span className={`text-sm font-normal text-gray-800 ${formattedAmount ? 'ml-1' : ''}`}>
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
