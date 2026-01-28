import { ChainName } from '@hyperlane-xyz/sdk';
import { useMemo } from 'react';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { ChainInfo, useChainInfos } from './hooks';

const DEFAULT_MAX_VISIBLE_CHAINS = 4;

interface MobileChainQuickSelectProps {
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainInfo | null) => void;
  onMoreClick: () => void;
  /** Optional list of preferred chain names to display first. Remaining slots filled with other chains. */
  preferredChains?: ChainName[];
}

export function MobileChainQuickSelect({
  selectedChain,
  onSelectChain,
  onMoreClick,
  preferredChains,
}: MobileChainQuickSelectProps) {
  const allChains = useChainInfos();

  // Compute visible chains - only recalculates when preferredChains changes
  const { visibleChains, hasMore } = useMemo(() => {
    if (preferredChains && preferredChains.length > 0) {
      const chainNameSet = new Set(allChains.map((c) => c.name));
      const preferredSet = new Set(preferredChains);

      // Get preferred chains that exist, maintaining preferred order
      const preferred = preferredChains
        .filter((name) => chainNameSet.has(name))
        .map((name) => {
          const chain = allChains.find((c) => c.name === name);
          return {
            name,
            displayName: chain?.displayName || name,
            chainId: chain?.chainId || 1,
          };
        });

      // Fill remaining slots with other chains (not in preferred list)
      const remaining = allChains.filter((c) => !preferredSet.has(c.name));
      const slotsToFill = DEFAULT_MAX_VISIBLE_CHAINS - preferred.length;
      const fillers = remaining.slice(0, Math.max(0, slotsToFill));

      const visible = [...preferred, ...fillers];

      return {
        visibleChains: visible,
        hasMore: allChains.length > visible.length,
      };
    }

    // Otherwise use first N chains alphabetically
    return {
      visibleChains: allChains.slice(0, DEFAULT_MAX_VISIBLE_CHAINS),
      hasMore: allChains.length > DEFAULT_MAX_VISIBLE_CHAINS,
    };
  }, [allChains, preferredChains]);

  return (
    <div className="flex items-center gap-2">
      {/* All Chains pill */}
      <button
        type="button"
        onClick={() => onSelectChain(null)}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          selectedChain === null
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        All
      </button>

      {/* Chain icon buttons */}
      {visibleChains.map((chain) => (
        <button
          key={chain.name}
          type="button"
          onClick={() => onSelectChain(chain)}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
            selectedChain === chain.name ? 'bg-blue-100' : 'bg-gray-100 hover:bg-gray-200'
          }`}
          title={chain.displayName}
        >
          <ChainLogo chainName={chain.name} size={24} />
        </button>
      ))}

      {/* More button */}
      {hasMore && (
        <button
          type="button"
          onClick={onMoreClick}
          className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
        >
          More &gt;
        </button>
      )}
    </div>
  );
}
