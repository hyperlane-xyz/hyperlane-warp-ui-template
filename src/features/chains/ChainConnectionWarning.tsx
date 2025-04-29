import { ChainMetadata, isRpcHealthy } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FormWarningBanner } from '../../components/banner/FormWarningBanner';
import { logger } from '../../utils/logger';
import { ChainSelectListModal } from './ChainSelectModal';
import { useMultiProvider } from './hooks';
import { getChainDisplayName } from './utils';

export function ChainConnectionWarning({
  origin,
  destination,
}: {
  origin: ChainName;
  destination: ChainName;
}) {
  const multiProvider = useMultiProvider();
  const originMetadata = multiProvider.getChainMetadata(origin);
  const destinationMetadata = multiProvider.getChainMetadata(destination);

  const { data } = useQuery({
    queryKey: ['ChainConnectionWarning', originMetadata, destinationMetadata],
    queryFn: async () => {
      const isOriginHealthy = await checkRpcHealth(originMetadata);
      const isDestinationHealthy = await checkRpcHealth(destinationMetadata);
      return { isOriginHealthy, isDestinationHealthy };
    },
    refetchInterval: 300000, // 5 minutes
  });

  const unhealthyChain =
    data &&
    ((!data.isOriginHealthy && originMetadata) ||
      (!data.isDestinationHealthy && destinationMetadata) ||
      undefined);

  const displayName = getChainDisplayName(
    multiProvider,
    unhealthyChain?.name || originMetadata.name,
    true,
  );

  const [isModalOpen, setIsModalOpen] = useState(false);

  const onClickEdit = () => {
    if (!unhealthyChain) return;
    setIsModalOpen(true);
  };

  return (
    <>
      <FormWarningBanner isVisible={!!unhealthyChain} cta="Edit" onClick={onClickEdit}>
        {`Connection to ${displayName} is unstable. Consider adding a more reliable RPC URL.`}
      </FormWarningBanner>
      <ChainSelectListModal
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
        onSelect={() => {}}
        showChainDetails={unhealthyChain?.name}
      />
    </>
  );
}

export async function checkRpcHealth(chainMetadata: ChainMetadata) {
  try {
    // Note: this currently checks the health of only the first RPC for non EVM chains,
    // which is what wallets and wallet libs will use
    // for EVM chains it will use a fallback RPC, that is why we need to check if any RPC are healthy instead
    if (chainMetadata.protocol === ProtocolType.Ethereum) {
      const healthChecks = chainMetadata.rpcUrls.map((_, i) =>
        isRpcHealthy(chainMetadata, i).then((result) => (result ? true : Promise.reject())),
      );
      return await Promise.any(healthChecks);
    } else return await isRpcHealthy(chainMetadata, 0);
  } catch (error) {
    if (error instanceof AggregateError)
      logger.warn(`No healthy RPCs found for ${chainMetadata.name}`);
    else logger.warn('Error checking RPC health', error);
    return false;
  }
}
