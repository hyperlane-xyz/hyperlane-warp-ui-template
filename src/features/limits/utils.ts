import { IToken, Token } from '@hyperlane-xyz/sdk';
import { isValidMultiCollateralToken } from '../tokens/utils';
import { multiCollateralTokenLimits } from './const';
import { RouteLimit } from './types';

export function getMultiCollateralTokenLimit(
  originToken: Token | IToken,
  destination: ChainName | IToken,
  routeLimits: RouteLimit[] = multiCollateralTokenLimits,
) {
  const destinationToken =
    typeof destination === 'string' ? originToken.getConnectionForChain(destination)?.token : destination;
  if (!destinationToken) return null;

  const isMultiCollateralToken = isValidMultiCollateralToken(originToken, destinationToken);
  if (!isMultiCollateralToken) return null;

  const limitExists = routeLimits.find((limit) => {
    if (limit.symbol !== originToken.symbol || limit.symbol !== destinationToken.symbol)
      return false;

    return (
      limit.chains.includes(originToken.chainName) &&
      limit.chains.includes(destinationToken.chainName)
    );
  });

  return limitExists || null;
}

export function isMultiCollateralLimitExceeded(
  originToken: Token | IToken,
  destination: ChainName | IToken,
  amountWei: string,
  routeLimits: RouteLimit[] = multiCollateralTokenLimits,
): bigint | null {
  const limitExists = getMultiCollateralTokenLimit(originToken, destination, routeLimits);

  if (!limitExists) return null;

  return BigInt(amountWei) > limitExists.amountWei ? limitExists.amountWei : null;
}
