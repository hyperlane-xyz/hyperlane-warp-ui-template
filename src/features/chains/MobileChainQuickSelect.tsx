import { ChainName } from '@hyperlane-xyz/sdk';
import { useMemo } from 'react';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { useTokens } from '../tokens/hooks';
import { useMultiProvider } from './hooks';
import { getChainDisplayName } from './utils';

const DEFAULT_MAX_VISIBLE_CHAINS = 4;

interface MobileChainQuickSelectProps {
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainName | null) => void;
  onMoreClick: () => void;
  /** Optional list of preferred chain names to display. If provided, only these chains are shown (up to their length). */
  preferredChains?: ChainName[];
}

export function MobileChainQuickSelect({
  selectedChain,
  onSelectChain,
  onMoreClick,
  preferredChains,
}: MobileChainQuickSelectProps) {
  const multiProvider = useMultiProvider();
  const tokens = useTokens();

  const { visibleChains, hasMore } = useMemo(() => {
    // Get unique chains that have tokens
    const chainSet = new Set(tokens.map((t) => t.chainName));

    // Build chain info with display names for sorting
    const allChainInfos = Array.from(chainSet).map((chainName) => ({
      name: chainName,
      displayName: getChainDisplayName(multiProvider, chainName),
    }));

    // Sort alphabetically by display name
    allChainInfos.sort((a, b) => a.displayName.localeCompare(b.displayName));

    // If preferredChains provided, show those first then fill remaining slots
    if (preferredChains && preferredChains.length > 0) {
      const preferredSet = new Set(preferredChains);
      const preferred = preferredChains
        .filter((name) => chainSet.has(name)) // Only include chains that exist
        .map((name) => ({
          name,
          displayName: getChainDisplayName(multiProvider, name),
        }));

      // Fill remaining slots with other chains (not in preferred list)
      const remaining = allChainInfos.filter((c) => !preferredSet.has(c.name));
      const slotsToFill = DEFAULT_MAX_VISIBLE_CHAINS - preferred.length;
      const fillers = remaining.slice(0, Math.max(0, slotsToFill));

      const visible = [...preferred, ...fillers];

      return {
        visibleChains: visible,
        hasMore: allChainInfos.length > visible.length,
      };
    }

    // Otherwise use first N chains alphabetically
    return {
      visibleChains: allChainInfos.slice(0, DEFAULT_MAX_VISIBLE_CHAINS),
      hasMore: allChainInfos.length > DEFAULT_MAX_VISIBLE_CHAINS,
    };
  }, [tokens, multiProvider, preferredChains]);

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
          onClick={() => onSelectChain(chain.name)}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
            selectedChain === chain.name
              ? 'bg-blue-100'
              : 'bg-gray-100 hover:bg-gray-200'
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
