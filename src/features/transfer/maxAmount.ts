import type { ConfiguredMultiProtocolProvider as MultiProtocolProvider } from '@hyperlane-xyz/sdk/providers/ConfiguredMultiProtocolProvider';
import type { Token } from '@hyperlane-xyz/sdk/token/Token';
import { TokenAmount } from '@hyperlane-xyz/sdk/token/TokenAmount';
import type { ChainName } from '@hyperlane-xyz/sdk/types';
import type { WarpCore } from '@hyperlane-xyz/sdk/warp/WarpCore';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import { defaultMultiCollateralRoutes } from '../../consts/defaultMultiCollateralRoutes';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { getRuntimeProtocols } from '../hyperlane/runtimeProtocols';
import { getSdkToken } from '../hyperlane/sdkTokenRuntime';
import { isMultiCollateralLimitExceeded } from '../limits/utils';
import { useStore } from '../store';
import { findConnectedDestinationToken, findRouteToken } from '../tokens/utils';
import {
  getRouteAccountAddressAndPubKey,
  type RouteAccounts,
} from '../wallet/routeAccounts';
import { getTransferToken } from './fees';

interface FetchMaxParams {
  accounts: RouteAccounts;
  balance: TokenAmount;
  origin: ChainName;
  destinationToken: Token;
  recipient?: string;
}

export function useFetchMaxAmount() {
  const multiProvider = useMultiProvider();
  const ensureWarpRuntime = useStore((s) => s.ensureWarpRuntime);

  const mutation = useMutation({
    mutationFn: async (params: FetchMaxParams) => {
      const warpCore = await ensureWarpRuntime(
        getRuntimeProtocols([params.balance.token.protocol, params.destinationToken.protocol]),
      );
      if (!warpCore) return undefined;
      return fetchMaxAmount(multiProvider, warpCore, params);
    },
  });

  return { fetchMaxAmount: mutation.mutateAsync, isLoading: mutation.isPending };
}

async function fetchMaxAmount(
  multiProvider: MultiProtocolProvider,
  warpCore: WarpCore,
  {
    accounts,
    balance,
    destinationToken: destToken,
    origin,
    recipient: formRecipient,
  }: FetchMaxParams,
) {
  try {
    const destination = destToken.chainName;
    const { address, publicKey } = getRouteAccountAddressAndPubKey(
      multiProvider,
      origin,
      accounts,
    );
    if (!address) return balance;
    const Token = await getSdkToken();
    const originToken = new Token(balance.token);

    // Get recipient (form value or fallback to connected wallet for destination)
    const { address: connectedDestAddress } = getRouteAccountAddressAndPubKey(
      multiProvider,
      destination,
      accounts,
    );
    const recipient = formRecipient || connectedDestAddress || address;

    const transferToken = await getTransferToken(
      warpCore,
      originToken,
      destToken,
      balance.amount.toString(),
      recipient,
      address,
      defaultMultiCollateralRoutes,
    );
    const transferDestinationToken = findConnectedDestinationToken(transferToken, destToken);
    if (!transferDestinationToken) return undefined;
    const tokenAmount = new TokenAmount(balance.amount, transferToken);
    const maxAmount = await warpCore.getMaxTransferAmount({
      balance: tokenAmount,
      destination,
      sender: address,
      senderPubKey: await publicKey,
      recipient,
      destinationToken: transferDestinationToken,
    });

    const multiCollateralLimit = isMultiCollateralLimitExceeded(
      maxAmount.token,
      transferDestinationToken,
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
