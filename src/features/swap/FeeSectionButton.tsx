import { ChevronIcon, FuelPumpIcon, useModal } from '@hyperlane-xyz/widgets';
import { useEffect, useState } from 'react';

import { useMultiProvider } from '../chains/hooks';
import { formatFeeAmount } from './balances/utils';
import { FeeBreakdownModal } from './FeeBreakdownModal';
import { getTokenByKeyFromMap, useTokenByKeyMap } from './tokens/hooks';
import type { UiToken } from './tokens/types';
import type { FeeBreakdown, FeeComponent } from './types';

interface Props {
  feeBreakdown: FeeBreakdown | undefined;
  isLoading: boolean;
}

// Pill button — fuel-pump icon + "Fees: <total>" + chevron.
// Fees grouped by fungibility (chainId + token address).
export function FeeSectionButton({ feeBreakdown, isLoading }: Props) {
  const { isOpen, open, close } = useModal();
  const loadingText = useLoadingDots(isLoading);
  const tokenMap = useTokenByKeyMap();
  const multiProvider = useMultiProvider();

  const components = feeBreakdown?.components ?? [];
  const isClickable = components.length > 0 && !isLoading;

  let feeText: string;
  if (isLoading) feeText = loadingText;
  else if (components.length === 0) feeText = '-';
  else feeText = formatTotalFee(components, tokenMap, multiProvider);

  return (
    <>
      <button
        type="button"
        className={`fee-section-btn flex w-fit items-center font-secondary text-xxs text-gray-700 dark:text-foreground-secondary [&_path]:fill-gray-700 dark:[&_path]:fill-current ${
          isClickable
            ? 'hover:text-gray-900 dark:hover:text-foreground-primary [&_path]:hover:fill-gray-900 dark:hover:[&_path]:fill-current'
            : 'pointer-events-none cursor-default'
        }`}
        onClick={isClickable ? open : undefined}
        disabled={!isClickable}
      >
        <FuelPumpIcon width={14} height={14} className="mr-1" />
        Fees: {feeText}
        {isClickable && <ChevronIcon direction="e" width="0.6rem" height="0.6rem" />}
      </button>
      {feeBreakdown && (
        <FeeBreakdownModal isOpen={isOpen} close={close} feeBreakdown={feeBreakdown} />
      )}
    </>
  );
}

function formatTotalFee(
  components: FeeComponent[],
  tokenMap: Map<string, UiToken>,
  multiProvider: ReturnType<typeof useMultiProvider>,
): string {
  const groups = new Map<string, { amount: bigint; decimals: number; symbol: string }>();
  for (const c of components) {
    const key = `${c.chainId}-${c.tokenAddress.toLowerCase()}`;
    const existing = groups.get(key);
    if (existing) {
      existing.amount += c.amount;
      continue;
    }
    const meta = resolveTokenMeta(c, tokenMap, multiProvider);
    groups.set(key, { amount: c.amount, decimals: meta.decimals, symbol: meta.symbol });
  }
  return Array.from(groups.values())
    .map((g) => `${formatFeeAmount(g.amount, g.decimals)} ${g.symbol}`)
    .join(', ');
}

function resolveTokenMeta(
  component: FeeComponent,
  tokenMap: Map<string, UiToken>,
  multiProvider: ReturnType<typeof useMultiProvider>,
): { decimals: number; symbol: string } {
  if (/^0x0+$/i.test(component.tokenAddress)) {
    const chainName = multiProvider.tryGetChainName(component.chainId);
    const meta = chainName ? multiProvider.tryGetChainMetadata(chainName) : undefined;
    return {
      decimals: meta?.nativeToken?.decimals ?? 18,
      symbol: meta?.nativeToken?.symbol ?? 'ETH',
    };
  }
  const ui = getTokenByKeyFromMap(
    tokenMap,
    `${component.chainId}-${component.tokenAddress.toLowerCase()}`,
  );
  return {
    decimals: ui?.decimals ?? 18,
    symbol: ui?.symbol ?? '???',
  };
}

function useLoadingDots(isLoading: boolean, intervalMs = 500) {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    if (!isLoading) return;
    let n = 0;
    const id = setInterval(() => {
      n = (n % 3) + 1;
      setDots(n);
    }, intervalMs);
    return () => clearInterval(id);
  }, [isLoading, intervalMs]);
  return `Loading${'.'.repeat(dots)}`;
}
