import { MultiProtocolProvider, Token, TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
<<<<<<< HEAD
import { ProtocolType } from '@hyperlane-xyz/utils';
=======
import { KnownProtocolType } from '@hyperlane-xyz/utils';
>>>>>>> origin/main
import { AccountInfo, getAccountAddressAndPubKey } from '@hyperlane-xyz/widgets';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { defaultMultiCollateralRoutes } from '../../consts/defaultMultiCollateralRoutes';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { isMultiCollateralLimitExceeded } from '../limits/utils';
import { useWarpCore } from '../tokens/hooks';
<<<<<<< HEAD
import { getLowestFeeTransferToken } from './fees';
=======
import { getTransferToken } from './fees';
>>>>>>> origin/main

interface FetchMaxParams {
  accounts: Record<KnownProtocolType, AccountInfo>;
  balance: TokenAmount;
  origin: ChainName;
  destination: ChainName;
}

export function useFetchMaxAmount() {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const mutation = useMutation({
    mutationFn: (params: FetchMaxParams) => fetchMaxAmount(multiProvider, warpCore, params),
  });

  return { fetchMaxAmount: mutation.mutateAsync, isLoading: mutation.isPending };
}

async function fetchMaxAmount(
  multiProvider: MultiProtocolProvider,
  warpCore: WarpCore,
  { accounts, balance, destination, origin }: FetchMaxParams,
) {
  try {
    const { address, publicKey } = getAccountAddressAndPubKey(multiProvider, origin, accounts);
    if (!address) return balance;
    const originToken = new Token(balance.token);
    const destinationToken = originToken.getConnectionForChain(destination)?.token;
    if (!destinationToken) return undefined;

<<<<<<< HEAD
    const transferToken = await getLowestFeeTransferToken(
=======
    const transferToken = await getTransferToken(
>>>>>>> origin/main
      warpCore,
      originToken,
      destinationToken,
      balance.amount.toString(),
      address,
      address,
<<<<<<< HEAD
=======
      defaultMultiCollateralRoutes,
>>>>>>> origin/main
    );
    const tokenAmount = new TokenAmount(balance.amount, transferToken);
    const maxAmount = await warpCore.getMaxTransferAmount({
      balance: tokenAmount,
      destination,
      sender: address,
      senderPubKey: await publicKey,
      // defaulting to address here for recipient
      recipient: address,
    });

    const multiCollateralLimit = isMultiCollateralLimitExceeded(
      maxAmount.token,
      destination,
      maxAmount.amount.toString(),
    );
    if (multiCollateralLimit) return new TokenAmount(multiCollateralLimit, maxAmount.token);

    return maxAmount;
  } catch (error) {
    logger.warn('Error fetching fee quotes for max amount', error);
    const chainName = multiProvider.tryGetChainMetadata(origin)?.displayName;
    toast.warn(`Cannot simulate transfer, ${chainName} native balance may be insufficient.`);
    return undefined;
  }
}
