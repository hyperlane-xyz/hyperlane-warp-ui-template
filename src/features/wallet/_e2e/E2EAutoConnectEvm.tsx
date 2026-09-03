import { useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';

import { MOCK_EVM_CONNECTOR_ID } from './constants';

export function E2EAutoConnectEvm() {
  const { connect, connectors } = useConnect();
  const { isConnected, status } = useAccount();

  useEffect(() => {
    if (isConnected || status === 'connecting' || status === 'reconnecting') return;
    const mockConnector = connectors.find((c) => c.id === MOCK_EVM_CONNECTOR_ID);
    if (!mockConnector) return;
    connect({ connector: mockConnector });
  }, [connect, connectors, isConnected, status]);

  return null;
}
