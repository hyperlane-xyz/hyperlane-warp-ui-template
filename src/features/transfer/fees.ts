import { IToken, TokenAmount } from '@hyperlane-xyz/sdk';
import { objKeys } from '@hyperlane-xyz/utils';
import { chainsRentEstimate } from '../../consts/chains';

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

    // Check if this token is fungible with any existing fee group
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
