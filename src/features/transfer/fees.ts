import { IToken, Token, TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
import { objKeys } from '@hyperlane-xyz/utils';
import { chainsRentEstimate } from '../../consts/chains';
import { logger } from '../../utils/logger';
import { TokensWithDestinationBalance, TokenWithFee } from '../tokens/types';
import { getTokensWithSameCollateralAddresses, isValidMultiCollateralToken } from '../tokens/utils';

// Compare two bigint balances in descending order (highest first)
export function compareByBalanceDesc(a: bigint, b: bigint): number {
  if (a > b) return -1;
  if (a < b) return 1;
  return 0;
}

// Filter tokens that have sufficient collateral balance and sort by descending balance
export function filterAndSortTokensByBalance(
  balanceResults: PromiseSettledResult<TokensWithDestinationBalance | null>[],
  minAmount: bigint,
): TokensWithDestinationBalance[] {
  const tokenBalances: TokensWithDestinationBalance[] = [];

  for (const result of balanceResults) {
    if (
      result.status === 'fulfilled' &&
      result.value?.balance &&
      result.value.balance >= minAmount
    ) {
      tokenBalances.push(result.value);
    }
  }

  // sort by descending balance (highest to lowest)
  tokenBalances.sort((a, b) => compareByBalanceDesc(a.balance, b.balance));

  return tokenBalances;
}

// Sort tokens by fee (no fee first, then lowest fee), using balance as tiebreaker
export function sortTokensByFee(tokenFees: TokenWithFee[]): TokenWithFee[] {
  return [...tokenFees].sort((a, b) => {
    const aFee = a.tokenFee?.amount;
    const bFee = b.tokenFee?.amount;

    if (aFee === undefined && bFee !== undefined) return -1;
    if (aFee !== undefined && bFee === undefined) return 1;
    if (aFee === undefined && bFee === undefined)
      return compareByBalanceDesc(a.tokenBalance, b.tokenBalance);

    if (aFee! < bFee!) return -1;
    if (aFee! > bFee!) return 1;
    return compareByBalanceDesc(a.tokenBalance, b.tokenBalance);
  });
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

  const tokenBalances = filterAndSortTokensByBalance(balanceResults, BigInt(amountWei));
  if (!tokenBalances.length) return originToken;

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

  const tokenFees: TokenWithFee[] = [];
  for (const result of feeResults) {
    if (result.status === 'fulfilled' && result.value) {
      const { fees, token, tokenBalance } = result.value;
      tokenFees.push({ token, tokenFee: fees.tokenFeeQuote, tokenBalance });
    }
  }
  // if no token was found with fees, just return the first token with enough collateral
  if (!tokenFees.length) return tokenBalances[0].originToken;

  const sortedTokensByFees = sortTokensByFee(tokenFees);

  logger.debug('Found route with lower fee, switching route...');
  return sortedTokensByFees[0].token;
}
