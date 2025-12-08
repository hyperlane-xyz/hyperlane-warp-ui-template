import { IToken, Token, WarpCore } from '@hyperlane-xyz/sdk';
import { useAccountForChain, useActiveChains, useWatchAsset } from '@hyperlane-xyz/widgets';
import { useMutation } from '@tanstack/react-query';
import { ADD_ASSET_SUPPORTED_PROTOCOLS, WARP_QUERY_PARAMS } from '../../consts/args';
import { config } from '../../consts/config';
import { getQueryParams } from '../../utils/queryParams';
import { useMultiProvider } from '../chains/hooks';
import { tryGetValidChainName } from '../chains/utils';
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

// Helper to find token by chainName-symbol format
function findTokenByChainSymbol(tokens: Token[], chainSymbol: string): Token | undefined {
  const [chainName, symbol] = chainSymbol.split('-');
  if (!chainName || !symbol) return undefined;
  return tokens.find(
    (t) => t.chainName === chainName && t.symbol.toLowerCase() === symbol.toLowerCase(),
  );
}

/**
 * Get initial origin and destination token keys from URL params
 * Returns { originTokenKey, destinationTokenKey } for form initialization
 */
export function getInitialTokenKeys(
  warpCore: WarpCore,
  originTokens: Token[],
  destinationTokens: Token[],
): { originTokenKey: string | undefined; destinationTokenKey: string | undefined } {
  // Early return if no tokens
  if (originTokens.length === 0) {
    return { originTokenKey: undefined, destinationTokenKey: undefined };
  }

  // 1. First priority: URL params
  const params = getQueryParams();
  const originChainQuery = tryGetValidChainName(
    params.get(WARP_QUERY_PARAMS.ORIGIN),
    warpCore.multiProvider,
  );
  const destinationChainQuery = tryGetValidChainName(
    params.get(WARP_QUERY_PARAMS.DESTINATION),
    warpCore.multiProvider,
  );
  const originTokenSymbol = params.get(WARP_QUERY_PARAMS.ORIGIN_TOKEN);
  const destinationTokenSymbol = params.get(WARP_QUERY_PARAMS.DESTINATION_TOKEN);

  // Try to find origin token from URL params (chain + symbol)
  let originToken: Token | undefined;
  if (originChainQuery && originTokenSymbol) {
    originToken = originTokens.find(
      (t) =>
        t.chainName === originChainQuery &&
        t.symbol.toLowerCase() === originTokenSymbol.toLowerCase(),
    );
  }

  // 2. Second priority: Config default token (format: chainName-symbol)
  if (!originToken && config.defaultOriginToken) {
    originToken = findTokenByChainSymbol(originTokens, config.defaultOriginToken);
  }

  // 3. Last resort: First available token
  if (!originToken) {
    originToken = originTokens[0];
  }

  // Try to find destination token from URL params (chain + symbol)
  let destinationToken: Token | undefined;
  if (destinationChainQuery && destinationTokenSymbol) {
    destinationToken = destinationTokens.find(
      (t) =>
        t.chainName === destinationChainQuery &&
        t.symbol.toLowerCase() === destinationTokenSymbol.toLowerCase(),
    );
  }

  // Fallback: use config default token (format: chainName-symbol)
  if (!destinationToken && config.defaultDestinationToken) {
    destinationToken = findTokenByChainSymbol(destinationTokens, config.defaultDestinationToken);
  }

  // Last resort: first connection from origin token
  if (!destinationToken) {
    const firstConnection = originToken.connections?.[0];
    const connectedChain = firstConnection?.token?.chainName;
    destinationToken = connectedChain
      ? destinationTokens.find(
          (dt) => dt.chainName === connectedChain && dt.symbol === firstConnection?.token?.symbol,
        )
      : undefined;
  }

  return {
    originTokenKey: getTokenKey(originToken),
    destinationTokenKey: destinationToken ? getTokenKey(destinationToken) : undefined,
  };
}

export function useTokens() {
  return useWarpCore().tokens;
}

export function useOriginTokens() {
  return useStore((s) => s.originTokens);
}

export function useDestinationTokens() {
  return useStore((s) => s.destinationTokens);
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
