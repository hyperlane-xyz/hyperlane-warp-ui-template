import { SnapWalletAdapter } from '@drift-labs/snap-wallet-adapter';
import type { Adapter } from '@solana/wallet-adapter-base';
import {
  BackpackWalletAdapter,
  LedgerWalletAdapter,
  PhantomWalletAdapter,
  SalmonWalletAdapter,
  SolflareWalletAdapter,
  TrustWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { useEffect } from 'react';

interface Props {
  onError: (error: unknown) => void;
  onLoad: (adapters: Adapter[]) => void;
}

let adapters: Adapter[] | undefined;

export default function SolanaWalletAdaptersLoader({ onError, onLoad }: Props) {
  useEffect(() => {
    try {
      adapters ??= [
        new PhantomWalletAdapter(),
        new BackpackWalletAdapter(),
        new SolflareWalletAdapter(),
        new SalmonWalletAdapter(),
        new SnapWalletAdapter(),
        new TrustWalletAdapter(),
        new LedgerWalletAdapter(),
      ];
      onLoad(adapters);
    } catch (error) {
      onError(error);
    }
  }, [onError, onLoad]);

  return null;
}
