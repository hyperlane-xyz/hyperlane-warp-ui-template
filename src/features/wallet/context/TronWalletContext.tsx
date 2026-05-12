import { WalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapter-tronlink';
import { PropsWithChildren, useMemo } from 'react';

import { E2EAutoConnectTron } from '../_e2e/E2EAutoConnectTron';
import { isE2EMode } from '../_e2e/isE2E';
import { MockTronAdapter } from '../_e2e/MockTronAdapter';

export function TronWalletContext({ children }: PropsWithChildren<unknown>) {
  const e2e = isE2EMode();
  const adapters = useMemo(() => {
    const real = [new TronLinkAdapter()];
    return e2e ? [new MockTronAdapter()] : real;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e2e]);
  return (
    <WalletProvider adapters={adapters}>
      {e2e && <E2EAutoConnectTron />}
      {children}
    </WalletProvider>
  );
}
