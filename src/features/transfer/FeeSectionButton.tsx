import { WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { ChevronIcon, FuelPumpIcon, Skeleton } from '@hyperlane-xyz/widgets';
import { Color } from '../../styles/Color';

export function FeeSectionButton({
  isLoading,
  fees,
  visible,
  onClick,
}: {
  isLoading: boolean;
  fees: (WarpCoreFeeEstimate & { totalFees: string }) | null;
  visible: boolean;
  onClick: () => void;
}) {
  // Always render container with consistent height to prevent layout jumps
  if (!visible) return null;
  
  return (
    <div className="mt-2 h-4">
      {isLoading ? (
        <Skeleton className="h-4 w-52" />
      ) : fees ? (
        <button
          className="flex w-fit items-center text-xxs text-gray-600 hover:text-gray-500 [&_path]:fill-gray-600 [&_path]:hover:fill-gray-500"
          type="button"
          onClick={onClick}
        >
          <FuelPumpIcon width={14} height={14} color={Color.gray[600]} className="mr-1" />
          {fees.totalFees}
          <ChevronIcon direction="e" width="0.6rem" height="0.6rem" />
        </button>
      ) : null}
    </div>
  );
}
