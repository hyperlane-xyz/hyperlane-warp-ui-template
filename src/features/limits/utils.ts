import { IToken, Token } from '@hyperlane-xyz/sdk';
import { isValidMultiCollateralToken } from '../tokens/utils';
import { multiCollateralTokenLimits } from './const';

export function isMultiCollateralLimitExceeded(
  originToken: Token,
  destinationToken: IToken,
  amountWei: string,
) {
  const isMultiCollateralToken = isValidMultiCollateralToken(originToken, destinationToken);

  if (!isMultiCollateralToken) return false;

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

  if (!limitExists) return false;

  return amountWei <= limitExists.amountWei.toString();
}
