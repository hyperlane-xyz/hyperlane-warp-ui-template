import { useAccount, useConnect } from '@starknet-react/core';
import { useEffect } from 'react';

const MOCK_CONNECTOR_ID = 'warp-e2e-mock-starknet';

export function E2EAutoConnectStarknet() {
  const { connect, connectors, status } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (isConnected || status === 'pending') return;
    const mock = connectors.find((c) => c.id === MOCK_CONNECTOR_ID);
    if (!mock) return;
    connect({ connector: mock });
  }, [connect, connectors, isConnected, status]);

  return null;
}
