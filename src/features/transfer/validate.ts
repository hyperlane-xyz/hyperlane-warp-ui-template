import { Token, TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
import {
  KnownProtocolType,
  errorToString,
  fromWei,
  isNullish,
  normalizeAddress,
  toWei,
} from '@hyperlane-xyz/utils';
import { getAccountAddressAndPubKey } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { type AccountInfo } from '@hyperlane-xyz/widgets/walletIntegrations/types';

import { defaultMultiCollateralRoutes } from '../../consts/defaultMultiCollateralRoutes';
import { logger } from '../../utils/logger';
import { isMultiCollateralLimitExceeded } from '../limits/utils';
import { getTokenByKeyFromMap } from '../tokens/hooks';
import { checkTokenHasRoute, findConnectedDestinationToken } from '../tokens/utils';
import { getTransferToken } from './fees';
import { TransferFormValues } from './types';

const insufficientFundsErrMsg = /insufficient.(funds|lamports)/i;
const emptyAccountErrMsg = /AccountNotFound/i;

export async function validateBridgeTransferForm(
  warpCore: WarpCore,
  tokenMap: Map<string, Token>,
  collateralGroups: Map<string, Token[]>,
  values: TransferFormValues,
  accounts: Record<KnownProtocolType, AccountInfo>,
  routerAddressesByChainMap: Record<ChainName, Set<string>>,
): Promise<[Record<string, string> | null, Token | null]> {
  // returns a tuple, where first value is validation result
  // and second value is token override
  try {
    const { originTokenKey, destinationTokenKey, amount, recipient: formRecipient } = values;

    // Look up tokens from the pre-computed map
    const token = getTokenByKeyFromMap(tokenMap, originTokenKey);
    const destinationToken = getTokenByKeyFromMap(tokenMap, destinationTokenKey);

    if (!amount) return [{ amount: 'Invalid amount' }, null];
    if (!token) return [{ originTokenKey: 'Origin token is required' }, null];
    if (!destinationToken) return [{ destinationTokenKey: 'Destination token is required' }, null];

    // Use form recipient if set, otherwise fallback to connected wallet for destination chain
    const { address: connectedDestAddress } = getAccountAddressAndPubKey(
      warpCore.multiProvider,
      destinationToken.chainName,
      accounts,
    );
    const recipient = formRecipient || connectedDestAddress || '';

    if (!recipient) return [{ amount: 'Invalid recipient' }, null];

    // Early route check using collateral groups - validates origin token can reach destination token
    if (!checkTokenHasRoute(token, destinationToken, collateralGroups)) {
      return [{ destinationTokenKey: 'Route is not supported' }, null];
    }

    const destination = destinationToken.chainName;

    if (routerAddressesByChainMap[destination]?.has(normalizeAddress(recipient))) {
      return [{ recipient: 'Warp Route address is not valid as recipient' }, null];
    }

    const { address: sender, publicKey: senderPubKey } = getAccountAddressAndPubKey(
      warpCore.multiProvider,
      token.chainName,
      accounts,
    );

    const amountWei = toWei(amount, token.decimals);
    const transferToken = await getTransferToken(
      warpCore,
      token,
      destinationToken,
      amountWei,
      recipient,
      sender,
      defaultMultiCollateralRoutes,
    );

    // This should not happen since we already checked the route above, but keep as safety check
    const connectedDestinationToken = findConnectedDestinationToken(
      transferToken,
      destinationToken,
    );
    if (!connectedDestinationToken) {
      return [{ destinationTokenKey: 'Route is not supported' }, null];
    }

    const multiCollateralLimit = isMultiCollateralLimitExceeded(
      token,
      connectedDestinationToken,
      amountWei,
    );

    if (multiCollateralLimit) {
      return [
        {
          amount: `Transfer limit is ${fromWei(multiCollateralLimit.toString(), token.decimals)} ${token.symbol}`,
        },
        null,
      ];
    }

    const originTokenAmount = transferToken.amount(amountWei);

    // Don't fetch a Predicate attestation here — that doubles API spend on every debounced
    // form change. Gas simulation inside validateTransfer may fail without one, so we catch
    // and swallow simulation errors only for Predicate routes; balance/collateral/recipient
    // checks have already run by the time gas sim is reached.
    let result;
    try {
      result = await warpCore.validateTransfer({
        originTokenAmount,
        destination,
        recipient,
        sender: sender || '',
        senderPubKey: await senderPubKey,
        destinationToken: connectedDestinationToken,
      });
    } catch (error) {
      const isPredicateRoute = await warpCore.isPredicateSupported(transferToken, destination);
      if (!isPredicateRoute) throw error;
      // Only swallow EVM execution reverts (predicate wrapper rejecting without attestation).
      // Rethrow provider/RPC/network errors so they surface rather than silently
      // appearing as "validation passed" and failing at submit-time.
      const causeCode = (error as any)?.cause?.code;
      if (causeCode !== 'CALL_EXCEPTION' && causeCode !== 'UNPREDICTABLE_GAS_LIMIT') throw error;
      result = null;
    }

    if (!isNullish(result)) {
      const enriched = await enrichBalanceError(
        warpCore,
        result,
        originTokenAmount,
        destination,
        sender || '',
        recipient,
        connectedDestinationToken,
      );
      return [enriched, null];
    }

    if (transferToken.addressOrDenom === token.addressOrDenom) return [null, null];

    return [null, transferToken];
  } catch (error: any) {
    logger.error('Error validating form', error);
    let errorMsg = errorToString(error, 40);
    const fullError = `${errorMsg} ${error.message}`;
    if (insufficientFundsErrMsg.test(fullError) || emptyAccountErrMsg.test(fullError)) {
      const originToken = getTokenByKeyFromMap(tokenMap, values.originTokenKey);
      const chainMetadata = originToken
        ? warpCore.multiProvider.tryGetChainMetadata(originToken.chainName)
        : null;
      const symbol = chainMetadata?.nativeToken?.symbol || 'funds';
      errorMsg = `Insufficient ${symbol} for gas fees`;
    }
    return [{ form: errorMsg }, null];
  }
}

const igpErrorPattern = /^Insufficient (\S+) for interchain gas$/;

async function enrichBalanceError(
  warpCore: WarpCore,
  result: Record<string, string>,
  originTokenAmount: TokenAmount<Token>,
  destination: string,
  sender: string,
  recipient: string,
  destinationToken: Token,
): Promise<Record<string, string>> {
  if (!result.amount) return result;
  const igpErrorMatch = igpErrorPattern.exec(result.amount);
  if (!igpErrorMatch) return result;

  try {
    const { igpQuote } = await warpCore.getInterchainTransferFee({
      originTokenAmount,
      destination,
      sender,
      recipient,
      destinationToken,
    });

    // Symbol in validateTransfer message is sourced from igpQuote.token.symbol.
    if (igpErrorMatch[1] !== igpQuote.token.symbol) return result;

    const balance = originTokenAmount.token.isFungibleWith(igpQuote.token)
      ? await originTokenAmount.token.getBalance(warpCore.multiProvider, sender)
      : await igpQuote.token.getBalance(warpCore.multiProvider, sender);
    const deficit = igpQuote.amount - balance.amount;
    if (deficit > 0n) {
      const deficitAmount = new TokenAmount(deficit, igpQuote.token);
      return {
        ...result,
        amount: `Insufficient ${igpQuote.token.symbol} for interchain gas (need ${deficitAmount.getDecimalFormattedAmount().toFixed(4)} more ${igpQuote.token.symbol})`,
      };
    }
  } catch (e) {
    logger.warn('Failed to enrich balance error', e);
  }
  return result;
}
