import type { QuoteStep } from '../../api/types';
import { ProgressState } from '../../messages/progress';
import type { UiToken } from '../../tokens/types';
import { RouteFlowDiagram, type RouteStepProgress } from './routeSelection/RouteSelectionModal';
import { TransferStatus, type TransferHistoryItem } from './types';

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
  const { transfer } = props;
  const steps = transfer.routeSteps;
  const stages = getHyperswapProgress(props);
  if (!steps?.length || !stages.length) return null;
  const origin = stages.find((stage) => stage.label === 'Origin swap');
  const destination = stages.find((stage) => stage.label === 'Destination swap');
  const bridge = stages.find((stage) => stage.label === 'Transfer');
  // Wrapping is part of the successful origin transaction, even on routes with no origin swap.
  const originIncluded =
    !!transfer.msgIds?.length ||
    !!transfer.originTxTimestamp ||
    !!props.bridgeDelivered ||
    !!props.executionDelivered ||
    props.fundsAvailable;
  return (
    <div className="mt-4">
      <RouteFlowDiagram
        steps={steps}
        srcToken={props.srcToken}
        dstToken={props.dstToken}
        progress={{
          steps: steps.map((step) =>
            step.type === 'bridge'
              ? bridge
              : step.chain === transfer.srcChain
                ? origin
                : step.chain === transfer.dstChain
                  ? destination
                  : undefined,
          ),
          wrap: {
            label: 'Wrap',
            description: originIncluded ? 'Complete' : 'Waiting',
            state: originIncluded ? ProgressState.Confirmed : ProgressState.Pending,
          },
          unwrap: {
            label: 'Unwrap',
            description: props.fundsAvailable ? 'Complete' : 'Waiting',
            state: props.fundsAvailable ? ProgressState.Confirmed : ProgressState.Pending,
          },
        }}
      />
    </div>
  );
}
