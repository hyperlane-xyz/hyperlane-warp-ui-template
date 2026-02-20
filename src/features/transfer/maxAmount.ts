import { MultiProtocolProvider, Token, TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
import { KnownProtocolType } from '@hyperlane-xyz/utils';
import { AccountInfo, getAccountAddressAndPubKey } from '@hyperlane-xyz/widgets';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { defaultMultiCollateralRoutes } from '../../consts/defaultMultiCollateralRoutes';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { isMultiCollateralLimitExceeded } from '../limits/utils';
import { useWarpCore } from '../tokens/hooks';
import { getTransferToken } from './fees';
import { asMultiRouterWarpCore } from './multiRouterWarpCore';
import { resolveTransferRoute } from './routeResolution';

interface FetchMaxParams {
  accounts: Record<KnownProtocolType, AccountInfo>;
  balance: TokenAmount;
  origin: ChainName;
  destinationToken: Token;
  recipient?: string;
}

export function useFetchMaxAmount() {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const mutation = useMutation({
    mutationFn: (params: FetchMaxParams) => fetchMaxAmount(multiProvider, warpCore, params),
  });

  return { fetchMaxAmount: mutation.mutateAsync, isLoading: mutation.isPending };
}

export async function fetchMaxAmount(
  multiProvider: MultiProtocolProvider,
  warpCore: WarpCore,
  { accounts, balance, destinationToken, origin, recipient: formRecipient }: FetchMaxParams,
) {
  try {
    const multiRouterWarpCore = asMultiRouterWarpCore(warpCore);
    const { address, publicKey } = getAccountAddressAndPubKey(multiProvider, origin, accounts);
    if (!address) return balance;
    const originToken = new Token(balance.token);
    const destination = destinationToken.chainName;

    // Get recipient (form value or fallback to connected wallet for destination)
    const { address: connectedDestAddress } = getAccountAddressAndPubKey(
      multiProvider,
      destinationToken.chainName,
      accounts,
    );
    const recipient = formRecipient || connectedDestAddress || address;

    const route = resolveTransferRoute({
      warpCore,
      originToken,
      destinationToken,
    });
    if (!route) return undefined;

    const transferToken = await getTransferToken(
      warpCore,
      originToken,
      destinationToken,
      balance.amount.toString(),
      recipient,
      address,
      defaultMultiCollateralRoutes,
    );
    const tokenAmount = new TokenAmount(balance.amount, transferToken);
    const maxAmount = await multiRouterWarpCore.getMaxTransferAmount({
      balance: tokenAmount,
      destination,
      destinationTokenAddress: destinationToken.addressOrDenom,
      sender: address,
      senderPubKey: await publicKey,
      recipient,
    });

    const multiCollateralLimit = isMultiCollateralLimitExceeded(
      maxAmount.token,
      destinationToken,
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
