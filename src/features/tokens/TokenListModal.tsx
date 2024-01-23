import Image from 'next/image';
import { useMemo, useState } from 'react';

import { TokenIcon } from '../../components/icons/TokenIcon';
import { TextInput } from '../../components/input/TextField';
import { Modal } from '../../components/layout/Modal';
import { config } from '../../consts/config';
import InfoIcon from '../../images/icons/info-circle.svg';
import { getAssetNamespace, getTokenAddress, isNativeToken } from '../caip/tokens';
import { getChainDisplayName } from '../chains/utils';
import { RoutesMap } from '../routes/types';
import { hasTokenRoute } from '../routes/utils';

import { getTokens } from './metadata';
import { TokenMetadata } from './types';

export function TokenListModal({
  isOpen,
  close,
  onSelect,
  originCaip2Id,
  destinationCaip2Id,
  tokenRoutes,
}: {
  isOpen: boolean;
  close: () => void;
  onSelect: (token: TokenMetadata) => void;
  originCaip2Id: ChainCaip2Id;
  destinationCaip2Id: ChainCaip2Id;
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
        originCaip2Id={originCaip2Id}
        destinationCaip2Id={destinationCaip2Id}
        tokenRoutes={tokenRoutes}
        searchQuery={search}
        onSelect={onSelectAndClose}
      />
    </Modal>
  );
}

export function TokenList({
  originCaip2Id,
  destinationCaip2Id,
  tokenRoutes,
  searchQuery,
  onSelect,
}: {
  originCaip2Id: ChainCaip2Id;
  destinationCaip2Id: ChainCaip2Id;
  tokenRoutes: RoutesMap;
  searchQuery: string;
  onSelect: (token: TokenMetadata) => void;
}) {
  const tokens = useMemo(() => {
    const q = searchQuery?.trim().toLowerCase();
    return (
      getTokens()
        .map((t) => {
          const hasRoute = hasTokenRoute(
            originCaip2Id,
            destinationCaip2Id,
            t.tokenCaip19Id,
            tokenRoutes,
          );
          return { ...t, disabled: !hasRoute };
        })
        .sort((a, b) => {
          if (a.disabled && !b.disabled) return 1;
          else if (!a.disabled && b.disabled) return -1;
          else return 0;
        })
        // Remove duplicates
        .filter((t, i, list) => i === list.findIndex((t2) => t2.tokenCaip19Id === t.tokenCaip19Id))
        // Filter down to search query
        .filter((t) => {
          if (!q) return t;
          return (
            t.name.toLowerCase().includes(q) ||
            t.symbol.toLowerCase().includes(q) ||
            t.tokenCaip19Id.toLowerCase().includes(q)
          );
        })
        // Hide/show disabled tokens
        .filter((t) => (config.showDisabledTokens ? true : !t.disabled))
    );
  }, [searchQuery, originCaip2Id, destinationCaip2Id, tokenRoutes]);

  return (
    <div className="flex flex-col items-stretch">
      {tokens.length ? (
        tokens.map((t) => (
          <button
            className={`-mx-2 py-2 px-2 rounded mb-2 flex items-center ${
              t.disabled ? 'opacity-50' : 'hover:bg-gray-200'
            } transition-all duration-250`}
            key={t.tokenCaip19Id}
            type="button"
            disabled={t.disabled}
            onClick={() => onSelect(t)}
          >
            <div className="shrink-0">
              <TokenIcon token={t} size={30} />
            </div>
            <div className="ml-2 text-left shrink-0">
              <div className="text-sm w-14 truncate">{t.symbol || 'Unknown'}</div>
              <div className="text-xs text-gray-500 w-14 truncate">{t.name || 'Unknown'}</div>
            </div>
            <div className="ml-2 text-left shrink min-w-0">
              <div className="text-xs w-full truncate">
                {isNativeToken(t.tokenCaip19Id)
                  ? 'Native chain token'
                  : getTokenAddress(t.tokenCaip19Id)}
              </div>
              <div className=" mt-0.5 text-xs flex space-x-1">
                <span>{`Decimals: ${t.decimals}`}</span>
                <span>-</span>
                <span>{`Type: ${getAssetNamespace(t.tokenCaip19Id)}`}</span>
              </div>
            </div>
            {t.disabled && (
              <Image
                src={InfoIcon}
                alt=""
                className="ml-auto mr-1"
                data-te-toggle="tooltip"
                title={`Route not supported for ${getChainDisplayName(
                  originCaip2Id,
                )} to ${getChainDisplayName(destinationCaip2Id)}`}
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
