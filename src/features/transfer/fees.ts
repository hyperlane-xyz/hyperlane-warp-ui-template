import { IToken, Token, TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
import { objKeys } from '@hyperlane-xyz/utils';
import { chainsRentEstimate } from '../../consts/chains';
import { logger } from '../../utils/logger';
import { getPromisesFulfilledValues } from '../../utils/promises';
import {
  DefaultMultiCollateralRoutes,
  TokensWithDestinationBalance,
  TokenWithFee,
} from '../tokens/types';
import {
  getTokensWithSameCollateralAddresses,
  isValidMultiCollateralToken,
  tryGetDefaultOriginToken,
} from '../tokens/utils';

// Compare two objects with balance field in descending order (highest first)
export function compareByBalanceDesc(a: { balance: bigint }, b: { balance: bigint }) {
  if (a.balance > b.balance) return -1;
  if (a.balance < b.balance) return 1;
  return 0;
}

// Filter tokens by minimum balance and sort by descending balance
export function filterAndSortTokensByBalance(
  tokens: TokensWithDestinationBalance[],
  minAmount: bigint,
): TokensWithDestinationBalance[] {
  return tokens.filter((t) => t.balance >= minAmount).sort(compareByBalanceDesc);
}

// Sort tokens by fee (no fee first, then lowest fee), using balance as tiebreaker
export function sortTokensByFee(tokenFees: TokenWithFee[]): TokenWithFee[] {
  return [...tokenFees].sort((a, b) => {
    const aFee = a.tokenFee?.amount;
    const bFee = b.tokenFee?.amount;

    if (aFee === undefined && bFee !== undefined) return -1;
    if (aFee !== undefined && bFee === undefined) return 1;
    if (aFee === undefined && bFee === undefined) return compareByBalanceDesc(a, b);

    if (aFee! < bFee!) return -1;
    if (aFee! > bFee!) return 1;
    return compareByBalanceDesc(a, b);
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

// Checks if a token is a multi-collateral token and returns:
// 1. The default token if configured in defaultMultiCollateralRoutes (bypasses fee lookup)
// 2. Otherwise, the token with the lowest fee from tokens with same collateral
export async function getTransferToken(
  warpCore: WarpCore,
  originToken: Token,
  destinationToken: IToken,
  amountWei: string,
  recipient: string,
  sender: string | undefined,
  defaultMultiCollateralRoutes?: DefaultMultiCollateralRoutes,
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

  // Check for default multi-collateral route first (bypasses fee lookup)
  const defaultToken = tryGetDefaultOriginToken(
    originToken,
    destinationToken,
    defaultMultiCollateralRoutes,
    tokensWithSameCollateralAddresses,
  );
  if (defaultToken) {
    logger.debug('Using default multi-collateral route');
    return defaultToken;
  }

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

  const validBalanceResults = getPromisesFulfilledValues(balanceResults);

  const tokenBalances = filterAndSortTokensByBalance(validBalanceResults, BigInt(amountWei));
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
        return { token: originToken, fees, balance };
      } catch {
        return null;
      }
    }),
  );

  const tokenFees = getPromisesFulfilledValues(feeResults).map(({ token, fees, balance }) => ({
    token,
    tokenFee: fees.tokenFeeQuote,
    balance,
  }));
  // if no token was found with fees, just return the first token with enough collateral
  if (!tokenFees.length) return tokenBalances[0].originToken;

  const sortedTokensByFees = sortTokensByFee(tokenFees);

  logger.debug('Found route with lower fee, switching route...');
  return sortedTokensByFees[0].token;
}
