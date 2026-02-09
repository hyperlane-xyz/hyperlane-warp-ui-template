import { SwapIcon } from '../../../components/icons/SwapIcon';

export function SwapDirectionIndicator() {
  return (
    <div className="relative z-10 -my-3 flex flex-col items-center gap-1">
      <div className="flex h-8 w-8 items-center justify-center rounded border border-gray-400/50 bg-white shadow-button">
        <SwapIcon width={18} height={24} />
      </div>
      <div className="font-secondary text-xs text-gray-500">Arbitrum -&gt; Base</div>
    </div>
  );
}
