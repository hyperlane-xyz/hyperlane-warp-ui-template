import { useMemo } from 'react';

import { TokenIcon } from '../../components/icons/TokenIcon';
// Using Uniswap's default list for now, may revisit
import UniswapTokens from '../../consts/tokens.uniswap.org.json';

// Default export works better for Next dynamic import
export default function TokenList({
  sourceChainId,
  onSelect,
}: {
  sourceChainId: number;
  onSelect: (tokenAddress: Address) => void;
}) {
  const tokens = useMemo(
    () => UniswapTokens.tokens.filter((t) => t.chainId === sourceChainId),
    [sourceChainId],
  );

  return (
    <div>
      {tokens.map((t) => (
        <button
          className="-mx-2 py-2 px-2 flex items-center rounded hover:bg-gray-100 active:bg-gray-200 transition-all duration-250"
          key={`${t.chainId}-${t.address}`}
          type="button"
          onClick={() => onSelect(t.address)}
        >
          <TokenIcon size={34} chainId={sourceChainId} tokenAddress={t.address} />
          <div className="ml-3 text-left">
            <div className="text-sm w-14 truncate">{t.symbol || 'Unknown'}</div>
            <div className="text-xs text-gray-500 w-14 truncate">{t.name || 'Unknown'}</div>
          </div>
          <div className="ml-3 text-left">
            <div className="text-xs">{`Address: ${t.address}`}</div>
            <div className="text-xs">{`Decimals: ${t.decimals}`}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
