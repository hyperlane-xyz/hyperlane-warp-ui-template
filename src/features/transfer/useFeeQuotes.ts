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
  { origin, destination, tokenIndex }: Partial<TransferFormValues>,
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

  return { isLoading, isError, fees: data };
}

// TODO move logic to WarpCore
export async function fetchFeeQuotes({
  destination,
  tokenIndex,
  sender,
}: {
  destination?: ChainName;
  tokenIndex?: number;
  sender?: Address;
}): Promise<{ interchainQuote: TokenAmount; localQuote?: TokenAmount } | null> {
  const originToken = getTokenByIndex(tokenIndex);
  if (!destination || !sender || !originToken) return null;
  logger.debug('Fetching fee quotes');

  const warpCore = getWarpCore();
  const multiProvider = warpCore.multiProvider;
  const originMetadata = multiProvider.getChainMetadata(originToken.chainName);
  const destinationMetadata = multiProvider.getChainMetadata(destination);

  // First, get interchain gas quote (aka IGP quote)
  const interchainQuote = await warpCore.getTransferRemoteGasQuote(originToken, destination);

  // If there's no native token, we can't represent local gas so stop here
  if (!originMetadata.nativeToken) return { interchainQuote };

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
  if (txs.length === 1) {
    const gasFee = await multiProvider.estimateTransactionFee(originMetadata.name, txs[0], sender);
    localQuote = localGasToken.amount(gasFee.fee);
  } else if (txs.length === 2 && originToken.protocol === ProtocolType.Ethereum) {
    // For ethereum txs that require >1 tx, we assume the first is an approval
    // We use a hard-coded const as an estimate for the transferRemote gas
    const provider = multiProvider.getEthersV5Provider(originMetadata.name);
    const gasPrice = BigInt((await provider.getGasPrice()).toString());
    localQuote = localGasToken.amount(EVM_TRANSFER_REMOTE_GAS_ESTIMATE * gasPrice);
  } else {
    throw new Error('Cannot estimate local gas for multiple transactions');
  }

  return {
    interchainQuote,
    localQuote,
  };
}
