import { shortenAddress } from '@hyperlane-xyz/utils';

interface SwapReviewProps {
  originToken: { symbol: string; amount: string };
  destinationToken: { symbol: string; estimatedOutput: string };
  quote: {
    originSwapRate: string;
    bridgeFee: string;
    estimatedOutput: string;
    minimumReceived: string;
    slippage: number;
  } | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  icaAddress?: string | null;
}

export function SwapReviewModal({
  originToken,
  destinationToken,
  quote,
  onConfirm,
  onCancel,
  isLoading,
  icaAddress,
}: SwapReviewProps) {
  return (
    <div className="rounded-[7px] border border-gray-400/25 bg-white p-4 shadow-input">
      <h3 className="font-secondary text-base text-gray-900">{"You're swapping"}</h3>

      <div className="mt-3 rounded border border-gray-300 bg-gray-150 px-3 py-2">
        <div className="font-secondary text-lg text-gray-900">
          {originToken.amount || '0'} {originToken.symbol}
        </div>
        <div className="my-2 text-center text-gray-500">-&gt;</div>
        <div className="font-secondary text-lg text-gray-900">
          {destinationToken.estimatedOutput || quote?.estimatedOutput || '0'}{' '}
          {destinationToken.symbol}
        </div>
      </div>

      {quote && (
        <div className="mt-3 space-y-2 rounded border border-gray-400/25 bg-gray-150 px-3 py-2 text-sm text-gray-700">
          <div className="flex items-center justify-between gap-3">
            <span>Exchange rate</span>
            <span className="text-right text-gray-900">{quote.originSwapRate}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Bridge fee</span>
            <span className="text-right text-gray-900">{quote.bridgeFee}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Minimum received</span>
            <span className="text-right text-gray-900">{quote.minimumReceived}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Slippage</span>
            <span className="text-right text-gray-900">{quote.slippage}%</span>
          </div>
        </div>
      )}

      <div className="mt-3 rounded border border-primary-100 bg-primary-50 px-3 py-2 text-sm text-primary-700">
        <div>Funds will arrive in your Interchain Account on Base.</div>
        <div className="mt-1 text-xs text-primary-600">
          ICA address: {icaAddress ? shortenAddress(icaAddress) : 'Unavailable'}
        </div>
      </div>

      <button
        type="button"
        onClick={onConfirm}
        disabled={isLoading}
        className="mt-4 flex w-full items-center justify-center rounded bg-primary-500 py-2 text-sm text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Confirming...
          </span>
        ) : (
          'Confirm Swap'
        )}
      </button>

      <button
        type="button"
        onClick={onCancel}
        disabled={isLoading}
        className="mt-2 w-full text-sm text-primary-500 underline-offset-2 transition-colors hover:underline disabled:text-gray-400"
      >
        Cancel
      </button>
    </div>
  );
}
