import { useQuery } from '@tanstack/react-query';

import { Token, TokenAmount } from '@hyperlane-xyz/sdk';
import { ProtocolType, convertToProtocolAddress } from '@hyperlane-xyz/utils';

import { useToastError } from '../../components/toast/useToastError';
import { EVM_TRANSFER_REMOTE_GAS_ESTIMATE } from '../../consts/values';
import { getTokenByIndex, getWarpCore } from '../../context/context';
import { logger } from '../../utils/logger';
import { useAccountAddressForChain } from '../wallet/hooks/multiProtocol';

import { TransferFormValues } from './types';

const FEE_QUOTE_REFRESH_INTERVAL = 10_000; // 10s

export function useFeeQuotes(
  { origin, destination, tokenIndex }: TransferFormValues,
  enabled: boolean,
) {
  const sender = useAccountAddressForChain(origin);
  const { isLoading, isError, error, data } = useQuery({
    queryKey: ['useFeeQuotes', destination, tokenIndex, sender],
    queryFn: () => fetchFeeQuotes({ destination, tokenIndex, sender }),
    enabled,
    refetchInterval: FEE_QUOTE_REFRESH_INTERVAL,
  });

  useToastError(error, 'Error fetching fee quotes');

  return { isLoading, isError, igpQuote: data };
}

export async function fetchFeeQuotes({
  destination,
  tokenIndex,
  sender,
}: {
  destination: ChainName;
  tokenIndex?: number;
  sender?: Address;
}): Promise<{ interchainQuote: TokenAmount; localQuote?: TokenAmount } | null> {
  try {
    const originToken = getTokenByIndex(tokenIndex);
    if (!destination || !sender || !originToken) return null;
    logger.debug('Fetching fee quotes');

    const warpCore = getWarpCore();
    const multiProvider = warpCore.multiProvider;
    const originMetadata = multiProvider.getChainMetadata(originToken.chainName);
    const originNativeToken = originMetadata.nativeToken;
    const destinationMetadata = multiProvider.getChainMetadata(destination);

    // First, get interchain gas quote (aka IGP quote)
    const interchainQuote = await warpCore.getTransferGasQuote(originToken, destination);

    // If there's no native token, we can't represent local gas so stop here
    if (!originNativeToken) return { interchainQuote };

    // Get the local gas token. This assumes the chain's native token will pay for local gas
    // This will need to be smarter if more complex scenarios on Cosmos are supported
    const localGasToken = Token.FromChainMetadataNativeToken(originMetadata);

    // Form transactions to estimate local gas with
    const recipient = convertToProtocolAddress(
      sender,
      destinationMetadata.protocol,
      destinationMetadata.bech32Prefix,
    );
    const txs = await warpCore.getTransferRemoteTxs(
      originToken.amount(1),
      destination,
      sender,
      recipient,
    );

    let localQuote: TokenAmount;
    // Cannot estimate gas for multiple transactions so fall back to hard-coded default
    if (txs.length === 1) {
      // const todo = multiProvider.getGasEstimate(txs[0]);
      // or maybe create wallet estimate wallet hooks?
      localQuote = localGasToken.amount(1n);
    } else if (originToken.protocol === ProtocolType.Ethereum) {
      // For ethereum we assume the first transaction is an approval
      // We use a hard-coded const as an estimate for the transferRemote gas
      const gasPrice = 1n; // TODO
      localQuote = localGasToken.amount(EVM_TRANSFER_REMOTE_GAS_ESTIMATE * gasPrice);
    } else {
      throw new Error('Cannot estimate local gas for multiple transactions');
    }

    return {
      interchainQuote,
      localQuote,
    };
  } catch (error) {
    logger.error('Error fetching fee quotes', error);
    return null;
  }
}
