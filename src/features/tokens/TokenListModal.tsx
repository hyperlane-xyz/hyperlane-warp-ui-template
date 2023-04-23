import { useMemo, useState } from 'react';

import { TokenIcon } from '../../components/icons/TokenIcon';
import { TextInput } from '../../components/input/TextField';
import { Modal } from '../../components/layout/Modal';

import { getAllTokens } from './metadata';
import { RoutesMap, hasTokenRoute } from './routes';
import { TokenMetadata } from './types';
import { isNativeToken } from './utils';

export function TokenListModal({
  isOpen,
  close,
  onSelect,
  originChainId,
  destinationChainId,
  tokenRoutes,
}: {
  isOpen: boolean;
  close: () => void;
  onSelect: (token: TokenMetadata) => void;
  originChainId: ChainId;
  destinationChainId: ChainId;
  tokenRoutes: RoutesMap;
}) {
  const [search, setSearch] = useState('');

  const onClose = () => {
    close();
    setSearch('');
  };

  const onSelectAndClose = (token: TokenMetadata) => {
    onSelect(token);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Select Token"
      close={onClose}
      width="max-w-100 sm:max-w-[31rem] min-h-[24rem]"
    >
      <TextInput
        value={search}
        onChange={setSearch}
        placeholder="Name, symbol, or address"
        name="token-search"
        classes="mt-3 mb-4 sm:py-2.5 w-full"
        autoComplete="off"
      />
      <TokenList
        originChainId={originChainId}
        destinationChainId={destinationChainId}
        tokenRoutes={tokenRoutes}
        searchQuery={search}
        onSelect={onSelectAndClose}
      />
    </Modal>
  );
}

export function TokenList({
  originChainId,
  destinationChainId,
  tokenRoutes,
  searchQuery,
  onSelect,
}: {
  originChainId: ChainId;
  destinationChainId: ChainId;
  tokenRoutes: RoutesMap;
  searchQuery: string;
  onSelect: (token: TokenMetadata) => void;
}) {
  const tokens = useMemo(() => {
    return getAllTokens().filter((t) => {
      const q = searchQuery?.trim().toLowerCase();
      const hasRoute = hasTokenRoute(originChainId, destinationChainId, t.address, tokenRoutes);
      if (!q) return hasRoute;
      else
        return (
          hasRoute &&
          (t.name.toLowerCase().includes(q) ||
            t.symbol.toLowerCase().includes(q) ||
            t.address.toLowerCase().includes(q))
        );
    });
  }, [searchQuery, originChainId, destinationChainId, tokenRoutes]);

  return (
    <div className="flex flex-col items-stretch divide-y divide-gray-200">
      {tokens.length ? (
        tokens.map((t) => (
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
              <div className="text-xs">
                {isNativeToken(t.address) ? 'Native chain token' : `Address: ${t.address}`}
              </div>
              <div className=" mt-0.5 text-xs">{`Decimals: ${t.decimals}`}</div>
            </div>
          </button>
        ))
      ) : (
        <div className="my-8 text-gray-500 text-center">
          <div>No tokens found</div>
          <div className="mt-2 text-sm ">Try a different destination chain or search query</div>
        </div>
      )}
    </div>
  );
}
