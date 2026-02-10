import { SwapStatus } from '../types';

interface SwapStatusDisplayProps {
  status: SwapStatus;
  txHash: string | null;
  error: string | null;
  onReset: () => void;
}

const SWAP_STEPS = [
  { status: SwapStatus.PostingCommitment, label: 'Preparing commitment...' },
  { status: SwapStatus.Approving, label: 'Approving token...' },
  { status: SwapStatus.Signing, label: 'Sign transaction...' },
  { status: SwapStatus.Confirming, label: 'Confirming on Arbitrum...' },
  { status: SwapStatus.Bridging, label: 'Bridging to Base...' },
  { status: SwapStatus.Executing, label: 'Executing on Base...' },
  { status: SwapStatus.Complete, label: 'Swap complete!' },
];

const STEP_ORDER = new Map(SWAP_STEPS.map((step, index) => [step.status, index]));

export function SwapStatusDisplay({ status, txHash, error, onReset }: SwapStatusDisplayProps) {
  if (status === SwapStatus.Idle) return null;

  return (
    <div className="mt-4 rounded-[7px] border border-gray-400/25 bg-white p-4 shadow-input">
      <div className="mb-3 flex items-center gap-2">
        {getStatusIcon(status)}
        <span className="font-secondary text-sm text-gray-900">{getStatusLabel(status)}</span>
      </div>

      <div className="space-y-2">
        {SWAP_STEPS.map((step) => (
          <StepIndicator
            key={step.status}
            label={step.label}
            isActive={status === step.status}
            isComplete={isStepComplete(status, step.status)}
            isFailed={status === SwapStatus.Failed && error !== null}
          />
        ))}
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {getUserFriendlyError(error)}
        </div>
      )}

      {txHash && (
        <div className="mt-3 text-sm text-gray-700">
          <a
            href={`https://arbiscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-500 hover:underline"
          >
            View on Arbiscan
          </a>
          {' | '}
          <a
            href={`https://explorer.hyperlane.xyz/?search=${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-500 hover:underline"
          >
            Track on Hyperlane Explorer
          </a>
        </div>
      )}

      {(status === SwapStatus.Failed || status === SwapStatus.Complete) && (
        <button
          type="button"
          onClick={onReset}
          className="mt-3 w-full rounded bg-primary-500 py-2 text-sm text-white transition-colors hover:bg-primary-600"
        >
          {status === SwapStatus.Failed ? 'Try Again' : 'New Swap'}
        </button>
      )}
    </div>
  );
}

function getStatusIcon(status: SwapStatus) {
  if (status === SwapStatus.Complete) {
    return (
      <svg
        className="h-4 w-4 text-green-600"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M16.704 5.29a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L8.75 11.836l6.543-6.546a1 1 0 011.41 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (status === SwapStatus.Failed) {
    return (
      <svg
        className="h-4 w-4 text-red-600"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-10.293a1 1 0 00-1.414-1.414L10 8.586 7.707 6.293a1 1 0 00-1.414 1.414L8.586 10l-2.293 2.293a1 1 0 101.414 1.414L10 11.414l2.293 2.293a1 1 0 001.414-1.414L11.414 10l2.293-2.293z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  return (
    <svg className="h-4 w-4 animate-spin text-primary-500" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function getStatusLabel(status: SwapStatus) {
  if (status === SwapStatus.FetchingQuote) return 'Fetching quote...';
  if (status === SwapStatus.ReviewMode) return 'Review swap details';
  if (status === SwapStatus.PostingCommitment) return 'Preparing swap';
  if (status === SwapStatus.Approving) return 'Approval in progress';
  if (status === SwapStatus.Signing) return 'Awaiting signature';
  if (status === SwapStatus.Confirming) return 'Confirming transaction';
  if (status === SwapStatus.Bridging) return 'Bridge in progress';
  if (status === SwapStatus.Executing) return 'Executing swap';
  if (status === SwapStatus.Complete) return 'Swap complete';
  if (status === SwapStatus.Failed) return 'Swap failed';
  return 'Swap status';
}

function isStepComplete(currentStatus: SwapStatus, stepStatus: SwapStatus) {
  const currentStep = STEP_ORDER.get(currentStatus);
  const targetStep = STEP_ORDER.get(stepStatus);
  if (currentStep === undefined || targetStep === undefined) return false;
  return currentStep > targetStep;
}

function getUserFriendlyError(error: string) {
  const normalized = error.toLowerCase();
  if (normalized.includes('failed to post commitment')) {
    return 'Failed to prepare swap. Please try again.';
  }
  if (normalized.includes('transaction cancelled')) {
    return 'Transaction cancelled.';
  }
  if (normalized.includes('execution reverted')) {
    return 'Swap failed on origin chain. No funds were moved.';
  }
  if (normalized.includes('timeout')) {
    return 'Bridge in progress. Track on Hyperlane Explorer.';
  }
  return 'Something went wrong. Please try again.';
}

function StepIndicator({
  label,
  isActive,
  isComplete,
  isFailed,
}: {
  label: string;
  isActive: boolean;
  isComplete: boolean;
  isFailed: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={`h-2 w-2 rounded-full ${
          isComplete
            ? 'bg-green-500'
            : isActive
              ? 'animate-pulse bg-primary-500'
              : isFailed
                ? 'bg-red-500'
                : 'bg-gray-300'
        }`}
      />
      <span
        className={
          isComplete
            ? 'text-green-700'
            : isActive
              ? 'font-medium text-primary-700'
              : isFailed
                ? 'text-red-500'
                : 'text-gray-400'
        }
      >
        {label}
      </span>
    </div>
  );
}
