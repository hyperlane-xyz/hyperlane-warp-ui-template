import { IToken, Token, type WarpCore } from '@hyperlane-xyz/sdk';
import {
  useAccountForChain,
  useActiveChains,
  useWatchAsset,
} from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { useMutation } from '@tanstack/react-query';

import { ADD_ASSET_SUPPORTED_PROTOCOLS } from '../../consts/args';
import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';
import { getTokenKey } from './utils';

export function useWarpCore() {
  return useStore((s) => s.warpCore);
}
/**
 * Find a token by its key from a WarpCore or Token array
 */
export function getTokenByKey(tokens: Token[], key: string | undefined): Token | undefined {
  if (!key) return undefined;
  return tokens.find((token) => getTokenKey(token) === key);
}

/** Unified tokens array (deduplicated, can be origin or destination) */
export function useTokens() {
  return useStore((s) => s.tokens);
}

export function useCollateralGroups() {
  return useStore((s) => s.collateralGroups);
}

/** Pre-computed token key to Token map for O(1) lookups */
export function useTokenByKeyMap() {
  return useStore((s) => s.tokenByKeyMap);
}

/**
 * O(1) token lookup by key using the pre-computed map.
 * Use this instead of getTokenByKey() for better performance.
 */
export function getTokenByKeyFromMap(
  tokenByKeyMap: Map<string, Token>,
  key: string | undefined,
): Token | undefined {
  if (!key) return undefined;
  return tokenByKeyMap.get(key);
}

export function tryFindToken(
  warpCore: WarpCore,
  chain: ChainName,
  addressOrDenom?: string,
): IToken | null {
  try {
    return warpCore.findToken(chain, addressOrDenom);
  } catch {
    return null;
  }
}

export function tryFindTokenConnection(token: Token, chainName: string) {
  const connectedToken = token.connections?.find(
    (connection) => connection.token.chainName === chainName,
  );

  return connectedToken ? connectedToken.token : null;
}

export function useAddToken(token?: IToken) {
  const multiProvider = useMultiProvider();
  const activeChains = useActiveChains(multiProvider);
  const watchAsset = useWatchAsset(multiProvider);
  const account = useAccountForChain(multiProvider, token?.chainName);
  const isAccountReady = account?.isReady;
  const isSupportedProtocol = token
    ? ADD_ASSET_SUPPORTED_PROTOCOLS.includes(token?.protocol)
    : false;

  const canAddAsset = token && isAccountReady && isSupportedProtocol;

  const { isPending, mutateAsync } = useMutation({
    mutationFn: () => {
      if (!canAddAsset)
        throw new Error('Cannot import this asset, please check the token imported');

      const { addAsset } = watchAsset[token.protocol];
      const activeChain = activeChains.chains[token.protocol];

      if (!activeChain.chainName)
        throw new Error('Not active chain found, please check if your wallet is connected ');

      return addAsset(token, activeChain.chainName);
    },
  });

  return { addToken: mutateAsync, isLoading: isPending, canAddAsset };
}
