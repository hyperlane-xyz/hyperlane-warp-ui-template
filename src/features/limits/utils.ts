import { IToken, Token } from '@hyperlane-xyz/sdk';
import { logger } from '../../utils/logger';
import { isValidMultiCollateralToken } from '../tokens/utils';
import { multiCollateralTokenLimits } from './const';
import { RouteLimit } from './types';

export function getMultiCollateralTokenLimit(
  originToken: Token | IToken,
  destination: ChainName,
  routeLimits: RouteLimit[] = multiCollateralTokenLimits,
) {
  const destinationToken = originToken.getConnectionForChain(destination)?.token;
  if (!destinationToken) return null;

  const isMultiCollateralToken = isValidMultiCollateralToken(originToken, destinationToken);
  if (!isMultiCollateralToken) return null;
  logger.debug('hello', destinationToken);

  const limitExists = routeLimits.find((limit) => {
    if (limit.symbol !== originToken.symbol || limit.symbol !== destinationToken.symbol)
      return false;

    if (
      !limit.chains.includes(originToken.chainName) ||
      !limit.chains.includes(destinationToken.chainName)
    )
      return false;

    return true;
  });

  return limitExists || null;
}

export function isMultiCollateralLimitExceeded(
  originToken: Token | IToken,
  destination: ChainName,
  amountWei: string,
  routeLimits: RouteLimit[] = multiCollateralTokenLimits,
): bigint | null {
  const limitExists = getMultiCollateralTokenLimit(originToken, destination, routeLimits);

  if (!limitExists) return null;

  return BigInt(amountWei) > limitExists.amountWei ? limitExists.amountWei : null;
}
