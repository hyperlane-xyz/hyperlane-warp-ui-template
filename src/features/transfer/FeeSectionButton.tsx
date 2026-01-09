import { WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { ChevronIcon, FuelPumpIcon, useModal } from '@hyperlane-xyz/widgets';
import { useEffect, useRef, useState } from 'react';
import { TransferFeeModal } from './TransferFeeModal';

function useLoadingDots(isLoading: boolean, intervalMs = 1000) {
  const [dotCount, setDotCount] = useState(1);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (!isLoading) {
      setDotCount(1);
      lastUpdateRef.current = 0;
      return;
    }

    let rafId: number;

    const animate = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current >= intervalMs) {
        setDotCount((prev) => (prev % 3) + 1);
        lastUpdateRef.current = timestamp;
      }
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
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
          className={`font-secondary flex w-fit items-center text-xxs text-gray-700 hover:text-gray-900 [&_path]:fill-gray-700 [&_path]:hover:fill-gray-900 ${!isClickable ? 'cursor-default' : ''}`}
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
