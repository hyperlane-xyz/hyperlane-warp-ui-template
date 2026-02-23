import { WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { ChevronIcon, FuelPumpIcon, useModal } from '@hyperlane-xyz/widgets';
import { useEffect, useState } from 'react';
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
  visible,
}: {
  isLoading: boolean;
  fees: (WarpCoreFeeEstimate & { totalFees: string }) | null;
  visible: boolean;
}) {
  const { close, isOpen, open } = useModal();
  const loadingText = useLoadingDots(isLoading);

  if (!visible) return null;

  // Determine display text and whether button is clickable
  const hasFees = fees !== null;
  const isClickable = hasFees && !isLoading;
  const feeText = isLoading ? loadingText : hasFees ? fees.totalFees : '-';

  return (
    <>
      <div className="mb-2 mt-2 h-2">
        <button
          className={`flex w-fit items-center font-secondary text-xxs text-gray-700 [&_path]:fill-gray-700 ${isClickable ? 'hover:text-gray-900 [&_path]:hover:fill-gray-900' : 'pointer-events-none cursor-default'}`}
          type="button"
          onClick={isClickable ? open : undefined}
          disabled={!isClickable}
        >
          <FuelPumpIcon width={14} height={14} className="mr-1" />
          Fees: {feeText}
          {isClickable && <ChevronIcon direction="e" width="0.6rem" height="0.6rem" />}
        </button>
      </div>
      <TransferFeeModal close={close} isOpen={isOpen} isLoading={isLoading} fees={fees} />
    </>
  );
}
