import { InterchainAccount, MultiProvider } from '@hyperlane-xyz/sdk';
import { useMemo } from 'react';
import { useMultiProvider } from '../../chains/hooks';
import { SWAP_CHAIN_CONFIGS } from '../swapConfig';

export function useInterchainAccountApp(): InterchainAccount | null {
  const multiProtocolProvider = useMultiProvider();

  return useMemo(() => {
    const addressesMap: Record<string, { interchainAccountRouter: string }> = {};
    for (const [chainName, config] of Object.entries(SWAP_CHAIN_CONFIGS)) {
      if (config.icaRouter) {
        addressesMap[chainName] = { interchainAccountRouter: config.icaRouter };
      }
    }
    if (Object.keys(addressesMap).length === 0) return null;

    try {
      // InterchainAccount requires EVM MultiProvider, not MultiProtocolProvider.
      // Build one from the same chain metadata the store already holds.
      const evmMultiProvider = new MultiProvider(multiProtocolProvider.metadata);
      return InterchainAccount.fromAddressesMap(addressesMap, evmMultiProvider);
    } catch {
      return null;
    }
  }, [multiProtocolProvider]);
}
