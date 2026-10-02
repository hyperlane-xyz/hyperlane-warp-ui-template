import { Logger, WalletManager } from '@cosmos-kit/core';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { CosmosWalletContext } from './CosmosWalletContext';

const chainProviderSpy = vi.hoisted(() => vi.fn());

vi.mock('@chakra-ui/react', () => ({
  ChakraProvider: ({ children }: { children: ReactNode }) => children,
  extendTheme: () => ({}),
}));

vi.mock('@cosmos-kit/cosmostation', () => ({ wallets: [] }));
vi.mock('@cosmos-kit/keplr', () => ({ wallets: [] }));
vi.mock('@cosmos-kit/leap', () => ({ wallets: [] }));
vi.mock('@cosmos-kit/react', () => ({
  ChainProvider: (props: { children: ReactNode }) => {
    chainProviderSpy(props);
    return props.children;
  },
}));

vi.mock('@hyperlane-xyz/widgets/walletIntegrations/cosmos', () => ({
  getCosmosKitChainConfigs: () => ({ chains: [], assets: [] }),
}));

vi.mock('../../chains/hooks', () => ({
  useMultiProvider: () => ({ metadata: {} }),
}));

vi.mock('../_e2e/isE2E', () => ({ isE2EMode: () => false }));

describe('CosmosWalletContext', () => {
  beforeEach(() => chainProviderSpy.mockClear());
  afterEach(() => vi.unstubAllGlobals());

  test('disables parent-provided Cosmiframe wallets', () => {
    renderToStaticMarkup(
      <CosmosWalletContext>
        <div />
      </CosmosWalletContext>,
    );

    expect(chainProviderSpy).toHaveBeenCalledOnce();
    expect(chainProviderSpy.mock.calls[0][0]).toMatchObject({
      allowedIframeParentOrigins: [],
    });
  });

  test('the empty allowlist disables Cosmiframe inside an iframe', () => {
    vi.stubGlobal('window', { self: {}, parent: {} });

    const walletManager = new WalletManager([], [], new Logger('NONE'), false, true, []);

    expect(walletManager.cosmiframeEnabled).toBe(false);
    expect(walletManager.mainWallets).toHaveLength(0);
  });
});
