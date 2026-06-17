import { Token, type IToken, type TokenAmount, type WarpCore } from '@hyperlane-xyz/sdk';

import { defaultMultiCollateralRoutes } from '../../consts/defaultMultiCollateralRoutes';
import { isMultiCollateralLimitExceeded } from '../limits/utils';
import { findConnectedDestinationToken } from '../tokens/utils';
import { getTransferToken } from '../transfer/fees';

interface ExactInputBridgeQuote {
  transferAmount: TokenAmount<Token>;
  interchainQuote: TokenAmount<IToken>;
  tokenFeeQuote?: TokenAmount<IToken>;
}

export interface ExactInputBridgeTransferQuote extends ExactInputBridgeQuote {
  inputAmount: bigint;
  routeToken: Token;
  connectedDestinationToken: Token;
}

export async function getExactInputBridgeTransferQuote({
  warpCore,
  originToken,
  destinationToken,
  inputAmount,
  recipient,
  sender,
}: {
  warpCore: WarpCore;
  originToken: Token;
  destinationToken: IToken;
  inputAmount: bigint;
  recipient: string;
  sender?: string;
}): Promise<ExactInputBridgeTransferQuote> {
  const routeToken = await getTransferToken(
    warpCore,
    originToken,
    destinationToken,
    inputAmount.toString(),
    recipient,
    sender,
    defaultMultiCollateralRoutes,
  );
  const connectedDestinationToken = findConnectedDestinationToken(routeToken, destinationToken);
  if (!connectedDestinationToken) throw new Error('No token connection found between chains');

  const quote = await getExactInputBridgeQuote({
    warpCore,
    originToken: routeToken,
    destinationToken: connectedDestinationToken,
    inputAmount,
    destination: connectedDestinationToken.chainName,
    recipient,
    sender,
  });

  return { ...quote, inputAmount, routeToken, connectedDestinationToken };
}

export async function getExactInputBridgeMaxAmount({
  warpCore,
  balance,
  destinationToken,
  recipient,
  sender,
  senderPubKey,
}: {
  warpCore: WarpCore;
  balance: TokenAmount<IToken>;
  destinationToken: IToken;
  recipient: string;
  sender: string;
  senderPubKey?: string;
}): Promise<TokenAmount<Token> | undefined> {
  const originToken = new Token(balance.token);
  const routeToken = await getTransferToken(
    warpCore,
    originToken,
    destinationToken,
    balance.amount.toString(),
    recipient,
    sender,
    defaultMultiCollateralRoutes,
  );
  const connectedDestinationToken = findConnectedDestinationToken(routeToken, destinationToken);
  if (!connectedDestinationToken) return undefined;

  const routeBalance = routeToken.amount(balance.amount);
  let maxTransferAmount = await warpCore.getMaxTransferAmount({
    balance: routeBalance,
    destination: connectedDestinationToken.chainName,
    recipient,
    sender,
    senderPubKey,
    destinationToken: connectedDestinationToken,
  });

  const multiCollateralLimit = isMultiCollateralLimitExceeded(
    maxTransferAmount.token,
    connectedDestinationToken,
    maxTransferAmount.amount.toString(),
  );
  if (multiCollateralLimit) {
    maxTransferAmount = maxTransferAmount.token.amount(multiCollateralLimit);
  }

  const { igpQuote, tokenFeeQuote } = await warpCore.getInterchainTransferFee({
    originTokenAmount: routeToken.amount(maxTransferAmount.amount),
    destination: connectedDestinationToken.chainName,
    recipient,
    sender,
    destinationToken: connectedDestinationToken,
  });
  const sameTokenFees =
    (routeToken.isFungibleWith(igpQuote.token) ? igpQuote.amount : 0n) +
    (routeToken.isFungibleWith(tokenFeeQuote?.token) ? (tokenFeeQuote?.amount ?? 0n) : 0n);
  const inputAmount = maxTransferAmount.amount + sameTokenFees;

  return routeToken.amount(inputAmount > balance.amount ? balance.amount : inputAmount);
}

export async function getExactInputBridgeQuote({
  warpCore,
  originToken,
  destinationToken,
  inputAmount,
  destination,
  recipient,
  sender,
}: {
  warpCore: WarpCore;
  originToken: Token;
  destinationToken: IToken;
  inputAmount: bigint;
  destination: string;
  recipient: string;
  sender?: string;
}): Promise<ExactInputBridgeQuote> {
  let transferAmount = inputAmount;
  let interchainQuote: TokenAmount<IToken> | undefined;
  let tokenFeeQuote: TokenAmount<IToken> | undefined;
  let hasConverged = false;

  for (let i = 0; i < 4; i++) {
    const quote = await warpCore.getInterchainTransferFee({
      originTokenAmount: originToken.amount(transferAmount),
      destination,
      recipient,
      sender,
      destinationToken,
    });
    interchainQuote = quote.igpQuote;
    tokenFeeQuote = quote.tokenFeeQuote;

    const sameTokenFees =
      (originToken.isFungibleWith(interchainQuote.token) ? interchainQuote.amount : 0n) +
      (originToken.isFungibleWith(tokenFeeQuote?.token) ? (tokenFeeQuote?.amount ?? 0n) : 0n);
    const nextTransferAmount = inputAmount > sameTokenFees ? inputAmount - sameTokenFees : 0n;
    if (nextTransferAmount === transferAmount) {
      hasConverged = true;
      break;
    }
    transferAmount = nextTransferAmount;
  }

  if (!interchainQuote) {
    throw new Error('Unable to quote bridge fees');
  }

  if (!hasConverged) {
    const finalQuote = await warpCore.getInterchainTransferFee({
      originTokenAmount: originToken.amount(transferAmount),
      destination,
      recipient,
      sender,
      destinationToken,
    });
    interchainQuote = finalQuote.igpQuote;
    tokenFeeQuote = finalQuote.tokenFeeQuote;
  }

  return {
    transferAmount: originToken.amount(transferAmount),
    interchainQuote,
    tokenFeeQuote,
  };
}
