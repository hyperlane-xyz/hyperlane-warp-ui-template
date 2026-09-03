import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { SolanaWalletContext } from './SolanaWalletContext';

const { legacySolflareSpy, walletProviderSpy } = vi.hoisted(() => ({
  legacySolflareSpy: vi.fn(),
  walletProviderSpy: vi.fn(),
}));

function wallet(name: string) {
  return class {
    name = name;
  };
}

vi.mock('@drift-labs/snap-wallet-adapter', () => ({
  SnapWalletAdapter: wallet('MetaMask'),
}));

vi.mock('@solana/wallet-adapter-backpack', () => ({
  BackpackWalletAdapter: wallet('Backpack'),
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  ConnectionProvider: ({ children }: { children: ReactNode }) => children,
  WalletProvider: (props: { children: ReactNode; wallets: { name: string }[] }) => {
    walletProviderSpy(props);
    return props.children;
  },
}));

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  WalletModalProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@solana/wallet-adapter-wallets', () => ({
  LedgerWalletAdapter: wallet('Ledger'),
  PhantomWalletAdapter: wallet('Phantom'),
  SalmonWalletAdapter: wallet('Salmon'),
  SolflareWalletAdapter: class {
    name = 'Solflare';

    constructor() {
      legacySolflareSpy();
    }
  },
  TrustWalletAdapter: wallet('Trust'),
}));

vi.mock('@solana/web3.js', () => ({ clusterApiUrl: () => 'http://localhost' }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }));
vi.mock('../_e2e/isE2E', () => ({ isE2EMode: () => false }));

describe('SolanaWalletContext', () => {
  beforeEach(() => {
    legacySolflareSpy.mockClear();
    walletProviderSpy.mockClear();
  });

  test('does not register the legacy Solflare iframe adapter', () => {
    renderToStaticMarkup(
      <SolanaWalletContext>
        <div />
      </SolanaWalletContext>,
    );

    expect(legacySolflareSpy).not.toHaveBeenCalled();
    expect(walletProviderSpy).toHaveBeenCalledOnce();
    expect(walletProviderSpy.mock.calls[0][0].wallets).not.toContainEqual(
      expect.objectContaining({ name: 'Solflare' }),
    );
  });
});
