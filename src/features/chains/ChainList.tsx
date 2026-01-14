import { ChainName } from '@hyperlane-xyz/sdk';
import { useMemo } from 'react';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { useChainInfos } from './hooks';

interface ChainListProps {
  searchQuery: string;
  selectedChain: ChainName | null;
  onSelectChain: (chain: ChainName | null) => void;
}

export function ChainList({ searchQuery, selectedChain, onSelectChain }: ChainListProps) {
  const allChains = useChainInfos();

  // Filter by search query - only re-filters when searchQuery changes
  const chains = useMemo(() => {
    const q = searchQuery?.trim().toLowerCase();
    if (!q) return allChains;
    return allChains.filter(
      (chain) =>
        chain.displayName.toLowerCase().includes(q) || chain.name.toLowerCase().includes(q),
    );
  }, [searchQuery, allChains]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="h-full overflow-auto">
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
        {/* Spacer for fade effect */}
        <div className="h-10" />
      </div>
      {/* Bottom fade effect */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-b from-transparent to-gray-100" />
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
      className={`${styles.label} flex w-full items-center gap-3 border-l-2 px-4 py-2.5 transition-colors ${
        isSelected
          ? 'border-primary-500 bg-primary-500/10 text-primary-700'
          : 'border-transparent text-black hover:bg-gray-200'
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="truncate text-sm font-medium">{label}</span>
    </button>
  );
}

const styles = {
  label: 'font-secondary text-sm font-normal',
};
