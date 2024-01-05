import BigNumber from 'bignumber.js';
import { toast } from 'react-toastify';

import {
  ProtocolType,
  isValidAddress,
  isZeroishAddress,
  toWei,
  tryParseAmount,
} from '@hyperlane-xyz/utils';

import { toastIgpDetails } from '../../components/toast/IgpDetailsToast';
import { config } from '../../consts/config';
import { logger } from '../../utils/logger';
import { getProtocolType } from '../caip/chains';
import { isNonFungibleToken, parseCaip19Id } from '../caip/tokens';
import { getChainMetadata } from '../multiProvider';
import { AppState } from '../store';
import { AdapterFactory } from '../tokens/AdapterFactory';
import { getToken } from '../tokens/metadata';
import { Route, RoutesMap } from '../tokens/routes/types';
import { getTokenRoute, isIbcOnlyRoute } from '../tokens/routes/utils';
import { getAccountAddressForChain } from '../wallet/hooks/multiProtocol';
import { AccountInfo } from '../wallet/hooks/types';

import { IgpQuote, IgpTokenType, TransferFormValues } from './types';

type FormError = Partial<Record<keyof TransferFormValues, string>>;
type Balances = AppState['balances'];

export async function validateFormValues(
  values: TransferFormValues,
  tokenRoutes: RoutesMap,
  balances: Balances,
  igpQuote: IgpQuote | null,
  accounts: Record<ProtocolType, AccountInfo>,
): Promise<FormError> {
  const { originCaip2Id, destinationCaip2Id, amount, tokenCaip19Id, recipientAddress } = values;
  const route = getTokenRoute(originCaip2Id, destinationCaip2Id, tokenCaip19Id, tokenRoutes);
  if (!route) return { destinationCaip2Id: 'No route found for chains/token' };

  const chainError = validateChains(originCaip2Id, destinationCaip2Id);
  if (chainError) return chainError;

  const tokenError = validateToken(tokenCaip19Id);
  if (tokenError) return tokenError;

  const recipientError = validateRecipient(recipientAddress, destinationCaip2Id);
  if (recipientError) return recipientError;

  const isNft = isNonFungibleToken(tokenCaip19Id);

  const { error: amountError, parsedAmount } = validateAmount(amount, isNft);
  if (amountError) return amountError;

  if (isNft) {
    const balancesError = validateNftBalances(balances, parsedAmount.toString());
    if (balancesError) return balancesError;
  } else {
    const balancesError = await validateTokenBalances({
      balances,
      parsedAmount,
      route,
      igpQuote,
      accounts,
    });
    if (balancesError) return balancesError;
  }

  return {};
}

function validateChains(
  originCaip2Id: ChainCaip2Id,
  destinationCaip2Id: ChainCaip2Id,
): FormError | null {
  if (!originCaip2Id) return { originCaip2Id: 'Invalid origin chain' };
  if (!destinationCaip2Id) return { destinationCaip2Id: 'Invalid destination chain' };
  if (
    config.withdrawalWhitelist &&
    !config.withdrawalWhitelist.split(',').includes(destinationCaip2Id)
  ) {
    return { destinationCaip2Id: 'Bridge is in deposit-only mode' };
  }
  if (
    config.transferBlacklist &&
    config.transferBlacklist.split(',').includes(`${originCaip2Id}-${destinationCaip2Id}`)
  ) {
    return { destinationCaip2Id: 'Route is not currently allowed' };
  }
  return null;
}

function validateToken(tokenCaip19Id: TokenCaip19Id): FormError | null {
  if (!tokenCaip19Id) return { tokenCaip19Id: 'Token required' };
  const { address: tokenAddress } = parseCaip19Id(tokenCaip19Id);
  const tokenMetadata = getToken(tokenCaip19Id);
  if (!tokenMetadata || (!isZeroishAddress(tokenAddress) && !isValidAddress(tokenAddress))) {
    return { tokenCaip19Id: 'Invalid token' };
  }
  return null;
}

function validateRecipient(
  recipientAddress: Address,
  destinationCaip2Id: ChainCaip2Id,
): FormError | null {
  const destProtocol = getProtocolType(destinationCaip2Id);
  // Ensure recip address is valid for the destination chain's protocol
  if (!isValidAddress(recipientAddress, destProtocol))
    return { recipientAddress: 'Invalid recipient' };
  // Also ensure the address denom is correct if the dest protocol is Cosmos
  if (destProtocol === ProtocolType.Cosmos) {
    const destChainPrefix = getChainMetadata(destinationCaip2Id).bech32Prefix;
    if (!destChainPrefix) {
      toast.error(`No bech32 prefix found for chain ${destinationCaip2Id}`);
      return { destinationCaip2Id: 'Invalid chain data' };
    } else if (!recipientAddress.startsWith(destChainPrefix)) {
      toast.error(`Recipient address prefix should be ${destChainPrefix}`);
      return { recipientAddress: `Invalid recipient prefix` };
    }
  }
  return null;
}

function validateAmount(
  amount: string,
  isNft: boolean,
): { parsedAmount: BigNumber; error: FormError | null } {
  const parsedAmount = tryParseAmount(amount);
  if (!parsedAmount || parsedAmount.lte(0)) {
    return {
      parsedAmount: BigNumber(0),
      error: { amount: isNft ? 'Invalid Token Id' : 'Invalid amount' },
    };
  }
  return { parsedAmount, error: null };
}

// Validate balances for ERC721-like tokens
function validateNftBalances(balances: Balances, nftId: string | number): FormError | null {
  const { isSenderNftOwner, senderNftIds } = balances;
  if (isSenderNftOwner === false || (senderNftIds && !senderNftIds.includes(nftId.toString()))) {
    return { amount: 'Token ID not owned' };
  }
  return null;
}

// Validate balances for ERC20-like tokens
async function validateTokenBalances({
  balances,
  parsedAmount,
  route,
  igpQuote,
  accounts,
}: {
  balances: Balances;
  parsedAmount: BigNumber;
  route: Route;
  igpQuote: IgpQuote | null;
  accounts: Record<ProtocolType, AccountInfo>;
}): Promise<FormError | null> {
  const sendValue = new BigNumber(toWei(parsedAmount, route.originDecimals));

  // First check basic token balance
  if (sendValue.gt(balances.senderTokenBalance)) return { amount: 'Insufficient balance' };

  // Next, ensure balances can cover IGP fees
  // But not for pure IBC routes because IGP is not used
  if (isIbcOnlyRoute(route)) return null;

  if (!igpQuote?.weiAmount) return { amount: 'Interchain gas quote not ready' };
  const { type: igpTokenType, amount: igpAmount, weiAmount: igpWeiAmount } = igpQuote;
  const { symbol: igpTokenSymbol, tokenCaip19Id: igpTokenCaip19Id } = igpQuote.token;

  let igpTokenBalance: string;
  if ([IgpTokenType.NativeCombined, IgpTokenType.NativeSeparate].includes(igpTokenType)) {
    igpTokenBalance = balances.senderNativeBalance;
  } else if (igpTokenType === IgpTokenType.TokenCombined) {
    igpTokenBalance = balances.senderTokenBalance;
  } else if (igpTokenType === IgpTokenType.TokenSeparate) {
    igpTokenBalance = await fetchSenderTokenBalance(
      accounts,
      route.originCaip2Id,
      igpTokenCaip19Id,
    );
  } else {
    return { amount: 'Interchain gas quote not valid' };
  }

  const requiredIgpTokenBalance = [
    IgpTokenType.NativeCombined,
    IgpTokenType.TokenCombined,
  ].includes(igpTokenType)
    ? sendValue.plus(igpWeiAmount)
    : BigNumber(igpWeiAmount);

  if (requiredIgpTokenBalance.gt(igpTokenBalance)) {
    toastIgpDetails(igpAmount, igpTokenSymbol);
    return { amount: `Insufficient ${igpTokenSymbol} for gas` };
  }

  return null;
}

async function fetchSenderTokenBalance(
  accounts: Record<ProtocolType, AccountInfo>,
  originCaip2Id: ChainCaip2Id,
  igpTokenCaip19Id: TokenCaip19Id,
) {
  try {
    const account = accounts[getProtocolType(originCaip2Id)];
    const sender = getAccountAddressForChain(originCaip2Id, account);
    if (!sender) throw new Error('No sender address found');
    const adapter = AdapterFactory.TokenAdapterFromAddress(igpTokenCaip19Id);
    const igpTokenBalance = await adapter.getBalance(sender);
    return igpTokenBalance;
  } catch (error) {
    logger.error('Error fetching token balance during form validation', error);
    toast.error('Error fetching balance for validation');
    throw error;
  }
}
