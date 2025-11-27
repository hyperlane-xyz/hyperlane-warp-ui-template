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
import { TokenChainMap } from './types';
import { dedupeMultiCollateralTokens } from './utils';

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
      panelClassname="bg-[#f8f8ff] px-4 py-4 max-w-100 sm:max-w-[31rem] max-h-none overflow-auto rounded-3xl"
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
    <div className="relative">
      <SearchIcon
        width={24}
        height={24}
        className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50"
      />
      <TextInput
        ref={inputRef}
        value={search}
        onChange={setSearch}
        placeholder="Token name, symbol, or address"
        name="token-search"
        className="mb-6 h-14 w-full rounded-xl border border-[#dbd8e0] bg-white pl-12 text-base font-medium text-[#8e8c99] all:py-3.5 all:focus:border-primary-500"
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

  const { tokens } = useMemo(() => {
    const q = searchQuery?.trim().toLowerCase();
    const multiChainTokens = warpCore.tokens.filter((t) => t.isMultiChainToken());
    const tokensWithRoute = warpCore.getTokensForRoute(origin, destination);

    const tokens = multiChainTokens
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
          t.token.addressOrDenom.toLowerCase().includes(q) ||
          t.token.collateralAddressOrDenom?.toLowerCase().includes(q)
        );
      })
      // Hide/show disabled tokens
      .filter((t) => (config.showDisabledTokens ? true : !t.disabled));

    return dedupeMultiCollateralTokens(tokens, destination);
  }, [warpCore, searchQuery, origin, destination]);

  const unsupportedRouteTokensBySymbolMap = useMemo(() => {
    const tokenSymbols = tokens.map((item) => item.token.symbol);
    const q = searchQuery?.trim().toLowerCase();
    return objFilter(tokensBySymbolChainMap, (symbol, value): value is TokenChainMap => {
      const token = value.tokenInformation;
      return (
        !tokenSymbols.includes(symbol) &&
        (q === '' ||
          token.name.toLowerCase().includes(q) ||
          token.symbol.toLowerCase().includes(q) ||
          token.collateralAddressOrDenom?.toLowerCase().includes(q) ||
          token.addressOrDenom.toLowerCase().includes(q))
      );
    });
  }, [tokens, tokensBySymbolChainMap, searchQuery]);

  const noTokensFound = tokens.length === 0 && isObjEmpty(unsupportedRouteTokensBySymbolMap);

  return (
    <div className="no-scrollbar flex max-h-[80vh] min-h-[24rem] flex-col items-stretch gap-2 overflow-auto">
      {tokens.map((t, i) => (
        <button
          className={`relative flex min-h-[60px] items-start gap-2 rounded-xl p-2 pl-14 transition-all duration-200 ${
            t.disabled ? 'opacity-50' : 'hover:bg-[#eae7ec]'
          }`}
          key={i}
          type="button"
          disabled={t.disabled}
          onClick={() => onSelect(t.token)}
        >
          {/* Token Icon - absolute positioned */}
          <div className="absolute left-2 top-[10px] shrink-0">
            <TokenIcon token={t.token} size={40} />
          </div>

          {/* Token Info - left column */}
          <div className="flex w-16 shrink-0 flex-col gap-1">
            <span className="truncate text-base font-semibold leading-5 text-[#202020]">
              {t.token.symbol || 'Unknown'}
            </span>
            <span className="truncate text-base font-medium leading-5 text-[#8e8c99]">
              {t.token.name || 'Unknown'}
            </span>
          </div>

          {/* Token Details - right column */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-base font-semibold leading-5 text-[#202020]">
              {t.token.collateralAddressOrDenom || t.token.addressOrDenom || 'Native'}
            </span>
            <div className="flex items-center justify-end gap-3 text-base font-medium leading-5 text-[#8e8c99]">
              <span className="whitespace-nowrap">Decimals: {t.token.decimals}</span>
              <span className="whitespace-nowrap">
                Chain: {getChainDisplayName(multiProvider, t.token.chainName)}
              </span>
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
          className="relative flex min-h-[60px] items-start gap-2 rounded-xl p-2 pl-14 opacity-50 transition-all duration-200 hover:bg-[#eae7ec]"
          type="button"
          onClick={() => setOpen((prevSymbol) => (prevSymbol === symbol ? null : symbol))}
        >
          {/* Token Icon - absolute positioned */}
          <div className="absolute left-2 top-[10px] shrink-0">
            <TokenIcon token={tokenInformation} size={40} />
          </div>

          {/* Token Info - left column */}
          <div className="flex w-16 shrink-0 flex-col gap-1">
            <span className="truncate text-base font-semibold leading-5 text-[#202020]">
              {tokenInformation.symbol || 'Unknown'}
            </span>
            <span className="truncate text-base font-medium leading-5 text-[#8e8c99]">
              {tokenInformation.name || 'Unknown'}
            </span>
          </div>

          {/* Token Details - right column */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-base font-semibold leading-5 text-[#202020]">
              Unsupported route
            </span>
            <div className="flex items-center justify-end gap-3 text-base font-medium leading-5 text-[#8e8c99]">
              <span className="whitespace-nowrap">
                {getChainDisplayName(multiProvider, origin)} → {getChainDisplayName(multiProvider, destination)}
              </span>
            </div>
          </div>

          <Image
            src={InfoIcon}
            alt="Unsupported route for origin and destination"
            className="ml-2 shrink-0"
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
