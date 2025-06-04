import { IToken, Token } from '@hyperlane-xyz/sdk';
import { isValidMultiCollateralToken } from '../tokens/utils';
import { multiCollateralTokenLimits } from './const';

function getMultiCollateralTokenLimit(originToken: Token, destinationToken: IToken) {
  const isMultiCollateralToken = isValidMultiCollateralToken(originToken, destinationToken);

  if (!isMultiCollateralToken) return null;

  const limitExists = multiCollateralTokenLimits.find((limit) => {
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
  originToken: Token,
  destinationToken: IToken,
  amount: string,
): bigint | null {
  const limitExists = getMultiCollateralTokenLimit(originToken, destinationToken);

  if (!limitExists) return null;

  return BigInt(amount) > limitExists.amount ? limitExists.amount : null;
}
