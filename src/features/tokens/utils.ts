import {
  ChainMap,
  ChainMetadata,
  IToken,
  MultiProtocolProvider,
  Token,
  TOKEN_COLLATERALIZED_STANDARDS,
  WarpCore,
} from '@hyperlane-xyz/sdk';

export type TokenChainMap = {
  chains: ChainMap<{ token: Token; metadata: ChainMetadata | null }>;
  tokenInformation: Token;
};

// Map of token symbols and token chain map
// Symbols are not duplicated to avoid the same symbol from being shown
// TokenChainMap: An object containing token information and a map
// chain names with its metadata and the related token
export function assembleTokensBySymbolChainMap(
  tokens: Token[],
  multiProvider: MultiProtocolProvider,
): Record<string, TokenChainMap> {
  const multiChainTokens = tokens.filter((t) => t.isMultiChainToken());
  return multiChainTokens.reduce<Record<string, TokenChainMap>>((acc, token) => {
    if (!token.connections || !token.connections.length) return acc;

    if (!acc[token.symbol]) {
      acc[token.symbol] = {
        chains: {},
        tokenInformation: token,
      };
    }
    if (!acc[token.symbol].chains[token.chainName]) {
      const chainMetadata = multiProvider.tryGetChainMetadata(token.chainName);
      acc[token.symbol].chains[token.chainName] = { token, metadata: chainMetadata };
    }

    return acc;
  }, {});
}

export function isValidMultiCollateralToken(originToken: Token, destination: ChainName | IToken) {
  if (!originToken.collateralAddressOrDenom || !originToken.isCollateralized()) return false;

  const destinationToken =
    typeof destination === 'string'
      ? originToken.getConnectionForChain(destination)?.token
      : destination;

  if (
    !destinationToken ||
    !destinationToken.collateralAddressOrDenom ||
    !TOKEN_COLLATERALIZED_STANDARDS.includes(destinationToken.standard)
  )
    return false;

  return true;
}

export function getTokensWithSameCollateralAddresses(
  warpCore: WarpCore,
  origin: Token,
  destination: IToken | Token,
) {
  const originCollateralAddress = origin.collateralAddressOrDenom?.toLowerCase();
  const destinationCollateralAddress = destination.collateralAddressOrDenom?.toLowerCase();
  if (!originCollateralAddress || !destinationCollateralAddress) return [];

  return warpCore
    .getTokensForRoute(origin.chainName, destination.chainName)
    .map((originToken) => {
      const destinationToken = originToken.getConnectionForChain(destination.chainName)?.token;
      return { originToken, destinationToken };
    })
    .filter((tokens): tokens is { originToken: Token; destinationToken: Token } => {
      // doing this because annoying Typescript will have destinationToken
      // as undefined even if it is filtered out
      const { originToken, destinationToken } = tokens;

      if (!destinationToken) return false;
      const isMultiCollateralToken = isValidMultiCollateralToken(originToken, destinationToken);
      if (!destinationToken || !isMultiCollateralToken) return false;

      // asserting because isValidMultiCollateralToken already checks for existence of collateralAddressOrDenom
      if (
        originToken.collateralAddressOrDenom!.toLowerCase() !== originCollateralAddress ||
        destinationToken.collateralAddressOrDenom!.toLowerCase() !== destinationCollateralAddress
      )
        return false;

      return true;
    });
}
