import { IToken, Token, TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
import { objKeys } from '@hyperlane-xyz/utils';
import { chainsRentEstimate } from '../../consts/chains';
import { logger } from '../../utils/logger';
import { getTokensWithSameCollateralAddresses, isValidMultiCollateralToken } from '../tokens/utils';

export function getTotalFee({
  interchainQuote,
  localQuote,
  tokenFeeQuote,
}: {
  interchainQuote: TokenAmount;
  localQuote: TokenAmount;
  tokenFeeQuote?: TokenAmount;
}) {
  const feeGroups: TokenAmount[] = [];
  const tokenAmounts = [interchainQuote, localQuote];

  if (tokenFeeQuote) {
    tokenAmounts.push(tokenFeeQuote);
  }

  for (const tokenAmount of tokenAmounts) {
    let foundFungibleGroup = false;

    // Check if the current tokenAmount is fungible (same asset) as any token
    // in the feeGroups array, if so add the amount to that asset group
    for (let i = 0; i < feeGroups.length; i++) {
      if (tokenAmount.token.isFungibleWith(feeGroups[i].token)) {
        feeGroups[i] = feeGroups[i].plus(tokenAmount.amount);
        foundFungibleGroup = true;
        break;
      }
    }

    // If no fungible group found, create a new one
    if (!foundFungibleGroup) {
      feeGroups.push(new TokenAmount(tokenAmount.amount, tokenAmount.token));
    }
  }

  return feeGroups;
}

export function getInterchainQuote(
  originToken: IToken | undefined,
  interchainQuote: TokenAmount | undefined,
) {
  if (!interchainQuote) return undefined;

  return originToken && objKeys(chainsRentEstimate).includes(originToken.chainName)
    ? interchainQuote.plus(chainsRentEstimate[originToken.chainName])
    : interchainQuote;
}

// Checks if a token is a multi-collateral token and if so
// look for other tokens that are the same and returns
// the one with the highest collateral in the destination
export async function getTransferToken(
  warpCore: WarpCore,
  originToken: Token,
  destinationToken: IToken,
) {
  if (!isValidMultiCollateralToken(originToken, destinationToken)) return originToken;

  const tokensWithSameCollateralAddresses = getTokensWithSameCollateralAddresses(
    warpCore,
    originToken,
    destinationToken,
  );

  // if only one token exists then just return that one
  if (tokensWithSameCollateralAddresses.length <= 1) return originToken;

  logger.debug(
    'Multiple multi-collateral tokens found for same collateral address, retrieving balances...',
  );
  const tokenBalances: Array<{ token: Token; balance: bigint }> = [];

  // fetch each destination token balance
  const balanceResults = await Promise.allSettled(
    tokensWithSameCollateralAddresses.map(async ({ originToken, destinationToken }) => {
      try {
        const balance = await warpCore.getTokenCollateral(destinationToken);
        return { token: originToken, balance };
      } catch {
        return null;
      }
    }),
  );

  for (const result of balanceResults) {
    if (result.status === 'fulfilled' && result.value) {
      tokenBalances.push(result.value);
    }
  }

  if (!tokenBalances.length) return originToken;

  // sort by balance to return the highest one
  tokenBalances.sort((a, b) => {
    if (a.balance > b.balance) return -1;
    else if (a.balance < b.balance) return 1;
    else return 0;
  });

  logger.debug('Found route with higher collateral in destination, switching route...');
  return tokenBalances[0].token;
}
