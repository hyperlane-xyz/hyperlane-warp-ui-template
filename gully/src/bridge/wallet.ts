// Wallets: the shared Gully Chain "Connect a wallet" dialog (src/gc-connect/gc-connect.js, a byte copy of gully-ops
// sites/_shared/gc-connect) picks the provider: Gully Wallet (Gully ID passkey) first, WalletConnect (when a project id
// is set), every EIP-6963 wallet, then MetaMask / Rabby / Coinbase install links. EIP-6963 discovery below still
// powers the silent reconnect of the last injected wallet.
import { createWalletClient, custom, numberToHex, type Address, type EIP1193Provider, type WalletClient } from 'viem';

import { CHAINS, chainById, type ChainKey } from '../config/chains';
import { viemChain } from './clients';

export interface WalletInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
  provider: EIP1193Provider;
}

export interface WalletState {
  wallets: WalletInfo[];
  active?: WalletInfo;
  address?: Address;
  chainId?: number;
  connecting: boolean;
  error?: string;
}

/** what GullyConnect.open() resolves with (gc-connect 1.0.0) */
export interface ConnectResult {
  kind: 'gully' | 'walletconnect' | 'injected';
  id: string;
  name: string;
  icon: string | null;
  rdns: string | null;
  provider: EIP1193Provider;
  accounts: Address[];
}
interface GullyConnectApi {
  VERSION: string;
  open(opts: { appName?: string; request?: boolean; walletConnect?: () => Promise<EIP1193Provider> }): Promise<ConnectResult>;
}
declare global {
  interface Window {
    GullyConnect?: GullyConnectApi;
  }
}
/** WalletConnect needs a Reown project id (none yet): the dialog then shows the row as "Soon". */
export const WALLETCONNECT_ID: string = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WC_PROJECT_ID || '';

let state: WalletState = { wallets: [], connecting: false };
const subs = new Set<() => void>();
const set = (p: Partial<WalletState>) => {
  state = { ...state, ...p };
  subs.forEach((f) => f());
};
export const walletStore = {
  get: () => state,
  subscribe: (f: () => void) => {
    subs.add(f);
    return () => subs.delete(f);
  },
};

const LAST = 'gully-bridge:wallet';
function remember(rdns?: string) {
  try {
    if (rdns) localStorage.setItem(LAST, rdns);
    else localStorage.removeItem(LAST);
  } catch {
    /* storage unavailable */
  }
}

export function startDiscovery() {
  if (typeof window === 'undefined') return;
  window.addEventListener('eip6963:announceProvider', ((e: CustomEvent) => {
    const { info, provider } = e.detail;
    if (state.wallets.some((w) => w.uuid === info.uuid)) return;
    set({ wallets: [...state.wallets, { ...info, provider }] });
    autoReconnect();
  }) as EventListener);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  setTimeout(() => {
    const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
    if (!state.wallets.length && eth)
      set({ wallets: [{ uuid: 'injected', name: 'Browser wallet', icon: '', rdns: 'injected', provider: eth }] });
    autoReconnect();
  }, 400);
}

let triedAuto = false;
async function autoReconnect() {
  if (triedAuto || state.address) return;
  let rdns: string | null = null;
  try {
    rdns = localStorage.getItem(LAST);
  } catch {
    /* ignore */
  }
  const w = rdns && state.wallets.find((x) => x.rdns === rdns);
  if (!w) return;
  triedAuto = true;
  try {
    const accts = (await w.provider.request({ method: 'eth_accounts' })) as Address[];
    if (accts[0]) await attach(w, accts[0]);
  } catch {
    /* ignore */
  }
}

async function attach(w: WalletInfo, address: Address) {
  const chainId = Number(await w.provider.request({ method: 'eth_chainId' }));
  set({ active: w, address, chainId, connecting: false, error: undefined });
  const p = w.provider as EIP1193Provider & { on?: Function; removeListener?: Function };
  p.on?.('accountsChanged', (a: Address[]) => (a[0] ? set({ address: a[0] }) : disconnect()));
  p.on?.('chainChanged', (c: string) => set({ chainId: Number(c) }));
  remember(w.rdns);
}

export async function connect(w: WalletInfo) {
  set({ connecting: true, error: undefined });
  try {
    const accts = (await w.provider.request({ method: 'eth_requestAccounts' })) as Address[];
    if (!accts[0]) throw new Error('No account returned');
    await attach(w, accts[0]);
  } catch (e) {
    set({ connecting: false, error: (e as Error).message || 'Connection rejected' });
    throw e;
  }
}

/** map a dialog result onto the wallet the bridge keeps (gully -> Gully Wallet rdns, WalletConnect, 6963 by rdns) */
export function walletFromResult(r: ConnectResult): WalletInfo {
  const rdns = r.rdns || (r.kind === 'gully' ? 'xyz.gullyid.wallet' : r.kind === 'walletconnect' ? 'walletconnect' : r.id || 'injected');
  return { uuid: rdns, name: r.name, icon: r.icon || '', rdns, provider: r.provider };
}

/** open the shared dialog and attach the chosen wallet. Resolves false when the user closes it. */
export async function openConnect(api: GullyConnectApi | undefined = typeof window !== 'undefined' ? window.GullyConnect : undefined): Promise<boolean> {
  if (!api) {
    set({ error: 'The wallet dialog did not load. Reload the page.' });
    throw new Error('GullyConnect is not loaded');
  }
  set({ connecting: true, error: undefined });
  try {
    const r = await api.open({ appName: 'Gully Bridge', walletConnect: undefined });
    if (!r.accounts?.[0]) throw new Error('No account returned');
    await attach(walletFromResult(r), r.accounts[0]);
    return true;
  } catch (e) {
    const code = (e as { code?: number }).code;
    set({ connecting: false, error: code === 4001 ? undefined : (e as Error).message || 'Connection failed' });
    if (code === 4001) return false;
    throw e;
  }
}

export function disconnect() {
  remember();
  set({ active: undefined, address: undefined, chainId: undefined });
}

export async function ensureChain(key: ChainKey) {
  const w = state.active;
  if (!w) throw new Error('Connect a wallet first');
  const c = CHAINS[key];
  if (state.chainId === c.id) return;
  try {
    await w.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: numberToHex(c.id) }] });
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (code !== 4902 && code !== -32603) throw e;
    await w.provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: numberToHex(c.id),
          chainName: c.name,
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: c.walletRpcs,
          blockExplorerUrls: [c.explorer],
        },
      ],
    });
  }
  set({ chainId: c.id });
}

export function walletClient(key: ChainKey): WalletClient {
  const w = state.active;
  if (!w || !state.address) throw new Error('Connect a wallet first');
  return createWalletClient({ account: state.address, chain: viemChain(key), transport: custom(w.provider) });
}

export function chainLabel(id?: number) {
  return id ? chainById(id)?.name || `chain ${id}` : '';
}
