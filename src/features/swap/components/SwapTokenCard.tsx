import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { SwapToken } from '../types';

interface Props {
  side: 'origin' | 'destination';
  tokens: SwapToken[];
  selectedToken: SwapToken | null;
  amount: string;
  onTokenSelect: (token: SwapToken) => void;
  onAmountChange?: (amount: string) => void;
  balance?: string;
  estimatedOutput?: string;
  disabled?: boolean;
}

export function SwapTokenCard({
  side,
  tokens,
  selectedToken,
  amount,
  onTokenSelect,
  onAmountChange,
  balance,
  estimatedOutput,
  disabled,
}: Props) {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const chainLabel = side === 'origin' ? 'Arbitrum' : 'Base';
  const cardTitle = side === 'origin' ? 'From' : 'To';
  const displayAmount = useMemo(() => {
    if (side === 'origin') return amount;
    if (!selectedToken || !estimatedOutput) return '--';
    return `${estimatedOutput} ${selectedToken.symbol}`;
  }, [side, amount, estimatedOutput, selectedToken]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-secondary text-sm text-gray-700">{cardTitle}</span>
        <span className="font-secondary text-xs text-gray-450">Chain: {chainLabel}</span>
      </div>

      <div className="relative rounded-[7px] border border-gray-400/25 bg-white p-3 shadow-input">
        <button
          type="button"
          onClick={() => setIsSelectorOpen((prev) => !prev)}
          disabled={disabled}
          className="flex w-full items-center justify-between rounded border border-gray-300 px-3 py-2 text-left text-sm text-gray-900 transition-colors hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>
            {selectedToken ? `${selectedToken.symbol} - ${selectedToken.name}` : 'Select token'}
          </span>
          <span className="text-gray-450">v</span>
        </button>

        {isSelectorOpen && (
          <div className="absolute left-3 right-3 top-[54px] z-20 max-h-44 overflow-y-auto rounded border border-gray-300 bg-white shadow-button">
            {tokens.map((token) => (
              <button
                key={`${token.chainId}-${token.address}`}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onTokenSelect(token);
                  setIsSelectorOpen(false);
                }}
                className={clsx(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed',
                  selectedToken?.address === token.address
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-700',
                )}
              >
                <span>{token.symbol}</span>
                <span className="text-xs text-gray-450">{token.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="my-2.5 h-px bg-primary-50" />

        {side === 'origin' ? (
          <input
            value={displayAmount}
            onChange={(event) => onAmountChange?.(event.target.value)}
            placeholder="0"
            disabled={disabled}
            className="w-full border-none bg-transparent font-secondary text-xl font-normal text-gray-900 outline-none placeholder:text-gray-900 disabled:cursor-not-allowed"
            type="number"
            step="any"
          />
        ) : (
          <div className="font-secondary text-xl font-normal text-gray-900">
            Estimated output: {displayAmount}
          </div>
        )}

        {balance && (
          <div className="mt-1 text-xs leading-[18px] text-gray-450">Balance: {balance}</div>
        )}
      </div>
    </div>
  );
}
