import { ChainMap, ChainMetadata, IToken, Token } from '@hyperlane-xyz/sdk';
import { isObjEmpty, objFilter } from '@hyperlane-xyz/utils';
import { Modal, SearchIcon } from '@hyperlane-xyz/widgets';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { TokenIcon } from '../../components/icons/TokenIcon';
import { TextInput } from '../../components/input/TextField';
import { config } from '../../consts/config';
import InfoIcon from '../../images/icons/info-circle.svg';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { useStore } from '../store';
import { useWarpCore } from './hooks';
import { TokenChainMap } from './utils';

export function TokenListModal({
  isOpen,
  close,
  onSelect,
  origin,
  destination,
  onSelectUnsupportedRoute,
}: {
  isOpen: boolean;
  close: () => void;
  onSelect: (token: IToken) => void;
  origin: ChainName;
  destination: ChainName;
  onSelectUnsupportedRoute: (token: IToken, origin: string) => void;
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

  const onSelectUnsupportedRouteAndClose = (token: IToken, origin: string) => {
    onSelectUnsupportedRoute(token, origin);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      close={onClose}
      panelClassname="px-2 py-3 max-w-100 sm:max-w-[31rem] max-h-none overflow-auto"
    >
      <SearchBar search={search} setSearch={setSearch} />
      <TokenList
        origin={origin}
        destination={destination}
        searchQuery={search}
        onSelect={onSelectAndClose}
        onSelectUnsupportedRoute={onSelectUnsupportedRouteAndClose}
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
    <div className="relative px-2">
      <SearchIcon
        width={20}
        height={20}
        className="absolute left-5 top-1/2 -translate-y-1/2 pb-1 opacity-50"
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
  onSelectUnsupportedRoute,
}: {
  origin: ChainName;
  destination: ChainName;
  searchQuery: string;
  onSelect: (token: IToken) => void;
  onSelectUnsupportedRoute: (token: Token, origin: string) => void;
}) {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();
  const tokensBySymbolChainMap = useStore((s) => s.tokensBySymbolChainMap);

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

  const unsupportedRouteTokensBySymbolMap = useMemo(() => {
    const tokenSymbols = tokens.map((item) => item.token.symbol);
    const q = searchQuery?.trim().toLowerCase();
    return objFilter(tokensBySymbolChainMap, (symbol, value): value is TokenChainMap => {
      return (
        !tokenSymbols.includes(symbol) &&
        (q === '' ||
          value.tokenInformation.name.toLowerCase().includes(q) ||
          value.tokenInformation.symbol.toLowerCase().includes(q))
      );
    });
  }, [tokens, tokensBySymbolChainMap, searchQuery]);

  const noTokensFound = tokens.length === 0 && isObjEmpty(unsupportedRouteTokensBySymbolMap);

  return (
    <div className="no-scrollbar flex max-h-[80vh] min-h-[24rem] flex-col items-stretch overflow-auto px-2">
      {tokens.map((t, i) => (
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
            <div className="w-16 truncate text-sm">{t.token.symbol || 'Unknown'}</div>
            <div className="w-16 truncate text-xs text-gray-500">{t.token.name || 'Unknown'}</div>
          </div>
          <div className="ml-2 min-w-0 shrink text-left">
            <div className="w-full truncate text-xs">
              {t.token.collateralAddressOrDenom || t.token.addressOrDenom || 'Native chain token'}
            </div>
            <div className="mt-0.5 flex space-x-1 text-xs">
              <span>{`Decimals: ${t.token.decimals}`}</span>
              <span>-</span>
              <span>{`Chain: ${getChainDisplayName(multiProvider, t.token.chainName)}`}</span>
            </div>
          </div>
        </button>
      ))}
      <UnsupportedRouteTokenList
        unsupportedRouteTokensBySymbolMap={unsupportedRouteTokensBySymbolMap}
        origin={origin}
        destination={destination}
        onSelectUnsupportedRoute={onSelectUnsupportedRoute}
      />
      {noTokensFound && (
        <div className="my-8 text-center text-gray-500">
          <div>No tokens found</div>
          <div className="mt-2 text-sm">Try a different destination chain or search query</div>
        </div>
      )}
    </div>
  );
}

function UnsupportedRouteTokenList({
  unsupportedRouteTokensBySymbolMap,
  origin,
  destination,
  onSelectUnsupportedRoute,
}: {
  unsupportedRouteTokensBySymbolMap: Record<string, TokenChainMap>;
  origin: ChainName;
  destination: ChainName;
  onSelectUnsupportedRoute: (token: Token, origin: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const multiProvider = useMultiProvider();

  return Object.entries(unsupportedRouteTokensBySymbolMap).map(
    ([symbol, { chains, tokenInformation }]) => (
      <React.Fragment key={symbol}>
        <button
          className="duration-250 -mx-2 mb-2 flex items-center rounded px-2 py-2 opacity-50 transition-all hover:bg-gray-200"
          type="button"
          onClick={() => setOpen((prevSymbol) => (prevSymbol === symbol ? null : symbol))}
        >
          <div className="shrink-0">
            <TokenIcon token={tokenInformation} size={30} />
          </div>
          <div className="ml-2 shrink-0 text-left">
            <div className="text-sm">{tokenInformation.symbol || 'Unknown'}</div>
            <div className="text-xs text-gray-500">{tokenInformation.name || 'Unknown'}</div>
          </div>
          <Image
            src={InfoIcon}
            alt="Unsupported route for origin and destination"
            className="ml-auto mr-1"
            data-te-toggle="tooltip"
            title={`Route not supported for ${getChainDisplayName(
              multiProvider,
              origin,
            )} to ${getChainDisplayName(multiProvider, destination)}`}
          />
        </button>
        <AnimatePresence initial={false}>
          {open === symbol ? (
            <UnsupportedRouteChainList
              chains={chains}
              onSelectUnsupportedRoute={onSelectUnsupportedRoute}
            />
          ) : null}
        </AnimatePresence>
      </React.Fragment>
    ),
  );
}

function UnsupportedRouteChainList({
  chains,
  onSelectUnsupportedRoute,
}: {
  chains: ChainMap<{ token: Token; metadata: ChainMetadata | null }>;
  onSelectUnsupportedRoute: (token: Token, origin: string) => void;
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
    >
      {Object.entries(chains).map(([chainName, chain]) => (
        <button
          key={chainName}
          className="flex w-full items-center gap-4 rounded border-b border-gray-100 px-4 py-2 hover:bg-gray-200"
          onClick={() => onSelectUnsupportedRoute(chain.token, chainName)}
        >
          <div className="shrink-0">
            <ChainLogo chainName={chainName} size={16} />
          </div>
          <div className="text-xs">{chain.metadata?.displayName || chainName}</div>
        </button>
      ))}
    </motion.div>
  );
}
