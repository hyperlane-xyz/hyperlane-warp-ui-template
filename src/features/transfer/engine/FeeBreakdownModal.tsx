import { Modal, Tooltip } from '@hyperlane-xyz/widgets';
import Link from 'next/link';

import { links } from '../../../consts/links';
import { formatFeeAmount } from '../../balances/utils';
import { useMultiProvider } from '../../chains/hooks';
import { getChainDisplayName } from '../../chains/utils';
import { getTokenByKeyFromMap, useTokenByKeyMap } from '../../tokens/hooks';
import type { UiToken } from '../../tokens/types';
import { tokenKey } from '../../tokens/utils';
import type { FeeBreakdown, FeeComponent } from './types';

interface Props {
  isOpen: boolean;
  close: () => void;
  feeBreakdown: FeeBreakdown;
}

const CATEGORY_LABEL: Record<FeeComponent['category'], string> = {
  bridge: 'Route Fee',
  igp: 'Interchain Gas',
};

const CATEGORY_TOOLTIP: Record<FeeComponent['category'], string> = {
  bridge: 'Variable fee charged by the selected route for the cross-chain transfer',
  igp: 'Gas to deliver and execute the message on the destination chain, including the relayer fee',
};

// Renders one row per fee component emitted by the engine.
export function FeeBreakdownModal({ isOpen, close, feeBreakdown }: Props) {
  const tokenMap = useTokenByKeyMap();
  const multiProvider = useMultiProvider();

  const rows = feeBreakdown.components
    .filter((c) => c.amount > 0n)
    .map((c, i) => ({
      key: `${c.category}-${tokenKey(c.chainId, c.tokenAddress)}-${i}`,
      component: c,
      meta: resolveTokenMeta(c, tokenMap, multiProvider),
    }));

  return (
    <Modal
      isOpen={isOpen}
      close={close}
      panelClassname="transfer-fee-modal max-w-sm overflow-hidden p-0 dark:border dark:border-primary-300/40 dark:bg-surface dark:text-foreground-primary dark:shadow-[0_16px_40px_rgba(0,0,0,0.45)] md:max-w-128"
    >
      <div className="w-full bg-accent-gradient px-4 py-2.5 font-secondary text-base font-normal tracking-wider text-white shadow-accent-glow">
        Fee Details
      </div>
      <div className="transfer-fee-modal-content flex w-full flex-col items-start gap-2 p-4 text-sm dark:text-foreground-primary">
        {rows.length === 0 ? (
          <span className="text-gray-500 dark:text-foreground-secondary">
            No fees for this route.
          </span>
        ) : (
          rows.map(({ key, component, meta }) => (
            <div key={key} className="flex gap-4">
              <span className="flex min-w-[7.5rem] items-center gap-1">
                {CATEGORY_LABEL[component.category]}
                <Tooltip
                  content={CATEGORY_TOOLTIP[component.category]}
                  id={`${key}-tooltip`}
                  tooltipClassName="max-w-[300px]"
                />
              </span>
              <span>
                {formatFeeAmount(component.amount, meta.decimals)} {meta.symbol}
                <span className="ml-1 text-xxs text-gray-500 dark:text-foreground-secondary">
                  on {getChainDisplayName(multiProvider, meta.chainName, true)}
                </span>
              </span>
            </div>
          ))
        )}
        <span className="mt-2">
          Read more about{' '}
          <Link
            href={links.transferFees}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-500 underline dark:text-primary-50"
          >
            transfer fees.
          </Link>
        </span>
      </div>
    </Modal>
  );
}

function resolveTokenMeta(
  component: FeeComponent,
  tokenMap: Map<string, UiToken>,
  multiProvider: ReturnType<typeof useMultiProvider>,
): { decimals: number; symbol: string; chainName: string } {
  const chainName =
    multiProvider.tryGetChainName(component.chainId) ?? `chain-${component.chainId}`;
  if (/^0x0+$/i.test(component.tokenAddress)) {
    const meta = multiProvider.tryGetChainMetadata(chainName);
    return {
      decimals: meta?.nativeToken?.decimals ?? 18,
      symbol: meta?.nativeToken?.symbol ?? 'ETH',
      chainName,
    };
  }
  const ui = getTokenByKeyFromMap(tokenMap, tokenKey(component.chainId, component.tokenAddress));
  return {
    decimals: ui?.decimals ?? 18,
    symbol: ui?.symbol ?? '???',
    chainName,
  };
}
