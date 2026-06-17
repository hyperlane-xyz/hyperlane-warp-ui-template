import { SpinnerIcon } from '@hyperlane-xyz/widgets';
import { AccountList } from '@hyperlane-xyz/widgets/walletIntegrations/AccountList';
import { useAccounts } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { ChainLogo } from '../../components/icons/ChainLogo';
import { TokenChainIcon } from '../../components/icons/TokenChainIcon';
import { config } from '../../consts/config';
import ArrowRightIcon from '../../images/icons/arrow-right.svg';
import CollapseIcon from '../../images/icons/collapse-icon.svg';
import { formatTransferHistoryTimestamp } from '../../utils/date';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { type TransactionHistoryItem, TransactionHistoryItemType, useStore } from '../store';
import { formatBalance } from '../transfer/engine/balances/utils';
import { getTokenByKeyFromMap } from '../transfer/engine/tokens/hooks';
import { FinalTransferStatuses, TransferStatus } from '../transfer/engine/types';
import { startRelativeTimeTicker } from './relativeTimeTicker';

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
  const [nowMs, setNowMs] = useState(() => Date.now());
  const multiProvider = useMultiProvider();
  const { transactionHistory, originChainName, knownTokens } = useStore((s) => ({
    transactionHistory: s.transactionHistory,
    originChainName: s.originChainName,
    knownTokens: s.knownTokens,
  }));
  const setSelectedTransactionId = useStore((s) => s.setSelectedTransactionId);

  useAccounts(multiProvider, config.addressBlacklist);

  const historyItems = useMemo(
    () =>
      transactionHistory
        .filter(
          (
            item,
          ): item is Extract<
            TransactionHistoryItem,
            { type: typeof TransactionHistoryItemType.Transfer }
          > => item.type === TransactionHistoryItemType.Transfer,
        )
        .sort((a, b) => b.data.timestamp - a.data.timestamp),
    [transactionHistory],
  );

  const onCopySuccess = () => {
    toast.success('Address copied to clipboard', { autoClose: 2000 });
  };

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
      <div ref={scrollContainerRef} className="flex h-full w-full flex-col overflow-y-auto">
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
        </div>
        <div className="flex grow flex-col pb-4">
          <div className="sidebar-menu-list flex w-full grow flex-col divide-y">
            {historyItems.length === 0 && (
              <div className="sidebar-menu-empty px-3.5 py-6 text-center text-sm text-gray-500 dark:text-foreground-primary">
                No transactions yet
              </div>
            )}
            {historyItems.map((item) => (
              <TransferSummary
                key={item.id}
                item={item}
                onClick={() => setSelectedTransactionId(item.id)}
                multiProvider={multiProvider}
                knownTokens={knownTokens}
                nowMs={nowMs}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TransferSummary({
  item,
  onClick,
  multiProvider,
  knownTokens,
  nowMs,
}: {
  item: TransactionHistoryItem;
  onClick: () => void;
  multiProvider: ReturnType<typeof useMultiProvider>;
  knownTokens: ReturnType<typeof useStore.getState>['knownTokens'];
  nowMs: number;
}) {
  const transfer = item.data;
  const srcToken = getTokenByKeyFromMap(
    knownTokens,
    `${transfer.srcChain}-${transfer.srcToken.toLowerCase()}`,
  );
  const dstToken = getTokenByKeyFromMap(
    knownTokens,
    `${transfer.dstChain}-${transfer.dstToken.toLowerCase()}`,
  );
  const originChain =
    srcToken?.chainName ??
    transfer.srcTokenMeta?.chainName ??
    multiProvider.tryGetChainName(transfer.srcChain) ??
    '';
  const destChain =
    dstToken?.chainName ??
    transfer.dstTokenMeta?.chainName ??
    multiProvider.tryGetChainName(transfer.dstChain) ??
    '';
  const srcDecimals = srcToken?.decimals ?? transfer.srcTokenMeta?.decimals;
  const dstDecimals = dstToken?.decimals ?? transfer.dstTokenMeta?.decimals;
  const amount = formatHistoryAmount(transfer.amountIn, srcDecimals);
  const destAmount = formatHistoryAmount(transfer.amountOut, dstDecimals);
  const tokenSymbol = srcToken?.symbol ?? transfer.srcTokenMeta?.symbol ?? 'Unknown token';
  const destTokenSymbol = dstToken?.symbol ?? transfer.dstTokenMeta?.symbol;

  return (
    <button onClick={onClick} className={`${styles.btn} justify-between py-3`}>
      <div className="flex gap-2.5">
        <div className="flex h-[2.25rem] w-[2.25rem] items-center justify-center">
          {srcToken ? (
            <TokenChainIcon token={srcToken} size={32} />
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
              {tokenSymbol}
            </span>
            {destTokenSymbol && (
              <>
                <Image
                  className="sidebar-menu-arrow mx-1 dark:opacity-85 dark:brightness-0 dark:invert"
                  src={ArrowRightIcon}
                  width={10}
                  height={10}
                  alt=""
                />
                {destAmount && (
                  <span className="sidebar-menu-token-text text-sm font-normal text-gray-800 dark:text-foreground-primary">
                    {destAmount}
                  </span>
                )}
                <span className="sidebar-menu-token-text ml-1 text-sm font-normal text-gray-800 dark:text-foreground-primary">
                  {destTokenSymbol}
                </span>
              </>
            )}
          </div>
          <div className="mt-1 flex h-4 items-center">
            <span className="sidebar-menu-route-text text-xxs font-normal leading-4 tracking-wide text-gray-900 dark:text-foreground-primary">
              {getChainDisplayName(multiProvider, originChain, true)}
            </span>
            <Image
              className="sidebar-menu-arrow mx-1 dark:opacity-85 dark:brightness-0 dark:invert"
              src={ArrowRightIcon}
              width={10}
              height={10}
              alt=""
            />
            <span className="sidebar-menu-route-text text-xxs font-normal leading-4 tracking-wide text-gray-900 dark:text-foreground-primary">
              {getChainDisplayName(multiProvider, destChain, true)}
            </span>
            <span className="sidebar-menu-type-badge ml-1.5 inline-flex h-3.5 shrink-0 items-center rounded border border-accent-500/35 bg-accent-50/25 px-1.5 text-[0.55rem] font-medium leading-none text-accent-500 dark:border-primary-300/45 dark:bg-primary-300/15 dark:text-foreground-primary">
              Transfer
            </span>
          </div>
          <div className="sidebar-menu-time mt-1 w-full text-left text-xxs font-normal text-gray-500 dark:text-foreground-primary">
            {formatTransferHistoryTimestamp(transfer.timestamp, nowMs)}
          </div>
        </div>
      </div>
      <div className="ml-2 flex shrink-0 items-center">
        {FinalTransferStatuses.includes(transfer.status) ? (
          <span className="text-xs text-gray-500 dark:text-foreground-secondary">
            {transfer.status === TransferStatus.ConfirmedDestination ? 'Done' : 'Failed'}
          </span>
        ) : (
          <SpinnerIcon className="-ml-1 mr-3 h-5 w-5" />
        )}
      </div>
    </button>
  );
}

function formatHistoryAmount(amount: string, decimals: number | undefined): string {
  if (decimals == null) return '';
  try {
    return formatBalance(BigInt(amount), decimals);
  } catch {
    return '';
  }
}

const styles = {
  btn: 'sidebar-menu-item flex w-full cursor-pointer items-center px-3.5 py-2 text-sm transition-all duration-500 hover:bg-gray-200 active:scale-95 dark:hover:bg-primary-300/10',
};
