import Image from 'next/image';
import { useMemo, useState } from 'react';

import { IToken } from '@hyperlane-xyz/sdk';

import { TokenIcon } from '../../components/icons/TokenIcon';
import { TextInput } from '../../components/input/TextField';
import { Modal } from '../../components/layout/Modal';
import { config } from '../../consts/config';
import { getWarpCore } from '../../context/context';
import InfoIcon from '../../images/icons/info-circle.svg';
import { getChainDisplayName } from '../chains/utils';

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
        origin={origin}
        destination={destination}
        searchQuery={search}
        onSelect={onSelectAndClose}
      />
    </Modal>
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
  const tokens = useMemo(() => {
    const q = searchQuery?.trim().toLowerCase();
    const warpCore = getWarpCore();
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
  }, [searchQuery, origin, destination]);

  return (
    <div className="flex flex-col items-stretch">
      {tokens.length ? (
        tokens.map((t, i) => (
          <button
            className={`-mx-2 py-2 px-2 rounded mb-2 flex items-center ${
              t.disabled ? 'opacity-50' : 'hover:bg-gray-200'
            } transition-all duration-250`}
            key={i}
            type="button"
            disabled={t.disabled}
            onClick={() => onSelect(t.token)}
          >
            <div className="shrink-0">
              <TokenIcon token={t.token} size={30} />
            </div>
            <div className="ml-2 text-left shrink-0">
              <div className="text-sm w-14 truncate">{t.token.symbol || 'Unknown'}</div>
              <div className="text-xs text-gray-500 w-14 truncate">{t.token.name || 'Unknown'}</div>
            </div>
            <div className="ml-2 text-left shrink min-w-0">
              <div className="text-xs w-full truncate">
                {t.token.addressOrDenom || 'Native chain token'}
              </div>
              <div className=" mt-0.5 text-xs flex space-x-1">
                <span>{`Decimals: ${t.token.decimals}`}</span>
                <span>-</span>
                <span>{`Chain: ${getChainDisplayName(t.token.chainName)}`}</span>
              </div>
            </div>
            {t.disabled && (
              <Image
                src={InfoIcon}
                alt=""
                className="ml-auto mr-1"
                data-te-toggle="tooltip"
                title={`Route not supported for ${getChainDisplayName(
                  origin,
                )} to ${getChainDisplayName(destination)}`}
              />
            )}
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
