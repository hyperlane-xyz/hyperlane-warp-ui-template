import {
  CopyButton,
  MessageStage,
  MessageStatus,
  MessageTimeline,
  Modal,
  SpinnerIcon,
  type StageTimings,
  WideChevronIcon,
} from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ChainLogo } from '../../components/icons/ChainLogo';
import { TokenChainIcon } from '../../components/icons/TokenChainIcon';
import { ModalHeader } from '../../components/layout/ModalHeader';
import ArrowRightIcon from '../../images/icons/arrow-right.svg';
import LinkIcon from '../../images/icons/external-link-icon.svg';
import { Color } from '../../styles/Color';
import { formatTimestamp } from '../../utils/date';
import { getHypExplorerLink } from '../../utils/links';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { getSwapDeliveryMsgId } from '../messages/utils';
import { TransactionHistoryItemType, useStore } from '../store';
import { formatDisplayAmount } from './balances/utils';
import { getTokenByKeyFromMap, useTokenByKeyMap } from './tokens/hooks';
import { FinalSwapStatuses, SwapStatus, type SwapHistoryItem } from './types';

const DEFAULT_TIMINGS: StageTimings = {
  [MessageStage.Finalized]: null,
  [MessageStage.Validated]: null,
  [MessageStage.Relayed]: null,
};

const LABEL_NAMES: Record<string, string> = {
  warp: 'Warp Message ID',
  commit: 'Commit Message ID',
};

const STATUS_DESCRIPTION: Record<SwapStatus, string> = {
  [SwapStatus.Preparing]: 'Preparing transaction…',
  [SwapStatus.CreatingTxs]: 'Submitting commitment to CCS…',
  [SwapStatus.SigningApprove]: 'Awaiting approval signature in your wallet…',
  [SwapStatus.ConfirmingApprove]: 'Confirming approval on origin chain…',
  [SwapStatus.SigningSwap]: 'Awaiting swap signature in your wallet…',
  [SwapStatus.ConfirmingOrigin]: 'Confirming on origin chain…',
  [SwapStatus.Bridging]: 'Swapping via Hyperlane…',
  [SwapStatus.ConfirmingDestination]: 'Confirming on destination chain…',
  [SwapStatus.ConfirmedDestination]: 'Delivered',
  [SwapStatus.DestSwapFailed]: 'Destination swap reverted',
  [SwapStatus.Failed]: 'Swap failed',
};

const CONFIRMING_ORIGIN_HINT_DELAY_MS = 60_000;
const CONFIRMING_ORIGIN_AUTO_FAIL_DELAY_MS = 120_000;

export function SwapDetailsModal() {
  const selectedTransactionId = useStore((s) => s.selectedTransactionId);
  const transactionHistory = useStore((s) => s.transactionHistory);
  const setSelectedTransactionId = useStore((s) => s.setSelectedTransactionId);
  const close = () => setSelectedTransactionId(null);

  const isOpen = selectedTransactionId != null;

  // Keep the last id alive after close so delivery polling continues in background.
  const lastIdRef = useRef<string | null>(null);
  if (selectedTransactionId != null) lastIdRef.current = selectedTransactionId;

  const renderedId = lastIdRef.current;
  const item =
    renderedId != null ? transactionHistory.find((entry) => entry.id === renderedId) : undefined;
  const swap = item?.type === TransactionHistoryItemType.Swap ? item.data : undefined;

  if (!swap || renderedId == null) return <Modal isOpen={false} close={close} />;
  return (
    <SwapDetailsModalInner isOpen={isOpen} close={close} swap={swap} transactionId={renderedId} />
  );
}

function SwapDetailsModalInner({
  isOpen,
  close,
  swap,
  transactionId,
}: {
  isOpen: boolean;
  close: () => void;
  swap: SwapHistoryItem;
  transactionId: string;
}) {
  const multiProvider = useMultiProvider();
  const tokenMap = useTokenByKeyMap();
  const {
    status,
    srcChain,
    dstChain,
    srcToken: srcTokenAddr,
    dstToken: dstTokenAddr,
    amountIn,
    amountOut,
    sender,
    recipient,
    originTxHash,
    destinationTxHash,
    msgIds,
    timestamp,
  } = swap;

  const originChain = multiProvider.tryGetChainName(srcChain) ?? `chain ${srcChain}`;
  const destChain = multiProvider.tryGetChainName(dstChain) ?? `chain ${dstChain}`;

  const srcToken = getTokenByKeyFromMap(tokenMap, `${srcChain}-${srcTokenAddr.toLowerCase()}`);
  const dstToken = getTokenByKeyFromMap(tokenMap, `${dstChain}-${dstTokenAddr.toLowerCase()}`);
  const srcSymbol = srcToken?.symbol ?? swap.srcTokenMeta?.symbol ?? '';
  const dstSymbol = dstToken?.symbol ?? swap.dstTokenMeta?.symbol ?? '';
  const srcDecimals = srcToken?.decimals ?? swap.srcTokenMeta?.decimals;
  const dstDecimals = dstToken?.decimals ?? swap.dstTokenMeta?.decimals;

  const isFailed = status === SwapStatus.Failed;
  const isDestFailed = status === SwapStatus.DestSwapFailed;
  const isDelivered = status === SwapStatus.ConfirmedDestination;
  const isFinal = FinalSwapStatuses.includes(status);

  const pollingMsgId = getSwapDeliveryMsgId(msgIds);

  const isSent =
    status === SwapStatus.ConfirmingOrigin ||
    status === SwapStatus.Bridging ||
    status === SwapStatus.ConfirmingDestination ||
    status === SwapStatus.ConfirmedDestination ||
    isDestFailed;

  const stage = useMemo<MessageStage>(() => {
    if (isDelivered) return MessageStage.Relayed;
    if (status === SwapStatus.ConfirmingDestination) return MessageStage.Validated;
    if (status === SwapStatus.Bridging) return MessageStage.Finalized;
    if (status === SwapStatus.ConfirmingOrigin) return MessageStage.Sent;
    return MessageStage.Preparing;
  }, [status, isDelivered]);

  const messageStatus = isDelivered
    ? MessageStatus.Delivered
    : isFailed || isDestFailed
      ? MessageStatus.Failing
      : MessageStatus.Pending;

  // Show timeline only for cross-chain swaps (msgIds present).
  const showTimeline = isSent && !isFailed && !!originTxHash && !!pollingMsgId;

  const date = useMemo(
    () => (timestamp ? formatTimestamp(timestamp) : formatTimestamp(Date.now())),
    [timestamp],
  );

  const [fromUrl, setFromUrl] = useState('');
  const [toUrl, setToUrl] = useState('');
  const [originTxUrl, setOriginTxUrl] = useState('');
  const [destTxUrl, setDestTxUrl] = useState('');
  useEffect(() => {
    let cancelled = false;
    setFromUrl('');
    setToUrl('');
    setOriginTxUrl('');
    setDestTxUrl('');
    (async () => {
      try {
        if (originTxHash) {
          const url = multiProvider.tryGetExplorerTxUrl(originChain, { hash: originTxHash });
          if (url && !cancelled) setOriginTxUrl(fixDoubleSlash(url));
        }
        if (destinationTxHash) {
          const url = multiProvider.tryGetExplorerTxUrl(destChain, { hash: destinationTxHash });
          if (url && !cancelled) setDestTxUrl(fixDoubleSlash(url));
        }
        const [f, t] = await Promise.all([
          multiProvider.tryGetExplorerAddressUrl(originChain, sender),
          multiProvider.tryGetExplorerAddressUrl(destChain, recipient),
        ]);
        if (cancelled) return;
        if (f) setFromUrl(fixDoubleSlash(f));
        if (t) setToUrl(fixDoubleSlash(t));
      } catch (err) {
        logger.error('Error fetching explorer URLs', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [multiProvider, originChain, destChain, originTxHash, destinationTxHash, sender, recipient]);

  return (
    <Modal isOpen={isOpen} close={close} panelClassname="transfer-details-modal max-w-sm">
      <ModalHeader className="h-8 shadow-accent-glow" />
      <div className="p-4">
        {isFinal && (
          <div className="flex justify-between">
            <h2 className="text-xs font-normal text-gray-900 dark:text-foreground-primary">
              {date}
            </h2>
            <div className="flex items-center text-xs font-normal">
              {isDelivered ? (
                <h3 className="text-green-50">Delivered</h3>
              ) : isDestFailed ? (
                <h3 className="text-amber-600">Stranded</h3>
              ) : (
                <h3 className="text-red-500">Failed</h3>
              )}
            </div>
          </div>
        )}

        <div>
          <div className="mt-4 flex w-full items-center justify-center rounded-sm border border-gray-400/25 bg-card-gradient py-2 shadow-card">
            <div className="flex items-center font-secondary text-sm font-normal">
              <span>{formatAmount(amountIn, srcDecimals)}</span>
              <span className="ml-1">{srcSymbol}</span>
              <Image className="mx-2" src={ArrowRightIcon} width={10} height={10} alt="" />
              <span>{formatAmount(amountOut, dstDecimals)}</span>
              <span className="ml-1">{dstSymbol}</span>
            </div>
          </div>

          <div className="-mt-2 grid grid-cols-[1fr_auto_1fr] items-center rounded-sm border border-gray-400/25 bg-card-gradient py-5 shadow-card">
            <div className="flex flex-col items-center">
              {srcToken ? (
                <TokenChainIcon token={srcToken} size={36} />
              ) : (
                <ChainLogo chainName={originChain} size={36} />
              )}
              <span className="mt-1 text-xs font-medium tracking-wider">{srcSymbol}</span>
              <span className="text-xxs font-normal tracking-wider text-gray-500">
                {getChainDisplayName(multiProvider, originChain, true)}
              </span>
            </div>
            <div className="mb-6 flex justify-center sm:space-x-1.5">
              <WideChevron />
              <WideChevron />
            </div>
            <div className="flex flex-col items-center">
              {dstToken ? (
                <TokenChainIcon token={dstToken} size={36} />
              ) : (
                <ChainLogo chainName={destChain} size={36} />
              )}
              <span className="mt-1 text-xs font-medium tracking-wider">{dstSymbol}</span>
              <span className="text-xxs font-normal tracking-wider text-gray-500">
                {getChainDisplayName(multiProvider, destChain, true)}
              </span>
            </div>
          </div>
        </div>

        {showTimeline && (
          <div className="mt-4 rounded border border-gray-400/25 bg-card-gradient p-3 shadow-card">
            <h4 className="mb-1 font-secondary text-sm text-gray-900 dark:text-foreground-primary">
              Status
            </h4>
            <div className="flex w-full flex-col items-center justify-center [&_h4]:text-[clamp(0.625rem,0.7rem,0.75rem)]">
              <MessageTimeline
                status={messageStatus}
                stage={stage}
                timings={DEFAULT_TIMINGS}
                timestampSent={timestamp}
                hideDescriptions={true}
                iconPosition="inline"
                barClassName="bg-accent-gradient"
              />
            </div>
          </div>
        )}

        {isFinal ? (
          <div className="mt-5 flex flex-col space-y-4">
            {isDestFailed && (
              <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                Origin succeeded and the bridge delivered, but the destination swap reverted. Funds
                are sitting in your ICA — recovery is not yet wired in.
              </div>
            )}
            <TransferProperty name="Sender Address" value={sender} url={fromUrl} />
            <TransferProperty name="Recipient Address" value={recipient} url={toUrl} />
            {originTxHash && (
              <TransferProperty
                name="Origin Transaction Hash"
                value={originTxHash}
                url={originTxUrl}
              />
            )}
            {destinationTxHash && (
              <TransferProperty
                name="Destination Transaction Hash"
                value={destinationTxHash}
                url={destTxUrl}
              />
            )}
            {msgIds?.map(({ msgId: id, label }) => (
              <TransferProperty
                key={id}
                name={LABEL_NAMES[label] ?? 'Message ID'}
                value={id}
                url={getHypExplorerLink(multiProvider, originChain, id) ?? undefined}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4">
            <SpinnerIcon width={60} height={60} className="transfer-details-spinner mt-3" />
            <div className="mt-5 text-center text-sm text-gray-600 dark:text-foreground-muted">
              {STATUS_DESCRIPTION[status]}
            </div>
            {status === SwapStatus.ConfirmingOrigin && (
              <ConfirmingOriginHint swap={swap} transactionId={transactionId} />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function TransferProperty({ name, value, url }: { name: string; value: string; url?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs leading-normal tracking-wider text-gray-350">{name}</label>
        <div className="flex items-center space-x-2">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Image src={LinkIcon} width={14} height={14} alt="" />
            </a>
          )}
          <CopyButton copyValue={value} width={14} height={14} className="opacity-40" />
        </div>
      </div>
      <div className="mt-1 truncate text-xs leading-normal tracking-wider text-gray-900 dark:text-foreground-primary">
        {value}
      </div>
    </div>
  );
}

function WideChevron() {
  return (
    <WideChevronIcon
      width="16"
      height="100%"
      direction="e"
      color={Color.gray['300']}
      rounded={true}
    />
  );
}

function fixDoubleSlash(url: string) {
  return url.replace(/([^:]\/)\/+/g, '$1');
}

function formatAmount(amount: string, decimals: number | undefined): string {
  if (decimals == null) return `${amount} (atomic)`;
  try {
    return formatDisplayAmount(BigInt(amount), decimals);
  } catch {
    return amount;
  }
}

function ConfirmingOriginHint({
  swap,
  transactionId,
}: {
  swap: SwapHistoryItem;
  transactionId: string;
}) {
  const [showHint, setShowHint] = useState(false);
  const updateSwapTransactionStatus = useStore((s) => s.updateSwapTransactionStatus);

  useEffect(() => {
    const hintTimer = setTimeout(() => setShowHint(true), CONFIRMING_ORIGIN_HINT_DELAY_MS);
    const failTimer = setTimeout(() => {
      updateSwapTransactionStatus(transactionId, SwapStatus.Failed, {
        originTxHash: swap.originTxHash,
      });
    }, CONFIRMING_ORIGIN_AUTO_FAIL_DELAY_MS);
    return () => {
      clearTimeout(hintTimer);
      clearTimeout(failTimer);
    };
  }, [transactionId, swap.originTxHash, updateSwapTransactionStatus]);

  if (!showHint) return null;
  return (
    <div className="mt-4 max-w-[24rem] text-center text-xs text-gray-500 dark:text-foreground-muted">
      If your transaction hasn&apos;t been confirmed by now, it has most likely failed in your
      wallet.
    </div>
  );
}
