import type { IToken } from '@hyperlane-xyz/sdk/token/IToken';
import type { Token } from '@hyperlane-xyz/sdk/token/Token';
import type { ChainName } from '@hyperlane-xyz/sdk/types';
import type { WarpCore } from '@hyperlane-xyz/sdk/warp/WarpCore';
import { ProtocolType, normalizeAddress } from '@hyperlane-xyz/utils';
import { useEthereumWatchAsset } from '@hyperlane-xyz/widgets/walletIntegrations/ethereum';
import {
  useEthereumAccount,
  useEthereumActiveChain,
} from '@hyperlane-xyz/widgets/walletIntegrations/ethereumWallet';
import { useMutation } from '@tanstack/react-query';

import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';
import { getTokenKey } from './utils';

export function useWarpCore() {
  const warpCore = useStore((s) => s.warpCore);
  if (!warpCore) {
    throw new Error('Warp context not ready');
  }
  return warpCore;
}

export function useReadyWarpCore() {
  return useStore((s) => s.warpCore);
}
/**
 * Find a token by its key from a WarpCore or Token array
 */
export function getTokenByKey(tokens: Token[], key: string | undefined): Token | undefined {
  if (!key) return undefined;
  return tokens.find((token) => getTokenKey(token) === key);
}

/** Raw tokens from WarpCore (not deduplicated) */
export function useWarpCoreTokens() {
  return useWarpCore().tokens;
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

export function tryFindTokenInTokens(
  tokens: IToken[],
  chain: ChainName,
  addressOrDenom?: string,
): IToken | null {
  if (!addressOrDenom) return null;
  const normalized = normalizeAddress(addressOrDenom);
  return (
    tokens.find(
      (token) =>
        token.chainName === chain &&
        normalizeAddress(token.addressOrDenom, token.protocol) === normalized,
    ) || null
  );
}

export function tryFindTokenConnection(token: Token, chainName: string) {
  const connectedToken = token.connections?.find(
    (connection) => connection.token.chainName === chainName,
  );

  return connectedToken ? connectedToken.token : null;
}

export function useAddToken(token?: IToken) {
  const multiProvider = useMultiProvider();
  const activeChain = useEthereumActiveChain(multiProvider);
  const { addAsset } = useEthereumWatchAsset(multiProvider);
  const account = useEthereumAccount(multiProvider);
  const isAccountReady = account?.isReady;
  const isSupportedProtocol = token?.protocol === ProtocolType.Ethereum;

  const canAddAsset = token && isAccountReady && isSupportedProtocol;

  const { isPending, mutateAsync } = useMutation({
    mutationFn: () => {
      if (!canAddAsset)
        throw new Error('Cannot import this asset, please check the token imported');

      if (!activeChain.chainName)
        throw new Error('Not active chain found, please check if your wallet is connected ');

      return addAsset(token, activeChain.chainName);
    },
  });

  return { addToken: mutateAsync, isLoading: isPending, canAddAsset };
}
