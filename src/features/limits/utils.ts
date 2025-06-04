import { IToken, Token } from '@hyperlane-xyz/sdk';
import { isValidMultiCollateralToken } from '../tokens/utils';
import { multiCollateralTokenLimits } from './const';

function getMultiCollateralTokenLimit(originToken: Token | IToken, destination: ChainName) {
  const destinationToken = originToken.getConnectionForChain(destination)?.token;
  if (!destinationToken) return null;

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
  originToken: Token | IToken,
  destination: ChainName,
  amountWei: string,
): bigint | null {
  const limitExists = getMultiCollateralTokenLimit(originToken, destination);

  console.log('limitsExist', limitExists);
  if (!limitExists) return null;

  return BigInt(amountWei) > limitExists.amountWei ? limitExists.amountWei : null;
}
