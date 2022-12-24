import { useMemo } from 'react';

import { TokenIcon } from '../../components/icons/TokenIcon';
// Uniswap's list has a diverse set of 500+ popular tokens
// import UniswapTokens from '../../consts/tokens.uniswap.org.json';
// Import your custom list here
import SyntheticTokenList from '../../consts/tokens.hyperlane.xyz.json';

import { ListedToken } from './types';

// Default export works better for Next dynamic import
export default function TokenList({
  sourceChainId,
  searchQuery,
  onSelect,
}: {
  sourceChainId: number;
  searchQuery: string;
  onSelect: (token: ListedToken) => void;
}) {
  const tokens = useMemo(
    () =>
      SyntheticTokenList.tokens.filter((t) => {
        const q = searchQuery?.trim().toLowerCase();
        const chainFilter = t.chainId === sourceChainId;
        if (!q) return chainFilter;
        else
          return (
            chainFilter &&
            (t.name.toLowerCase().includes(q) ||
              t.symbol.toLowerCase().includes(q) ||
              t.address.toLowerCase().includes(q))
          );
      }),
    [searchQuery, sourceChainId],
  );

  return (
    <div className="flex flex-col items-stretch divide-y divide-gray-200">
      {tokens.map((t) => (
        <button
          className="-mx-2 py-2 px-2 flex items-center rounded hover:bg-gray-100 active:bg-gray-200 transition-all duration-250"
          key={`${t.chainId}-${t.address}`}
          type="button"
          onClick={() => onSelect(t)}
        >
          <TokenIcon token={t} size={30} />
          <div className="ml-3 text-left">
            <div className="text-sm w-14 truncate">{t.symbol || 'Unknown'}</div>
            <div className="text-xs text-gray-500 w-14 truncate">{t.name || 'Unknown'}</div>
          </div>
          <div className="ml-3 text-left">
            <div className="text-xs">{`Address: ${t.address}`}</div>
            <div className=" mt-0.5 text-xs">{`Decimals: ${t.decimals}`}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
