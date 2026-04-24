import { IToken, Token, WarpCore, WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { HexString, ProtocolType, toWei } from '@hyperlane-xyz/utils';
import { useDebounce } from '@hyperlane-xyz/widgets';
import {
  getAccountAddressAndPubKey,
  useAccounts,
} from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { useQuery } from '@tanstack/react-query';

import { defaultMultiCollateralRoutes } from '../../consts/defaultMultiCollateralRoutes';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { useWarpCore } from '../tokens/hooks';
import { findConnectedDestinationToken } from '../tokens/utils';
import { getTransferToken } from './fees';
import { TransferFormValues } from './types';

const FEE_QUOTE_REFRESH_INTERVAL = 30_000; // 30s
const EVM_FEE_QUOTE_FALLBACK_ADDRESS = '0x000000000000000000000000000000000000dEaD';

export function useFeeQuotes(
  { originTokenKey, destinationTokenKey, amount, recipient: formRecipient }: TransferFormValues,
  enabled: boolean,
  originToken: Token | undefined,
  destinationToken: IToken | undefined,
  searchForLowestFee: boolean = false,
) {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();
  const debouncedAmount = useDebounce(amount, 500);
  const destination = destinationToken?.chainName;

  const { accounts } = useAccounts(multiProvider);
  const { address: sender, publicKey: senderPubKey } = getAccountAddressAndPubKey(
    multiProvider,
    originToken?.chainName,
    accounts,
  );

  const isEvmToEvmRoute =
    originToken?.protocol === ProtocolType.Ethereum &&
    destinationToken?.protocol === ProtocolType.Ethereum;
  const effectiveSender = sender || (isEvmToEvmRoute ? EVM_FEE_QUOTE_FALLBACK_ADDRESS : undefined);

  // Get effective recipient (form value or fallback to connected wallet for destination)
  const { address: connectedDestAddress } = getAccountAddressAndPubKey(
    multiProvider,
    destinationToken?.chainName,
    accounts,
  );
  const recipient =
    formRecipient ||
    connectedDestAddress ||
    (isEvmToEvmRoute ? EVM_FEE_QUOTE_FALLBACK_ADDRESS : '');

  const isFormValid = !!(
    originToken &&
    destination &&
    debouncedAmount &&
    recipient &&
    effectiveSender
  );
  const shouldFetch = enabled && isFormValid;

  const { isLoading, isError, data, isFetching } = useQuery({
    // The WarpCore class is not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: [
      'useFeeQuotes',
      originTokenKey,
      destinationTokenKey,
      effectiveSender,
      senderPubKey,
      debouncedAmount,
      recipient,
    ],
    queryFn: () =>
      fetchFeeQuotes(
        warpCore,
        originToken,
        destinationToken,
        destination,
        effectiveSender,
        senderPubKey,
        debouncedAmount,
        recipient,
        searchForLowestFee,
      ),
    enabled: shouldFetch,
    refetchInterval: FEE_QUOTE_REFRESH_INTERVAL,
  });

  return { isLoading: isLoading || isFetching, isError, fees: data };
}

export async function fetchFeeQuotes(
  warpCore: WarpCore,
  originToken: Token | undefined,
  destinationToken: IToken | undefined,
  destination?: ChainName,
  sender?: Address,
  senderPubKey?: Promise<HexString | undefined>,
  amount?: string,
  recipient?: string,
  searchForLowestFee: boolean = false,
): Promise<WarpCoreFeeEstimate | null> {
  if (!originToken || !destinationToken || !destination || !sender || !amount || !recipient)
    return null;

  let transferToken = originToken;
  const amountWei = toWei(amount, transferToken.decimals);

  // when true attempt to get route with lowest fee (or use default if configured)
  if (searchForLowestFee) {
    transferToken = await getTransferToken(
      warpCore,
      originToken,
      destinationToken,
      amountWei,
      recipient,
      sender,
      defaultMultiCollateralRoutes,
    );
  }

  const originTokenAmount = transferToken.amount(amountWei);
  const connectedDestinationToken = findConnectedDestinationToken(transferToken, destinationToken);
  if (!connectedDestinationToken) return null;
  const isEvmToEvmRoute =
    originToken.protocol === ProtocolType.Ethereum &&
    destinationToken.protocol === ProtocolType.Ethereum;
  const senderPubKeyValue = await senderPubKey;

  logger.debug('Fetching fee quotes');
  try {
    return await warpCore.estimateTransferRemoteFees({
      originTokenAmount,
      destination,
      sender,
      senderPubKey: senderPubKeyValue,
      recipient: recipient,
      destinationToken: connectedDestinationToken,
    });
  } catch (error) {
    // Connected wallets switch fee simulation from a neutral fallback sender to the user's real
    // account. Some RPC/wallet combinations intermittently fail estimateGas in that mode (e.g.
    // sender-specific state checks), which makes fees disappear in the UI.
    // Retry with the pre-connect fallback sender so fee display remains stable.
    // This only affects quote estimation; transfer submission still uses the real connected account.
    if (!isEvmToEvmRoute || sender === EVM_FEE_QUOTE_FALLBACK_ADDRESS) throw error;
    logger.warn('Fee quote failed with connected sender, retrying with fallback sender', error);
    return warpCore.estimateTransferRemoteFees({
      originTokenAmount,
      destination,
      sender: EVM_FEE_QUOTE_FALLBACK_ADDRESS,
      recipient: recipient,
      destinationToken: connectedDestinationToken,
    });
  }
}
