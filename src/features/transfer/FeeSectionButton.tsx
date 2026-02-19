import { WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { ChevronIcon, FuelPumpIcon, useModal } from '@hyperlane-xyz/widgets';
import { useEffect, useState } from 'react';
import { getFeePercentage, getTotalFeesUsdRaw } from '../balances/feeUsdDisplay';
import { FeePrices } from '../balances/useFeePrices';
import { formatUsd } from '../balances/utils';
import { TransferFeeModal } from './TransferFeeModal';

function useLoadingDots(isLoading: boolean, intervalMs = 1000) {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    if (!isLoading) return;

    let count = 0;
    const interval = setInterval(() => {
      count = (count % 3) + 1;
      setDotCount(count);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isLoading, intervalMs]);

  return 'Loading' + '.'.repeat(dotCount);
}

export function FeeSectionButton({
  isLoading,
  fees,
  feePrices,
  transferUsd,
}: {
  isLoading: boolean;
  fees: (WarpCoreFeeEstimate & { totalFees: string }) | null;
  feePrices: FeePrices;
  transferUsd: number;
}) {
  const { close, isOpen, open } = useModal();
  const loadingText = useLoadingDots(isLoading);

  // Determine display text and whether button is clickable
  const hasFees = fees !== null;
  const isClickable = hasFees && !isLoading;
  const feeText = isLoading ? loadingText : hasFees ? fees.totalFees : '-';
  const totalUsdRaw = hasFees ? getTotalFeesUsdRaw(fees, feePrices) : 0;
  const totalUsd = totalUsdRaw > 0 ? formatUsd(totalUsdRaw, true) : null;
  const pct = hasFees ? getFeePercentage(totalUsdRaw, transferUsd) : null;

  return (
    <>
      <div className="mb-2 mt-2 h-2">
        <button
          className={`fee-section-btn flex w-fit items-center font-secondary text-xxs text-gray-700 [&_path]:fill-gray-700 ${isClickable ? 'hover:text-gray-900 [&_path]:hover:fill-gray-900' : 'pointer-events-none cursor-default'}`}
          type="button"
          onClick={isClickable ? open : undefined}
          disabled={!isClickable}
        >
          <FuelPumpIcon width={14} height={14} className="mr-1" />
          Fees: {feeText}
          {isClickable && totalUsd && (
            <span className="ml-1 text-gray-500">
              {totalUsd}
              {pct ? ` (${pct})` : ''}
            </span>
          )}
          {isClickable && <ChevronIcon direction="e" width="0.6rem" height="0.6rem" />}
        </button>
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
