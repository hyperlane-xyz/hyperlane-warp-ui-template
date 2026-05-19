interface Props {
  slippageBps: number;
  setSlippageBps: (bps: number) => void;
}

const PRESETS = [50, 100, 300]; // 0.5%, 1%, 3%

export function SlippagePanel({ slippageBps, setSlippageBps }: Props) {
  const lowSlippage = slippageBps < 100;

  return (
    <div className="slippage-panel mt-2 rounded-lg border border-gray-200 p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Slippage</span>
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
            min={1}
            max={5000}
            step={1}
            value={slippageBps}
            onChange={(e) => setSlippageBps(Number(e.target.value))}
            className="w-16 rounded border border-gray-200 px-1 py-0.5 text-right"
          />
          <span className="text-gray-500">bps</span>
        </div>
      </div>
      {lowSlippage && (
        <p className="mt-1 text-amber-600">
          Slippage below 1% may cause swaps to revert on volatile pools.
        </p>
      )}
    </div>
  );
}
