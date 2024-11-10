import { useStore } from '../store';
import { getChainDisplayName } from './utils';

export function useMultiProvider() {
  return useStore((s) => s.multiProvider);
}

// Ensures that the multiProvider has been populated during the onRehydrateStorage hook above,
// otherwise returns undefined
export function useReadyMultiProvider() {
  const multiProvider = useMultiProvider();
  if (!multiProvider.getKnownChainNames().length) return undefined;
  return multiProvider;
}

export function useChainMetadata(chainName?: ChainName) {
  const multiProvider = useMultiProvider();
  if (!chainName) return undefined;
  return multiProvider.tryGetChainMetadata(chainName);
}

export function useChainProtocol(chainName?: ChainName) {
  const metadata = useChainMetadata(chainName);
  return metadata?.protocol;
}

export function useChainDisplayName(chainName: ChainName, shortName = false) {
  const multiProvider = useMultiProvider();
  return getChainDisplayName(multiProvider, chainName, shortName);
}
