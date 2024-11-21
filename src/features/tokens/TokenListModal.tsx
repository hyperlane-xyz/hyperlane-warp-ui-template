import { IToken } from '@hyperlane-xyz/sdk';
import { Modal, SearchIcon } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TokenIcon } from '../../components/icons/TokenIcon';
import { TextInput } from '../../components/input/TextField';
import { config } from '../../consts/config';
import InfoIcon from '../../images/icons/info-circle.svg';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { useWarpCore } from './hooks';

export function TokenListModal({
  isOpen,
  close,
  onSelect,
  origin,
  destination,
}: {
  isOpen: boolean;
  close: () => void;
  onSelect: (token: IToken) => void;
  origin: ChainName;
  destination: ChainName;
}) {
  const [search, setSearch] = useState('');

  const onClose = () => {
    close();
    setSearch('');
  };

  const onSelectAndClose = (token: IToken) => {
    onSelect(token);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      close={onClose}
      panelClassname="px-4 py-3 max-w-100 sm:max-w-[31rem] min-h-[24rem]"
    >
      <SearchBar search={search} setSearch={setSearch} />
      <TokenList
        origin={origin}
        destination={destination}
        searchQuery={search}
        onSelect={onSelectAndClose}
      />
    </Modal>
  );
}

function SearchBar({ search, setSearch }: { search: string; setSearch: (s: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="relative">
      <SearchIcon
        width={20}
        height={20}
        className="absolute left-3 top-1/2 -translate-y-1/2 pb-1 opacity-50"
      />
      <TextInput
        ref={inputRef}
        value={search}
        onChange={setSearch}
        placeholder="Token name, symbol, or address"
        name="token-search"
        className="mb-4 mt-3 w-full pl-10 all:border-gray-200 all:py-3 all:focus:border-gray-400"
        autoComplete="off"
      />
    </div>
  );
}

export function TokenList({
  origin,
  destination,
  searchQuery,
  onSelect,
}: {
  origin: ChainName;
  destination: ChainName;
  searchQuery: string;
  onSelect: (token: IToken) => void;
}) {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const tokens = useMemo(() => {
    const q = searchQuery?.trim().toLowerCase();
    const multiChainTokens = warpCore.tokens.filter((t) => t.isMultiChainToken());
    const tokensWithRoute = warpCore.getTokensForRoute(origin, destination);
    return (
      multiChainTokens
        .map((t) => ({
          token: t,
          disabled: !tokensWithRoute.includes(t),
        }))
        .sort((a, b) => {
          if (a.disabled && !b.disabled) return 1;
          else if (!a.disabled && b.disabled) return -1;
          else return 0;
        })
        // Filter down to search query
        .filter((t) => {
          if (!q) return t;
          return (
            t.token.name.toLowerCase().includes(q) ||
            t.token.symbol.toLowerCase().includes(q) ||
            t.token.addressOrDenom.toLowerCase().includes(q)
          );
        })
        // Hide/show disabled tokens
        .filter((t) => (config.showDisabledTokens ? true : !t.disabled))
    );
  }, [warpCore, searchQuery, origin, destination]);

  return (
    <div className="flex flex-col items-stretch">
      {tokens.length ? (
        tokens.map((t, i) => (
          <button
            className={`-mx-2 mb-2 flex items-center rounded px-2 py-2 ${
              t.disabled ? 'opacity-50' : 'hover:bg-gray-200'
            } duration-250 transition-all`}
            key={i}
            type="button"
            disabled={t.disabled}
            onClick={() => onSelect(t.token)}
          >
            <div className="shrink-0">
              <TokenIcon token={t.token} size={30} />
            </div>
            <div className="ml-2 shrink-0 text-left">
              <div className="w-14 truncate text-sm">{t.token.symbol || 'Unknown'}</div>
              <div className="w-14 truncate text-xs text-gray-500">{t.token.name || 'Unknown'}</div>
            </div>
            <div className="ml-2 min-w-0 shrink text-left">
              <div className="w-full truncate text-xs">
                {t.token.addressOrDenom || 'Native chain token'}
              </div>
              <div className="mt-0.5 flex space-x-1 text-xs">
                <span>{`Decimals: ${t.token.decimals}`}</span>
                <span>-</span>
                <span>{`Chain: ${getChainDisplayName(multiProvider, t.token.chainName)}`}</span>
              </div>
            </div>
            {t.disabled && (
              <Image
                src={InfoIcon}
                alt=""
                className="ml-auto mr-1"
                data-te-toggle="tooltip"
                title={`Route not supported for ${getChainDisplayName(
                  multiProvider,
                  origin,
                )} to ${getChainDisplayName(multiProvider, destination)}`}
              />
            )}
          </button>
        ))
      ) : (
        <div className="my-8 text-center text-gray-500">
          <div>No tokens found</div>
          <div className="mt-2 text-sm">Try a different destination chain or search query</div>
        </div>
      )}
    </div>
  );
}
