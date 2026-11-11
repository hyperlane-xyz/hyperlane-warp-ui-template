// Multi-chain Hyperlane routes (gully-ops l3/hyperlane/multichain/routes.yaml), written into routes.json by
// `npm run routes`. A token without a router address ("address": null) is planned, not deployed: "Coming soon".
import data from './routes.json';
import { CHAINS, CHILD, IS_TESTNET, type ChainKey, type Protocol } from './chains';

export interface McToken {
  /** router: EVM address, or the Sealevel warp program id (base58); null until deployed */
  address: string | null;
  standard: string | null;
  tokenType: 'native' | 'synthetic' | 'collateral' | string;
  symbol: string;
  name: string;
  decimals: number;
  /** collateral token (EVM ERC-20 or Solana mint) */
  collateralAddress: string | null;
  scale?: number;
}

export interface McRoute {
  id: string;
  /** manifest key: ETH, USDC, USDT, BNB, SOL, USDC-SOL */
  key: string;
  symbol: string;
  name: string;
  deployed: boolean;
  tokens: Partial<Record<string, McToken>>;
}

export interface ManifestChain {
  protocol: Protocol;
  domain: number;
  name: string;
  logo: string;
  explorer: string;
  nativeSymbol: string;
  faucet?: string;
  canonical?: boolean;
}

interface RoutesFile {
  network?: string;
  gully?: string;
  chains?: Record<string, ManifestChain>;
  multichain?: McRoute[];
}

const file = data as unknown as RoutesFile;
export const NETWORK = file.network || 'testnet';
export const GULLY: ChainKey = CHILD;
/** The manifest in routes.json is for one network; a build for the other network offers none of its routes. */
const SAME_NETWORK = NETWORK === (IS_TESTNET ? 'testnet' : 'mainnet');
export const MC_ROUTES: McRoute[] = SAME_NETWORK ? file.multichain || [] : [];
export const MANIFEST_CHAINS: Record<string, ManifestChain> = SAME_NETWORK ? file.chains || {} : {};

/** Chains on the other side of Gully Chain, in manifest order (classic Arbitrum Sepolia first). */
export const REMOTE_CHAINS: ChainKey[] = (() => {
  const keys = ['arbitrumsepolia', ...Object.keys(MANIFEST_CHAINS)];
  return [...new Set(keys)].filter((k): k is ChainKey => k in CHAINS && k !== GULLY);
})();

export function mcRoute(id?: string): McRoute | undefined {
  return id ? MC_ROUTES.find((r) => r.id === id) : undefined;
}
