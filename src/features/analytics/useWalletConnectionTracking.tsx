import { ProtocolType } from '@hyperlane-xyz/utils';
import { useAccounts, useWalletDetails } from '@hyperlane-xyz/widgets';
import { useEffect, useRef } from 'react';
import { config } from '../../consts/config';
import { useMultiProvider } from '../chains/hooks';
import { EVENT_NAME } from './types';
import { trackEvent } from './utils';

/**
 * Custom hook to track wallet connections and fire analytics events
 * Handles both new connections and browser refreshes without duplicating events
 */
export function useWalletConnectionTracking() {
  const multiProvider = useMultiProvider();
  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);
  const walletDetails = useWalletDetails();
  // Use a ref to track which wallets we've already fired events for in this session
  // This prevents infinite loops and duplicate events
  const trackedWalletsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Iterate through all protocol types
    Object.entries(accounts).forEach(([protocol, accountInfo]) => {
      const { addresses } = accountInfo;

      // not tracking cosmos protocols chain
      if (protocol === ProtocolType.Cosmos) return;

      // Only track if account has addresses (meaning wallet is connected)
      if (addresses && addresses.length > 0) {
        const address = addresses[0].address;
        const walletName = walletDetails[protocol as ProtocolType]?.name;

        // Create a unique identifier for this wallet connection (protocol + address)
        const walletId = `${protocol}:${address}`;

        // Check if we've already tracked this wallet in this session
        if (!trackedWalletsRef.current.has(walletId)) {
          // Add to tracked set to prevent duplicate events
          trackedWalletsRef.current.add(walletId);

          // Fire the analytics event
          trackEvent(EVENT_NAME.WALLET_CONNECTED, {
            protocol: protocol as ProtocolType,
            walletAddress: address,
            walletName: walletName || 'Unknown',
          });
        }
      }
    });
  }, [accounts, walletDetails]);
}
