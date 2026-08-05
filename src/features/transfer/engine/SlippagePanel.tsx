import { ChevronIcon, GearIcon } from '@hyperlane-xyz/widgets';
import { useRef, useState } from 'react';

import { Color } from '../../../styles/Color';
import { useClickOutside } from '../../../utils/useClickOutside';

interface Props {
  slippageBps: number;
  setSlippageBps: (bps: number) => void;
}

const PRESETS = [50, 100, 300]; // 0.5%, 1%, 3%
const MIN_SLIPPAGE_BPS = 1;
const MAX_SLIPPAGE_BPS = 5_000;
const HIGH_SLIPPAGE_BPS = 1_000;

// Compact inline slippage control. "[gear] Slippage: 1% [chevron]" pill
// that expands into the preset row + custom input when clicked. Designed
// to live on the same row as the fee pill (see TransferForm).
export function SlippagePanel({ slippageBps, setSlippageBps }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setIsOpen(false));

  const lowSlippage = slippageBps < 100;
  const highSlippage = slippageBps > HIGH_SLIPPAGE_BPS;
  const pct = (slippageBps / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="slippage-panel relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1 rounded font-secondary text-xxs text-gray-700 hover:text-gray-900 dark:text-foreground-secondary dark:hover:text-foreground-primary [&_path]:fill-gray-700 dark:[&_path]:fill-current"
      >
        <GearIcon width={12} height={12} />
        Slippage: {pct}%
        <ChevronIcon
          direction={isOpen ? 'n' : 's'}
          width="0.6rem"
          height="0.6rem"
          color={Color.gray['500']}
        />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-20 mt-1 w-fit rounded-lg border border-gray-200 bg-white p-2 text-xs shadow-md dark:border-primary-300/35 dark:bg-surface">
          <div className="flex items-center gap-1">
            {PRESETS.map((bps) => (
              <button
                key={bps}
                type="button"
                onClick={() => setSlippageBps(bps)}
                className={`rounded px-2 py-0.5 ${
                  slippageBps === bps ? 'bg-accent-500 text-white' : 'bg-gray-100'
                }`}
              >
                {bps / 100}%
              </button>
            ))}
            <input
              type="number"
              min={MIN_SLIPPAGE_BPS}
              max={MAX_SLIPPAGE_BPS}
              step={1}
              value={slippageBps}
              onChange={(e) => setSlippageBps(clampSlippageBps(e.target.value))}
              className="w-16 rounded border border-gray-200 px-1 py-0.5 text-right"
            />
            <span className="text-gray-500">bps</span>
          </div>
          {lowSlippage && (
            <p className="mt-1 text-amber-600">Below 1% may revert on volatile pools.</p>
          )}
          {highSlippage && <p className="mt-1 text-amber-600">High slippage can receive less.</p>}
        </div>
      )}
    </div>
  );
}

function clampSlippageBps(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MIN_SLIPPAGE_BPS;
  return Math.min(MAX_SLIPPAGE_BPS, Math.max(MIN_SLIPPAGE_BPS, Math.trunc(parsed)));
}
