import { ProtocolType } from '@hyperlane-xyz/utils';
import { Formik } from 'formik';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

import { ConnectAwareSubmitButton } from './ConnectAwareSubmitButton';

vi.mock('@hyperlane-xyz/widgets/walletIntegrations/multiProtocol', () => ({
  useAccountAddressForChain: () => undefined,
  useAccountForChain: () => ({
    protocol: ProtocolType.Cosmos,
    addresses: [{ chainName: 'cosmoshub', address: 'cosmos1connected' }],
    isReady: true,
  }),
  useConnectFns: () => ({}),
}));

vi.mock('../../features/chains/hooks', () => ({
  useChainProtocol: () => ProtocolType.Cosmos,
  useMultiProvider: () => ({}),
}));

describe('ConnectAwareSubmitButton', () => {
  test('prompts connect when the selected Cosmos chain has no address', () => {
    const markup = renderToStaticMarkup(
      <Formik initialValues={{}} onSubmit={vi.fn()}>
        <ConnectAwareSubmitButton chainName="neutron" text="Fetching quote…" disabled />
      </Formik>,
    );

    expect(markup).toContain('Connect wallet');
    expect(markup).not.toContain('disabled=""');
  });
});
