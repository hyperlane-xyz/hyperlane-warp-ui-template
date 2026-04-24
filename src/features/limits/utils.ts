import { IToken, Token } from '@hyperlane-xyz/sdk';
<<<<<<< HEAD
=======

>>>>>>> origin/main
import { isValidMultiCollateralToken } from '../tokens/utils';
import { multiCollateralTokenLimits } from './const';
import { RouteLimit } from './types';

export function getMultiCollateralTokenLimit(
  originToken: Token | IToken,
<<<<<<< HEAD
  destination: ChainName,
  routeLimits: RouteLimit[] = multiCollateralTokenLimits,
) {
  const destinationToken = originToken.getConnectionForChain(destination)?.token;
  if (!destinationToken) return null;

  const isMultiCollateralToken = isValidMultiCollateralToken(originToken, destinationToken);
  if (!isMultiCollateralToken) return null;
=======
  destinationToken: Token | IToken,
  routeLimits: RouteLimit[] = multiCollateralTokenLimits,
) {
  if (!isValidMultiCollateralToken(originToken, destinationToken)) return null;
>>>>>>> origin/main

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
<<<<<<< HEAD
  destination: ChainName,
  amountWei: string,
  routeLimits: RouteLimit[] = multiCollateralTokenLimits,
): bigint | null {
  const limitExists = getMultiCollateralTokenLimit(originToken, destination, routeLimits);
=======
  destinationToken: Token | IToken,
  amountWei: string,
  routeLimits: RouteLimit[] = multiCollateralTokenLimits,
): bigint | null {
  const limitExists = getMultiCollateralTokenLimit(originToken, destinationToken, routeLimits);
>>>>>>> origin/main

  if (!limitExists) return null;

  return BigInt(amountWei) > limitExists.amountWei ? limitExists.amountWei : null;
}
