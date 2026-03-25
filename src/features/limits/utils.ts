import type { IToken } from '@hyperlane-xyz/sdk/token/IToken';
import type { Token } from '@hyperlane-xyz/sdk/token/Token';

import { isValidMultiCollateralToken } from '../tokens/utils';
import { multiCollateralTokenLimits } from './const';
import { RouteLimit } from './types';

export function getMultiCollateralTokenLimit(
  originToken: Token | IToken,
  destinationToken: Token | IToken,
  routeLimits: RouteLimit[] = multiCollateralTokenLimits,
) {
  if (!isValidMultiCollateralToken(originToken, destinationToken)) return null;

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
  destinationToken: Token | IToken,
  amountWei: string,
  routeLimits: RouteLimit[] = multiCollateralTokenLimits,
): bigint | null {
  const limitExists = getMultiCollateralTokenLimit(originToken, destinationToken, routeLimits);

  if (!limitExists) return null;

  return BigInt(amountWei) > limitExists.amountWei ? limitExists.amountWei : null;
}
