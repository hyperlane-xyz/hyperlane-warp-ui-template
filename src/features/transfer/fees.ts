import { IToken, Token, TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
import { objKeys } from '@hyperlane-xyz/utils';
import { chainsRentEstimate } from '../../consts/chains';
import { logger } from '../../utils/logger';
import { getTokensWithSameCollateralAddresses, isValidMultiCollateralToken } from '../tokens/utils';

// get the total amount combined of all the fees
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
// the one with the lowest fee
export async function getLowestFeeTransferToken(
  warpCore: WarpCore,
  originToken: Token,
  destinationToken: IToken,
  amounWei: string,
  recipient: string,
  sender: string | undefined,
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
    'Multiple multi-collateral tokens found for same collateral address, retrieving fees...',
  );
  const tokenFees: Array<{ token: Token; tokenFee?: TokenAmount }> = [];

  // fetch each route fees
  const feeResults = await Promise.allSettled(
    tokensWithSameCollateralAddresses.map(async ({ originToken, destinationToken }) => {
      try {
        const originTokenAmount = new TokenAmount(amounWei, originToken);
        const fees = await warpCore.getInterchainTransferFee({
          originTokenAmount,
          destination: destinationToken.chainName,
          recipient,
          sender,
        });
        return { token: originToken, fees };
      } catch {
        return null;
      }
    }),
  );

  for (const result of feeResults) {
    if (result.status === 'fulfilled' && result.value) {
      tokenFees.push({ token: result.value.token, tokenFee: result.value.fees.tokenFeeQuote });
    }
  }

  if (!tokenFees.length) return originToken;

  // sort by token fees, no fees routes take precedence, then lowest fee to highest
  tokenFees.sort((a, b) => {
    const aFee = a.tokenFee?.amount;
    const bFee = b.tokenFee?.amount;

    if (aFee === undefined && bFee !== undefined) return -1;
    if (aFee !== undefined && bFee === undefined) return 1;
    if (aFee === undefined && bFee === undefined) return 0;

    if (aFee! < bFee!) return -1;
    if (aFee! > bFee!) return 1;
    return 0;
  });

  logger.debug('Found route with lower fee, switching route...');
  return tokenFees[0].token;
}
