import { IToken, Token, TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
import { objKeys } from '@hyperlane-xyz/utils';
import { chainsRentEstimate } from '../../consts/chains';
import { logger } from '../../utils/logger';
import { getTokensWithSameCollateralAddresses, isValidMultiCollateralToken } from '../tokens/utils';

// Compare two bigint balances in descending order (highest first)
function compareByBalanceDesc(a: bigint, b: bigint): number {
  if (a > b) return -1;
  if (a < b) return 1;
  return 0;
}

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
  amountWei: string,
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
    'Multiple multi-collateral tokens found for same collateral address, retrieving routes with collateral balance...',
  );

  // fetch each destination token balance
  const balanceResults = await Promise.allSettled(
    tokensWithSameCollateralAddresses.map(async ({ originToken, destinationToken }) => {
      try {
        const balance = await warpCore.getTokenCollateral(destinationToken);
        return { originToken, destinationToken, balance };
      } catch {
        return null;
      }
    }),
  );

  const amountWeiBigInt = BigInt(amountWei);
  const tokenBalances: Array<{ originToken: Token; destinationToken: Token; balance: bigint }> = [];
  // filter tokens that have lower collateral in destination than the amount
  for (const result of balanceResults) {
    if (
      result.status === 'fulfilled' &&
      result.value?.balance &&
      result.value.balance >= amountWeiBigInt
    ) {
      tokenBalances.push(result.value);
    }
  }
  if (!tokenBalances.length) return originToken;

  // sort by descending balance (highest to lowest)
  tokenBalances.sort((a, b) => compareByBalanceDesc(a.balance, b.balance));

  logger.debug('Retrieving fees for multi-collateral routes...');
  // fetch each route fees
  const feeResults = await Promise.allSettled(
    tokenBalances.map(async ({ originToken, destinationToken, balance }) => {
      try {
        const originTokenAmount = new TokenAmount(amountWei, originToken);
        const fees = await warpCore.getInterchainTransferFee({
          originTokenAmount,
          destination: destinationToken.chainName,
          recipient,
          sender,
        });
        return { token: originToken, fees, tokenBalance: balance };
      } catch {
        return null;
      }
    }),
  );

  const tokenFees: Array<{ token: Token; tokenFee?: TokenAmount; tokenBalance: bigint }> = [];
  for (const result of feeResults) {
    if (result.status === 'fulfilled' && result.value) {
      const { fees, token, tokenBalance } = result.value;
      tokenFees.push({ token, tokenFee: fees.tokenFeeQuote, tokenBalance });
    }
  }
  // if no token was found with fees, just return the first token with enough collateral
  if (!tokenFees.length) return tokenBalances[0].originToken;

  // sort by token fees, no fees routes take precedence, then lowest fee to highest
  // use tokenBalance as tie breaker (higher balance preferred)
  tokenFees.sort((a, b) => {
    const aFee = a.tokenFee?.amount;
    const bFee = b.tokenFee?.amount;

    if (aFee === undefined && bFee !== undefined) return -1;
    if (aFee !== undefined && bFee === undefined) return 1;
    if (aFee === undefined && bFee === undefined) return compareByBalanceDesc(a.tokenBalance, b.tokenBalance);

    if (aFee! < bFee!) return -1;
    if (aFee! > bFee!) return 1;
    return compareByBalanceDesc(a.tokenBalance, b.tokenBalance);
  });

  logger.debug('Found route with lower fee, switching route...');
  return tokenFees[0].token;
}
