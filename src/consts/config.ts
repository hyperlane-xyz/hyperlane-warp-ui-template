import { ChainMap } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { ADDRESS_BLACKLIST } from './blacklist';

const isDevMode = process?.env?.NODE_ENV === 'development';
const version = process?.env?.NEXT_PUBLIC_VERSION || '2.0.0';
const DEFAULT_REGISTRY_URL = 'https://github.com/hyperlane-xyz/hyperlane-registry';
const DEFAULT_REGISTRY_BRANCH = 'nambrot/multi-collateral-deploy';
const registryUrl = process?.env?.NEXT_PUBLIC_REGISTRY_URL || DEFAULT_REGISTRY_URL;
const registryBranch = process?.env?.NEXT_PUBLIC_REGISTRY_BRANCH || DEFAULT_REGISTRY_BRANCH;
const registryProxyUrl = process?.env?.NEXT_PUBLIC_GITHUB_PROXY || 'https://proxy.hyperlane.xyz';
const walletConnectProjectId = process?.env?.NEXT_PUBLIC_WALLET_CONNECT_ID || '';
const transferBlacklist = process?.env?.NEXT_PUBLIC_TRANSFER_BLACKLIST || '';
const chainWalletWhitelists = JSON.parse(process?.env?.NEXT_PUBLIC_CHAIN_WALLET_WHITELISTS || '{}');
const rpcOverrides = process?.env?.NEXT_PUBLIC_RPC_OVERRIDES || '';
const explorerApiUrl =
  process?.env?.NEXT_PUBLIC_EXPLORER_API_URL || 'https://explorer4.hasura.app/v1/graphql';

interface Config {
  addressBlacklist: string[]; // A list of addresses that are blacklisted and cannot be used in the app
  chainWalletWhitelists: ChainMap<string[]>; // A map of chain names to a list of wallet names that work for it
  defaultOriginToken: string | undefined; // The initial origin token to show when app first loads (format: chainName-symbol, e.g. "ethereum-hyper")
  defaultDestinationToken: string | undefined; // The initial destination token to show when app first loads (format: chainName-symbol, e.g. "bsc-hyper")
  enableExplorerLink: boolean; // Include a link to the hyperlane explorer in the transfer modal
  explorerApiUrl: string; // URL for the Hyperlane Explorer GraphQL API
  isDevMode: boolean; // Enables some debug features in the app
  registryUrl: string | undefined; // Optional URL to use a custom registry instead of the published canonical version
  registryBranch?: string | undefined; // Optional customization of the registry branch instead of main
  registryProxyUrl?: string; // Optional URL to use a custom proxy for the GithubRegistry
  showTipBox: boolean; // Show/Hide the blue tip box above the transfer form
  shouldDisableChains: boolean; // Enable chain disabling for ChainSearchMenu. When true it will deactivate chains that have disabled status
  transferBlacklist: string; // comma-separated list of routes between which transfers are disabled. Expects Caip2Id-Caip2Id (e.g. ethereum:1-sealevel:1399811149)
  version: string; // Matches version number in package.json
  walletConnectProjectId: string; // Project ID provided by walletconnect
  walletProtocols: ProtocolType[] | undefined; // Wallet Protocols to show in the wallet connect modal. Leave undefined to include all of them
  rpcOverrides: string; // JSON string containing a map of chain names to an object with an URL for RPC overrides (For an example check the .env.example file)
  enableTrackingEvents: boolean; // Allow tracking events to happen on some actions;
  featuredTokens: string[]; // List of featured tokens to prioritize in token picker (format: "chainName-symbol")
}

export const config: Config = Object.freeze({
  addressBlacklist: ADDRESS_BLACKLIST.map((address) => address.toLowerCase()),
  chainWalletWhitelists,
  enableExplorerLink: false,
  explorerApiUrl,
  defaultOriginToken: 'ethereum-USDC',
  defaultDestinationToken: 'base-USDC',
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
    ProtocolType.Aleo,
  ],
  shouldDisableChains: false,
  rpcOverrides,
  enableTrackingEvents: false,
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
