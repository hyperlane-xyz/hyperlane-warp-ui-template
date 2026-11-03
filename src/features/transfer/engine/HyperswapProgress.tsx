import { SpinnerIcon } from '@hyperlane-xyz/widgets';

import { ChainLogo } from '../../../components/icons/ChainLogo';
import { TokenChainIcon } from '../../../components/icons/TokenChainIcon';
import type { QuoteStep } from '../../api/types';
import { useMultiProvider } from '../../chains/hooks';
import { getChainDisplayName } from '../../chains/utils';
import { ProgressState } from '../../messages/progress';
import { getTokenByKeyFromMap, useTokenByKeyMap } from '../../tokens/hooks';
import type { UiToken } from '../../tokens/types';
import { tokenKey } from '../../tokens/utils';
import { useRouteChainTokens } from './routeSelection/hooks';
import { buildFlowNodes } from './routeSelection/utils';
import { TransferStatus, type TransferHistoryItem } from './types';

interface RouteStepProgress {
  label: string;
  description: string;
  state: ProgressState;
  active?: boolean;
}

export function getSwapStages(
  steps: QuoteStep[],
  origin: number,
  destination: number,
): { origin: boolean; destination: boolean } | undefined {
  if (origin === destination || !steps.some((step) => step.type === 'bridge')) return undefined;
  const swaps = {
    origin: steps.some((step) => step.type === 'swap' && step.chain === origin),
    destination: steps.some((step) => step.type === 'swap' && step.chain === destination),
  };
  return swaps.origin || swaps.destination ? swaps : undefined;
}

interface HyperswapProgressProps {
  transfer: TransferHistoryItem;
  bridgeDelivered?: boolean;
  executionDelivered?: boolean;
  fundsAvailable: boolean;
  srcToken?: UiToken | null;
  dstToken?: UiToken | null;
}

export function getHyperswapProgress({
  transfer,
  bridgeDelivered,
  executionDelivered,
  fundsAvailable,
}: HyperswapProgressProps): RouteStepProgress[] {
  const swaps = getSwapStages(transfer.routeSteps ?? [], transfer.srcChain, transfer.dstChain);
  if (!swaps || (!swaps.origin && !swaps.destination) || transfer.srcChain === transfer.dstChain)
    return [];
  // A verified final payout also proves transfer completion if message indexing lags.
  const transferDelivered = fundsAvailable || !!bridgeDelivered;
  const status = transfer.status;
  const failed = status === TransferStatus.Failed;
  const destinationFailed =
    status === TransferStatus.DestFailed ||
    status === TransferStatus.DestTransferFailed ||
    status === TransferStatus.FailedRecovered;
  const originDone =
    !!transferDelivered ||
    !!executionDelivered ||
    !!transfer.msgIds?.length ||
    [
      TransferStatus.Bridging,
      TransferStatus.ConfirmingDestination,
      TransferStatus.ConfirmedDestination,
      TransferStatus.DestFailed,
      TransferStatus.DestTransferFailed,
      TransferStatus.FailedRecovered,
    ].includes(status);
  const originDescription = failed
    ? 'Not completed'
    : status === TransferStatus.SigningTransfer
      ? 'Awaiting wallet'
      : status === TransferStatus.ConfirmingOrigin
        ? 'Confirming'
        : 'Preparing';
  const stages: RouteStepProgress[] = [];
  if (swaps.origin)
    stages.push({
      label: 'Origin swap',
      description: originDone ? 'Complete' : originDescription,
      state: originDone
        ? ProgressState.Confirmed
        : failed
          ? ProgressState.Failed
          : ProgressState.Pending,
      active: !originDone && !failed,
    });
  stages.push({
    label: 'Transfer',
    description: transferDelivered
      ? 'Delivered'
      : failed
        ? 'Stopped'
        : originDone
          ? 'Awaiting delivery'
          : swaps.origin
            ? 'Waiting'
            : originDescription,
    state: transferDelivered
      ? ProgressState.Confirmed
      : failed
        ? ProgressState.Failed
        : ProgressState.Pending,
    active: !transferDelivered && !failed && (originDone || !swaps.origin),
  });
  if (swaps.destination)
    stages.push({
      label: 'Destination swap',
      description: destinationFailed
        ? 'Not completed'
        : failed
          ? 'Not started'
          : fundsAvailable && transferDelivered
            ? 'Complete'
            : !transferDelivered
              ? 'Waiting'
              : executionDelivered
                ? 'Checking outcome'
                : 'Awaiting authorization',
      state: destinationFailed
        ? ProgressState.Failed
        : fundsAvailable && transferDelivered
          ? ProgressState.Confirmed
          : ProgressState.Pending,
      active: !!transferDelivered && !fundsAvailable && !failed && !destinationFailed,
    });
  return stages;
}

export function HyperswapProgress(props: HyperswapProgressProps) {
  const { transfer, srcToken, dstToken } = props;
  const steps = transfer.routeSteps ?? [];
  const tokenMap = useTokenByKeyMap();
  const multiProvider = useMultiProvider();
  useRouteChainTokens(steps);
  const stages = getHyperswapProgress(props);
  if (!steps.length || !stages.length) return null;
  const nodes = buildFlowNodes(steps, { destinationTokenAddress: transfer.dstToken });

  return (
    <section
      aria-label="Hyperswap route"
      className="mt-6 flex flex-wrap items-center justify-center gap-x-1 gap-y-5"
    >
      {nodes.map((node, index) => {
        // Native endpoints absorb wrapping/unwrapping; the status route shows the assets the user sends and receives.
        const token =
          index === 0
            ? srcToken
            : index === nodes.length - 1
              ? dstToken
              : getTokenByKeyFromMap(tokenMap, tokenKey(node.chainId, node.tokenAddress));
        const chainName = multiProvider.tryGetChainName(node.chainId) ?? undefined;
        const chainLabel = chainName
          ? getChainDisplayName(multiProvider, chainName, true)
          : String(node.chainId);
        const symbol =
          token?.symbol ??
          (index === 0
            ? transfer.srcTokenMeta?.symbol
            : index === nodes.length - 1
              ? transfer.dstTokenMeta?.symbol
              : undefined) ??
          '?';
        const step = index > 0 ? steps[index - 1] : undefined;
        const label =
          step?.type === 'bridge'
            ? 'Transfer'
            : step?.chain === transfer.srcChain
              ? 'Origin swap'
              : step?.chain === transfer.dstChain
                ? 'Destination swap'
                : 'Swap';
        const progress = stages.find((stage) => stage.label === label);
        return (
          <div key={index} className="hyperswap-leg flex items-center gap-1">
            {step && <RouteConnector label={label} progress={progress} />}
            <div
              className="hyperswap-asset flex w-10 shrink-0 flex-col items-center gap-1.5 sm:w-11"
              title={`${symbol} on ${chainLabel}`}
            >
              {token ? (
                <TokenChainIcon token={token} size={32} />
              ) : (
                <ChainLogo chainName={chainName} size={32} />
              )}
              <span className="max-w-full truncate text-xs text-foreground-muted">{symbol}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function RouteConnector({ label, progress }: { label: string; progress?: RouteStepProgress }) {
  const complete = progress?.state === ProgressState.Confirmed;
  const failed = progress?.state === ProgressState.Failed;
  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- A route operation is a group, not a form fieldset or disclosure.
      role="group"
      aria-label={`${label}: ${progress?.description ?? 'Waiting'}`}
      aria-current={progress?.active ? 'step' : undefined}
      data-state={progress?.state}
      title={`${label}: ${progress?.description ?? 'Waiting'}`}
      className="hyperswap-step relative flex h-14 w-12 shrink-0 items-center text-gray-400/60 sm:w-24"
    >
      <span className="absolute inset-x-0 top-0 whitespace-nowrap text-center text-xxs text-foreground-muted">
        <span className="sm:hidden">{label === 'Transfer' ? label : 'Swap'}</span>
        <span className="hidden sm:inline">{label}</span>
      </span>
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-1/2 flex h-2.5 w-2.5 -translate-x-1/2 items-center justify-center"
      >
        {complete ? (
          '✓'
        ) : failed ? (
          '!'
        ) : progress?.active ? (
          <SpinnerIcon
            width={10}
            height={10}
            color="currentColor"
            className="message-status-spinner"
          />
        ) : null}
      </span>
      <svg
        aria-hidden="true"
        className="hyperswap-arrow w-full"
        height="14"
        viewBox="0 0 100 14"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d="M1 7h96m-5-5 5 5-5 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
