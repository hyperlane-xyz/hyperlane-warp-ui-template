import type { MultiProviderAdapter as MultiProtocolProvider } from '@hyperlane-xyz/sdk/providers/MultiProviderAdapter';
import type { Token } from '@hyperlane-xyz/sdk/token/Token';
import { TokenAmount } from '@hyperlane-xyz/sdk/token/TokenAmount';
import type { ChainName } from '@hyperlane-xyz/sdk/types';
import type { WarpCore } from '@hyperlane-xyz/sdk/warp/WarpCore';
import { KnownProtocolType } from '@hyperlane-xyz/utils';
import { getAccountAddressAndPubKey } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import type { AccountInfo } from '@hyperlane-xyz/widgets/walletIntegrations/types';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import { defaultMultiCollateralRoutes } from '../../consts/defaultMultiCollateralRoutes';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { getSdkToken } from '../hyperlane/sdkTokenRuntime';
import { isMultiCollateralLimitExceeded } from '../limits/utils';
import { useStore } from '../store';
import { findConnectedDestinationToken } from '../tokens/utils';
import { getTransferToken } from './fees';

interface FetchMaxParams {
  accounts: Record<KnownProtocolType, AccountInfo>;
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
      const runtimeWarpCore = await ensureWarpRuntime();
      if (!runtimeWarpCore) return undefined;
      return fetchMaxAmount(multiProvider, runtimeWarpCore, params);
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
    const { address, publicKey } = getAccountAddressAndPubKey(multiProvider, origin, accounts);
    if (!address) return balance;
    const SdkToken = await getSdkToken();
    const originToken = new SdkToken(balance.token);

    // Get recipient (form value or fallback to connected wallet for destination)
    const { address: connectedDestAddress } = getAccountAddressAndPubKey(
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
