// Solana wallets through the Wallet Standard (Phantom, Solflare, Backpack...): `standard:connect` to connect and
// `solana:signAndSendTransaction` to send. @wallet-standard/app is only loaded the first time a Solana route is chosen.
import { useSyncExternalStore } from 'react';
import type { Wallet, WalletAccount } from '@wallet-standard/base';

import { base58Encode } from './base58';

export const SOLANA_CHAIN = 'solana:devnet';
const REQUIRED = ['standard:connect', 'solana:signAndSendTransaction'];

export interface SolWalletInfo {
  name: string;
  icon: string;
  wallet: Wallet;
}

export interface SolWalletState {
  started: boolean;
  wallets: SolWalletInfo[];
  active?: SolWalletInfo;
  account?: WalletAccount;
  address?: string;
  connecting: boolean;
  error?: string;
}

let state: SolWalletState = { started: false, wallets: [], connecting: false };
const subs = new Set<() => void>();
const set = (p: Partial<SolWalletState>) => {
  state = { ...state, ...p };
  subs.forEach((f) => f());
};
export const solWalletStore = {
  get: () => state,
  subscribe: (f: () => void) => {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
};

export function useSolanaWallet() {
  return useSyncExternalStore(solWalletStore.subscribe, solWalletStore.get, solWalletStore.get);
}

/** A wallet the bridge can use: it connects, signs and sends, and (when it says) supports Solana Devnet. */
export function usable(w: Pick<Wallet, 'features' | 'chains'>) {
  const ok = REQUIRED.every((f) => f in w.features);
  const chainOk = !w.chains.length || w.chains.some((c) => c.startsWith('solana:'));
  return ok && chainOk;
}

export function startSolanaDiscovery() {
  if (state.started || typeof window === 'undefined') return;
  set({ started: true });
  import('@wallet-standard/app')
    .then(({ getWallets }) => {
      const api = getWallets();
      const refresh = () =>
        set({ wallets: api.get().filter(usable).map((wallet) => ({ name: wallet.name, icon: wallet.icon, wallet })) });
      refresh();
      api.on('register', refresh);
      api.on('unregister', refresh);
    })
    .catch(() => set({ error: 'Could not look for Solana wallets' }));
}

type ConnectFeature = { connect(input?: { silent?: boolean }): Promise<{ accounts: readonly WalletAccount[] }> };
type DisconnectFeature = { disconnect(): Promise<void> };
type SignAndSendFeature = {
  signAndSendTransaction(
    ...inputs: { account: WalletAccount; transaction: Uint8Array; chain: string; options?: Record<string, unknown> }[]
  ): Promise<readonly { signature: Uint8Array }[]>;
};

export async function connectSolana(w: SolWalletInfo) {
  set({ connecting: true, error: undefined });
  try {
    const { accounts } = await (w.wallet.features['standard:connect'] as ConnectFeature).connect();
    const account = accounts.find((a) => a.chains.includes(SOLANA_CHAIN)) || accounts[0];
    if (!account) throw new Error('No account returned');
    set({ active: w, account, address: account.address, connecting: false });
  } catch (e) {
    set({ connecting: false, error: (e as Error).message || 'Connection rejected' });
    throw e;
  }
}

export async function disconnectSolana() {
  const w = state.active;
  set({ active: undefined, account: undefined, address: undefined });
  try {
    await (w?.wallet.features['standard:disconnect'] as DisconnectFeature | undefined)?.disconnect();
  } catch {
    /* the wallet keeps its own session */
  }
}

/** Has the wallet sign (fee payer) and send a serialized transaction; returns the base58 signature. */
export async function signAndSendSolana(transaction: Uint8Array): Promise<string> {
  const { active, account } = state;
  if (!active || !account) throw new Error('Connect a Solana wallet first');
  const f = active.wallet.features['solana:signAndSendTransaction'] as SignAndSendFeature;
  const [out] = await f.signAndSendTransaction({
    account,
    transaction,
    chain: SOLANA_CHAIN,
    options: { preflightCommitment: 'confirmed' },
  });
  if (!out?.signature) throw new Error('The wallet returned no signature');
  return base58Encode(out.signature);
}
