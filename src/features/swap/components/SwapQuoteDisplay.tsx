import { SwapQuote } from '../types';

interface Props {
  quote: SwapQuote | null;
  isLoading: boolean;
  error: string | null;
}

export function SwapQuoteDisplay({ quote, isLoading, error }: Props) {
  if (isLoading) {
    return (
      <div className="rounded border border-gray-400/25 bg-gray-150 px-3 py-2 text-sm text-gray-800">
        <div className="mb-2 h-4 w-40 animate-pulse rounded bg-gray-300" />
        <div className="space-y-1.5">
          <div className="h-3 w-full animate-pulse rounded bg-gray-250" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-gray-250" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-gray-250" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
        Quote unavailable: {error}
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="rounded border border-gray-400/25 bg-gray-150 px-3 py-2 text-sm text-gray-600">
        Enter an amount to fetch a quote.
      </div>
    );
  }

  const outputSymbol = quote.destinationSwapRate.split(' ').at(-1) || '';

  return (
    <div className="rounded border border-gray-400/25 bg-gray-150 px-3 py-2 text-sm text-gray-800">
      <div className="mb-1 font-secondary text-base text-gray-900">Quote summary</div>
      <div>Exchange rate: {quote.originSwapRate}</div>
      <div>Bridge fee: {quote.bridgeFee}</div>
      <div>
        Estimated output: {quote.estimatedOutput} {outputSymbol}
      </div>
      <div>Minimum received: {quote.minimumReceived}</div>
    </div>
  );
}
