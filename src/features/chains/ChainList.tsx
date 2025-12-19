import { useMemo } from 'react';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { useTokens } from '../tokens/hooks';
import { useMultiProvider } from './hooks';
import { getChainDisplayName } from './utils';

interface ChainListProps {
  searchQuery: string;
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainName | null) => void;
}

export function ChainList({ searchQuery, selectedChain, onSelectChain }: ChainListProps) {
  const multiProvider = useMultiProvider();
  const tokens = useTokens();

  const chains = useMemo(() => {
    // Get unique chains that have tokens
    const chainSet = new Set(tokens.map((t) => t.chainName));

    // Build chain info with display names for sorting
    const chainInfos = Array.from(chainSet).map((chainName) => ({
      name: chainName,
      displayName: getChainDisplayName(multiProvider, chainName),
    }));

    // Sort alphabetically by display name
    chainInfos.sort((a, b) => a.displayName.localeCompare(b.displayName));

    // Filter by search query
    const q = searchQuery?.trim().toLowerCase();
    if (!q) return chainInfos;

    return chainInfos.filter(
      (chain) =>
        chain.displayName.toLowerCase().includes(q) || chain.name.toLowerCase().includes(q),
    );
  }, [searchQuery, tokens, multiProvider]);

  return (
    <div className="flex-1 overflow-auto">
      {/* All Chains option */}
      <ChainButton
        isSelected={selectedChain === null}
        onClick={() => onSelectChain(null)}
        icon={
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-[10px] font-bold text-white">
            ALL
          </div>
        }
        label="All Chains"
      />

      {/* Individual chains */}
      {chains.map((chain) => (
        <ChainButton
          key={chain.name}
          isSelected={selectedChain === chain.name}
          onClick={() => onSelectChain(chain.name)}
          icon={<ChainLogo chainName={chain.name} size={28} />}
          label={chain.displayName}
        />
      ))}

      {chains.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-gray-500">No chains found</div>
      )}
    </div>
  );
}

function ChainButton({
  isSelected,
  onClick,
  icon,
  label,
}: {
  isSelected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 border-l-2 px-4 py-2.5 transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50 text-blue-700'
          : 'border-transparent text-gray-700 hover:bg-gray-100'
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="truncate text-sm font-medium">{label}</span>
    </button>
  );
}
