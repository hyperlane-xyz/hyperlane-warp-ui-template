import { MultiProtocolProvider, Token, TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
<<<<<<< HEAD
import { ProtocolType } from '@hyperlane-xyz/utils';
import { AccountInfo, getAccountAddressAndPubKey } from '@hyperlane-xyz/widgets';
=======
import { KnownProtocolType } from '@hyperlane-xyz/utils';
import { getAccountAddressAndPubKey } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { type AccountInfo } from '@hyperlane-xyz/widgets/walletIntegrations/types';
>>>>>>> origin/main
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
import { findConnectedDestinationToken } from '../tokens/utils';
import { getTransferToken } from './fees';
>>>>>>> origin/main

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
    const originToken = new Token(balance.token);
<<<<<<< HEAD
    const destinationToken = originToken.getConnectionForChain(destination)?.token;
    if (!destinationToken) return undefined;

    const transferToken = await getLowestFeeTransferToken(
      warpCore,
      originToken,
      destinationToken,
      balance.amount.toString(),
      address,
      address,
    );
=======

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
>>>>>>> origin/main
    const tokenAmount = new TokenAmount(balance.amount, transferToken);
    const maxAmount = await warpCore.getMaxTransferAmount({
      balance: tokenAmount,
      destination,
      sender: address,
      senderPubKey: await publicKey,
<<<<<<< HEAD
      // defaulting to address here for recipient
      recipient: address,
=======
      recipient,
      destinationToken: transferDestinationToken,
>>>>>>> origin/main
    });

    const multiCollateralLimit = isMultiCollateralLimitExceeded(
      maxAmount.token,
<<<<<<< HEAD
      destination,
=======
      transferDestinationToken,
>>>>>>> origin/main
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
