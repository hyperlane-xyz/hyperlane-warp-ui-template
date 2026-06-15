import type { IToken, Token, TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';

import { defaultMultiCollateralRoutes } from '../../consts/defaultMultiCollateralRoutes';
import { findConnectedDestinationToken } from '../tokens/utils';
import { getTransferToken } from '../transfer/fees';

interface ExactInputBridgeQuote {
  transferAmount: TokenAmount<Token>;
  interchainQuote: TokenAmount<IToken>;
  tokenFeeQuote?: TokenAmount<IToken>;
}

export interface ExactInputBridgeTransferQuote extends ExactInputBridgeQuote {
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

  return { ...quote, routeToken, connectedDestinationToken };
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
    if (nextTransferAmount === transferAmount) break;
    transferAmount = nextTransferAmount;
  }

  if (!interchainQuote) {
    throw new Error('Unable to quote bridge fees');
  }

  return {
    transferAmount: originToken.amount(transferAmount),
    interchainQuote,
    tokenFeeQuote,
  };
}
