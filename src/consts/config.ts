import { ChainMap } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { ADDRESS_BLACKLIST } from './blacklist';

const isDevMode = process.env.NODE_ENV === 'development';
const version = process.env.NEXT_PUBLIC_VERSION || '2.0.0';
const registryUrl = process.env.NEXT_PUBLIC_REGISTRY_URL || undefined;
const registryBranch = process.env.NEXT_PUBLIC_REGISTRY_BRANCH || undefined;
const registryProxyUrl = process.env.NEXT_PUBLIC_GITHUB_PROXY || 'https://proxy.hyperlane.xyz';
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_ID || '';
const transferBlacklist = process.env.NEXT_PUBLIC_TRANSFER_BLACKLIST || '';
const chainWalletWhitelists = JSON.parse(process.env.NEXT_PUBLIC_CHAIN_WALLET_WHITELISTS || '{}');
const rpcOverrides = process.env.NEXT_PUBLIC_RPC_OVERRIDES || '';
const explorerApiUrl =
  process.env.NEXT_PUBLIC_EXPLORER_API_URL || 'https://explorer4.hasura.app/v1/graphql';
const feeQuotingUrl = process.env.NEXT_PUBLIC_FEE_QUOTING_URL || undefined;
const relayApiUrl = process.env.NEXT_PUBLIC_RELAY_API_URL || undefined;
const routerApiUrl = process.env.NEXT_PUBLIC_ROUTER_API_URL || undefined;
// CCS lives at the `/callCommitments` mount of the shared offchain-lookup
// service. Engine emits `callCommitment.ccs.path = '/calldata'` relative to
// this mount, so the base URL must include the mount path.
const ccsUrl =
  process.env.NEXT_PUBLIC_CCS_URL ||
  'https://offchain-lookup.services.hyperlane.xyz/callCommitments';
const permit2ExpirationSeconds = parseEnvInt(
  'NEXT_PUBLIC_PERMIT2_EXPIRATION_SECONDS',
  process.env.NEXT_PUBLIC_PERMIT2_EXPIRATION_SECONDS,
  31_536_000,
  { min: 1 },
);
const defaultSlippageBps = parseEnvInt(
  'NEXT_PUBLIC_DEFAULT_SLIPPAGE_BPS',
  process.env.NEXT_PUBLIC_DEFAULT_SLIPPAGE_BPS,
  100,
  { min: 0 },
);

function parseEnvInt(
  name: string,
  rawValue: string | undefined,
  fallback: number,
  { min }: { min: number },
): number {
  if (!rawValue) return fallback;
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`Invalid ${name}: ${rawValue}`);
  }
  return value;
}

interface Config {
  addressBlacklist: string[]; // A list of addresses that are blacklisted and cannot be used in the app
  chainWalletWhitelists: ChainMap<string[]>; // A map of chain names to a list of wallet names that work for it
  defaultOriginToken: string | undefined; // The initial origin token (format: chainName-tokenRef, tokenRef can be collateral/address/denom or legacy symbol)
  defaultDestinationToken: string | undefined; // The initial destination token (format: chainName-tokenRef, tokenRef can be collateral/address/denom or legacy symbol)
  enableExplorerLink: boolean; // Include a link to the hyperlane explorer in the transfer modal
  explorerApiUrl: string; // URL for the Hyperlane Explorer GraphQL API
  relayApiUrl: string | undefined; // Optional URL for the Hyperlane Relayer API
  isDevMode: boolean; // Enables some debug features in the app
  registryUrl: string | undefined; // Optional URL to use a custom registry instead of the published canonical version
  registryBranch?: string | undefined; // Optional customization of the registry branch instead of main
  registryProxyUrl?: string; // Optional URL to use a custom proxy for the GithubRegistry
  showTipBox: boolean; // Show/Hide the blue tip box above the unified form
  shouldDisableChains: boolean; // Enable chain disabling for ChainSearchMenu. When true it will deactivate chains that have disabled status
  transferBlacklist: string; // comma-separated list of routes between which transfers are disabled. Expects Caip2Id-Caip2Id (e.g. ethereum:1-sealevel:1399811149)
  version: string; // Matches version number in package.json
  walletConnectProjectId: string; // Project ID provided by walletconnect
  walletProtocols: ProtocolType[] | undefined; // Wallet Protocols to show in the wallet connect modal. Leave undefined to include all of them
  rpcOverrides: string; // JSON string containing a map of chain names to an object with an URL for RPC overrides (For an example check the .env.example file)
  enableTrackingEvents: boolean; // Allow tracking events to happen on some actions;
  featuredChains: string[]; // Chains to pin at the top of the default chain picker sort
  featuredTokens: string[]; // List of featured tokens to prioritize in token picker (format: chainName-tokenRef; legacy chainName-symbol is supported)
  feeQuotingUrl: string | undefined; // Offchain fee quoting service base URL
  routerApiUrl: string | undefined; // Universal Router Engine base URL
  ccsUrl: string; // Call Commitments Service base URL (cross-chain swap reveal)
  permit2ExpirationSeconds: number; // Default Permit2 allowance expiration
  defaultSlippageBps: number; // Default swap slippage in basis points
}

export const config: Config = Object.freeze({
  addressBlacklist: ADDRESS_BLACKLIST.map((address) => address.toLowerCase()),
  chainWalletWhitelists,
  enableExplorerLink: true,
  explorerApiUrl,
  relayApiUrl,
  defaultOriginToken: 'ethereum-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  defaultDestinationToken: 'base-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  isDevMode,
  registryUrl,
  registryBranch,
  registryProxyUrl,
  showTipBox: true,
  version,
  transferBlacklist,
  walletConnectProjectId,
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
  feeQuotingUrl,
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
    'avalanche',
    'unichain',
    'hyperevm',
    'linea',
    'worldchain',
    'eclipsemainnet',
    'ink',
    'monad',
  ],
  featuredTokens: [
    // USDC
    'arbitrum-USDC',
    'avalanche-USDC',
    'base-USDC',
    'eclipsemainnet-USDC',
    'ethereum-USDC',
    'hyperevm-USDC',
    'ink-USDC',
    'linea-USDC',
    'monad-USDC',
    'optimism-USDC',
    'polygon-USDC',
    'solanamainnet-USDC',
    'unichain-USDC',
    'worldchain-USDC',

    // ETH
    'arbitrum-ETH',
    'base-ETH',
    'ethereum-ETH',
    'optimism-ETH',
    'hyperevm-ETH',

    // USDT
    'eclipsemainnet-USDT',
    'ethereum-USDT',
    'solanamainnet-USDT',
    'hyperevm-USDT',
    'aleo-USDT',
    'bsc-USDT',
    'matchain-USDT',

    // SOL
    'eclipsemainnet-SOL',
    'solanamainnet-SOL',
    'aleo-SOL',
    'hyperevm-SOL',
    'radix-hSOL',
    'sonicsvm-SOL',
    'starknet-SOL',

    // WBTC
    'eclipsemainnet-WBTC',
    'ethereum-WBTC',
    'hyperevm-WBTC',
    'radix-hWBTC',
    'aleo-WBTC',

    // HYPER
    'arbitrum-HYPER',
    'base-HYPER',
    'bsc-HYPER',
    'ethereum-HYPER',
    'optimism-HYPER',

    // stHYPER
    'bsc-stHYPER',
    'ethereum-stHYPER',
  ],
});
