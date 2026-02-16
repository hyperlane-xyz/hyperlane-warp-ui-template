import { WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { ChevronIcon, FuelPumpIcon, Skeleton, useModal } from '@hyperlane-xyz/widgets';
import { Color } from '../../styles/Color';
import { getFeePercentage, getTotalFeesUsd, getTotalFeesUsdRaw } from '../tokens/feeUsdDisplay';
import { FeePrices } from '../tokens/useFeePrices';
import { TransferFeeModal } from './TransferFeeModal';

export function FeeSectionButton({
  isLoading,
  fees,
  visible,
  feePrices,
  transferUsd,
}: {
  isLoading: boolean;
  fees: (WarpCoreFeeEstimate & { totalFees: string }) | null;
  visible: boolean;
  feePrices: FeePrices;
  transferUsd: number;
}) {
  const { close, isOpen, open } = useModal();

  if (!visible) return null;

  return (
    <>
      <div className="mb-2 mt-2 h-2">
        {isLoading ? (
          <Skeleton className="h-4 w-72" />
        ) : fees ? (
          <button
            className="flex w-fit items-center text-xxs text-gray-600 hover:text-gray-500 [&_path]:fill-gray-600 [&_path]:hover:fill-gray-500"
            type="button"
            onClick={open}
          >
            <FuelPumpIcon width={14} height={14} color={Color.gray[600]} className="mr-1" />
            Fees: {fees.totalFees}
            {(() => {
              const usd = getTotalFeesUsd(fees, feePrices);
              const pct = getFeePercentage(getTotalFeesUsdRaw(fees, feePrices), transferUsd);
              if (!usd) return null;
              return (
                <span className="ml-1 text-gray-500">
                  {usd}
                  {pct ? ` (${pct})` : ''}
                </span>
              );
            })()}
            <ChevronIcon direction="e" width="0.6rem" height="0.6rem" />
          </button>
        ) : null}
      </div>
      <TransferFeeModal
        close={close}
        isOpen={isOpen}
        isLoading={isLoading}
        fees={fees}
        feePrices={feePrices}
      />
    </>
  );
}
