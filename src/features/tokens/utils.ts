import {
  IToken,
  MultiProtocolProvider,
  Token,
  TOKEN_COLLATERALIZED_STANDARDS,
  WarpCore,
} from '@hyperlane-xyz/sdk';
import { eqAddress, normalizeAddress } from '@hyperlane-xyz/utils';
import { isChainDisabled } from '../chains/utils';
import { MultiCollateralTokenMap, TokenChainMap, Tokens } from './types';

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

      // remove chain from map if it is disabled
      const chainDisabled = isChainDisabled(chainMetadata);
      if (chainDisabled) return acc;

      acc[token.symbol].chains[token.chainName] = { token, metadata: chainMetadata };
    }

    return acc;
  }, {});
}

export function isValidMultiCollateralToken(
  originToken: Token | IToken,
  destination: ChainName | IToken,
) {
  if (
    !originToken.collateralAddressOrDenom ||
    !TOKEN_COLLATERALIZED_STANDARDS.includes(originToken.standard)
  )
    return false;

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
  destination: IToken,
) {
  const originCollateralAddress = origin.collateralAddressOrDenom
    ? normalizeAddress(origin.collateralAddressOrDenom, origin.protocol)
    : undefined;
  const destinationCollateralAddress = destination.collateralAddressOrDenom
    ? normalizeAddress(destination.collateralAddressOrDenom, destination.protocol)
    : undefined;
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
      if (!isMultiCollateralToken) return false;

      // asserting because isValidMultiCollateralToken already checks for existence of collateralAddressOrDenom
      const currentOriginCollateralAddress = normalizeAddress(
        originToken.collateralAddressOrDenom!,
        originToken.protocol,
      );
      const currentDestinationCollateralAddress = normalizeAddress(
        destinationToken.collateralAddressOrDenom!,
        destinationToken.protocol,
      );

      return (
        eqAddress(originCollateralAddress, currentOriginCollateralAddress) &&
        eqAddress(destinationCollateralAddress, currentDestinationCollateralAddress)
      );
    });
}

// De-duplicate collaterized tokens
// Returns a map of token with same origin and dest collateral address
// And an array of tokens with repeated collateral addresses grouped into one
export function dedupeMultiCollateralTokens(tokens: Tokens, destination) {
  return tokens.reduce<{ tokens: Tokens; multiCollateralTokenMap: MultiCollateralTokenMap }>(
    (acc, t) => {
      const originToken = t.token;
      const isMultiCollateralToken = isValidMultiCollateralToken(originToken, destination);
      if (!isMultiCollateralToken) return { ...acc, tokens: [...acc.tokens, t] };

      // Non-Null asserting this because this is covered by isValidMultiCollateralToken and
      // the early return from above
      const destinationToken = originToken.getConnectionForChain(destination)!.token;
      const originAddress = normalizeAddress(
        originToken.collateralAddressOrDenom!,
        originToken.protocol,
      );
      const destinationAddress = normalizeAddress(
        destinationToken.collateralAddressOrDenom!,
        destinationToken.protocol,
      );

      // now origin and destination are both collaterals
      // create map for tokens with same origin and destination collateral addresses
      acc.multiCollateralTokenMap[originAddress] ||= {};
      if (!acc.multiCollateralTokenMap[originAddress][destinationAddress]) {
        acc.multiCollateralTokenMap[originAddress][destinationAddress] = [];
        acc.tokens.push(t);
      }

      acc.multiCollateralTokenMap[originAddress][destinationAddress].push(originToken);
      return acc;
    },
    { tokens: [], multiCollateralTokenMap: {} },
  );
}
