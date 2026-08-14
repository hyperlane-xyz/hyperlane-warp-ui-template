import { ProtocolType } from '@hyperlane-xyz/utils';
import { useConnectFns } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { useMemo } from 'react';

import { useSolanaWalletActivation } from './context/SolanaWalletContext';

export function useAppConnectFns() {
  const connectFns = useConnectFns();
  const { connect: connectSolana } = useSolanaWalletActivation();

  return useMemo(
    () => ({ ...connectFns, [ProtocolType.Sealevel]: connectSolana }),
    [connectFns, connectSolana],
  );
}
