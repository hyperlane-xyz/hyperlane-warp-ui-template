import { ChainMap } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { ADDRESS_BLACKLIST } from './blacklist';

const isDevMode = process.env.NODE_ENV === 'development';
const version = process.env.NEXT_PUBLIC_VERSION || '3.0.0';
const registryBranch = process.env.NEXT_PUBLIC_REGISTRY_BRANCH || undefined;
const registryUrl = process.env.NEXT_PUBLIC_REGISTRY_URL || undefined;
const registryProxyUrl = process.env.NEXT_PUBLIC_GITHUB_PROXY || 'https://proxy.hyperlane.xyz';
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_ID || '';
const transferBlacklist = process.env.NEXT_PUBLIC_TRANSFER_BLACKLIST || '';
const chainWalletWhitelists = JSON.parse(process.env.NEXT_PUBLIC_CHAIN_WALLET_WHITELISTS || '{}');
const rpcOverrides = process.env.NEXT_PUBLIC_RPC_OVERRIDES || '';
const explorerApiUrl =
  process.env.NEXT_PUBLIC_EXPLORER_API_URL || 'https://explorer4.hasura.app/v1/graphql';
const relayApiUrl = process.env.NEXT_PUBLIC_RELAY_API_URL || undefined;
const routerApiUrl =
  process.env.NEXT_PUBLIC_ROUTER_API_URL || 'https://router.services.hyperlane.xyz';
// CCS lives at the `/callCommitments` mount of the shared offchain-lookup
// service. UI posts engine-emitted calldata to `/calldata` under this mount.
const ccsUrl =
  process.env.NEXT_PUBLIC_CCS_URL ||
  'https://offchain-lookup.services.hyperlane.xyz/callCommitments';
const permit2ExpirationSeconds = parseFiniteEnvNumber(
  'NEXT_PUBLIC_PERMIT2_EXPIRATION_SECONDS',
  31_536_000,
);
const defaultSlippageBps = parseFiniteEnvNumber('NEXT_PUBLIC_DEFAULT_SLIPPAGE_BPS', 100);
const aleoNetwork = process.env.NEXT_PUBLIC_ALEO_NETWORK === 'testnet' ? 'testnet' : 'mainnet';

interface Config {
  addressBlacklist: string[]; // A list of addresses that are blacklisted and cannot be used in the app
  chainWalletWhitelists: ChainMap<string[]>; // A map of chain names to a list of wallet names that work for it
  enableExplorerLink: boolean; // Include a link to the hyperlane explorer in the transfer modal
  explorerApiUrl: string; // URL for the Hyperlane Explorer GraphQL API
  relayApiUrl: string | undefined; // Optional URL for the Hyperlane Relayer API
  isDevMode: boolean; // Enables some debug features in the app
  registryUrl: string | undefined; // Optional URL to use a custom registry instead of the published canonical version
  registryBranch?: string | undefined; // Optional customization of the registry branch instead of main
  registryProxyUrl?: string; // Optional URL to use a custom proxy for the GithubRegistry
  showTipBox: boolean; // Show/Hide the blue tip box above the transfer form
  shouldDisableChains: boolean; // Enable chain disabling for ChainSearchMenu. When true it will deactivate chains that have disabled status
  transferBlacklist: string; // comma-separated list of routes between which transfers are disabled. Expects Caip2Id-Caip2Id (e.g. ethereum:1-sealevel:1399811149)
  version: string; // App release version shown in metadata/analytics
  walletConnectProjectId: string; // Project ID provided by walletconnect
  walletProtocols: ProtocolType[] | undefined; // Wallet Protocols to show in the wallet connect modal. Leave undefined to include all of them
  rpcOverrides: string; // JSON string containing a map of chain names to an object with an URL for RPC overrides (For an example check the .env.example file)
  enableTrackingEvents: boolean; // Allow tracking events to happen on some actions;
<<<<<<< HEAD
=======
  featuredChains: string[]; // Chains to pin at the top of the default chain picker sort
  routerApiUrl: string; // Universal Router Engine base URL
  ccsUrl: string; // Call Commitments Service base URL (cross-chain transfer reveal)
  permit2ExpirationSeconds: number; // Default Permit2 allowance expiration
  defaultSlippageBps: number; // Default transfer slippage in basis points
  defaultTransferOriginToken: string | undefined; // Initial origin token for the transfer form (format: chainName-address)
  defaultTransferDestinationToken: string | undefined; // Initial destination token for the transfer form (format: chainName-address)
  aleoNetwork: 'mainnet' | 'testnet'; // Which Aleo network the Shield wallet connects to
>>>>>>> origin/main
}

export const config: Config = Object.freeze({
  addressBlacklist: ADDRESS_BLACKLIST.map((address) => address.toLowerCase()),
  aleoNetwork,
  chainWalletWhitelists,
  enableExplorerLink: true,
<<<<<<< HEAD
  defaultOriginChain: 'celo',
  defaultDestinationChain: undefined,
=======
  explorerApiUrl,
  relayApiUrl,
  defaultTransferOriginToken: 'bsc-0x0000000000000000000000000000000000000000',
  defaultTransferDestinationToken: 'base-0x0000000000000000000000000000000000000000',
>>>>>>> origin/main
  isDevMode,
  registryUrl,
  registryBranch,
  registryProxyUrl,
<<<<<<< HEAD
  showAddRouteButton: false,
  showAddChainButton: false,
  showDisabledTokens: false,
=======
>>>>>>> origin/main
  showTipBox: true,
  version,
  transferBlacklist,
  walletConnectProjectId,
<<<<<<< HEAD
  walletProtocols: [ProtocolType.Ethereum],
  shouldDisableChains: false,
  rpcOverrides,
  enableTrackingEvents: false,
=======
  walletProtocols: [
    ProtocolType.Ethereum,
    ProtocolType.Sealevel,
    ProtocolType.Cosmos,
    ProtocolType.Starknet,
    ProtocolType.Radix,
    ProtocolType.Tron,
    ProtocolType.Aleo,
  ],
  shouldDisableChains: false,
  rpcOverrides,
  enableTrackingEvents: false,
  routerApiUrl,
  ccsUrl,
  permit2ExpirationSeconds,
  defaultSlippageBps,
  featuredChains: [
    'ethereum',
    'base',
    'arbitrum',
    'solanamainnet',
    'optimism',
    'bsc',
    'polygon',
    'unichain',
    'avalanche',
    'tron',
    'hyperevm',
    'linea',
    'worldchain',
    'eclipsemainnet',
    'ink',
    'monad',
  ],
>>>>>>> origin/main
});

export function parseFiniteEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  return value;
}
