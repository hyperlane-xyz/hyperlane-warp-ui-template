import { ChainMap } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { ADDRESS_BLACKLIST } from './blacklist';

const isDevMode = process?.env?.NODE_ENV === 'development';
const version = process?.env?.NEXT_PUBLIC_VERSION || '0.0.0';
const registryUrl = process?.env?.NEXT_PUBLIC_REGISTRY_URL || undefined;
const registryBranch = process?.env?.NEXT_PUBLIC_REGISTRY_BRANCH || undefined;
const registryProxyUrl = process?.env?.NEXT_PUBLIC_GITHUB_PROXY || 'https://proxy.hyperlane.xyz';
const walletConnectProjectId = process?.env?.NEXT_PUBLIC_WALLET_CONNECT_ID || '';
const transferBlacklist = process?.env?.NEXT_PUBLIC_TRANSFER_BLACKLIST || '';
const chainWalletWhitelists = JSON.parse(process?.env?.NEXT_PUBLIC_CHAIN_WALLET_WHITELISTS || '{}');
const rpcOverrides = process?.env?.NEXT_PUBLIC_RPC_OVERRIDES || '';

interface Config {
  addressBlacklist: string[]; // A list of addresses that are blacklisted and cannot be used in the app
  chainWalletWhitelists: ChainMap<string[]>; // A map of chain names to a list of wallet names that work for it
  defaultOriginChain: string | undefined; // The initial origin chain to show when app first loads
  defaultDestinationChain: string | undefined; // The initial destination chain to show when app first loads
  enableExplorerLink: boolean; // Include a link to the hyperlane explorer in the transfer modal
  isDevMode: boolean; // Enables some debug features in the app
  registryUrl: string | undefined; // Optional URL to use a custom registry instead of the published canonical version
  registryBranch?: string | undefined; // Optional customization of the registry branch instead of main
  registryProxyUrl?: string; // Optional URL to use a custom proxy for the GithubRegistry
  showAddRouteButton: boolean; // Show/Hide the add route config icon in the button strip
  showAddChainButton: boolean; // Show/Hide add custom chain in the chain search menu
  showDisabledTokens: boolean; // Show/Hide invalid token options in the selection modal
  showTipBox: boolean; // Show/Hide the blue tip box above the transfer form
  shouldDisableChains: boolean; // Enable chain disabling for ChainSearchMenu. When true it will deactivate chains that have disabled status
  transferBlacklist: string; // comma-separated list of routes between which transfers are disabled. Expects Caip2Id-Caip2Id (e.g. ethereum:1-sealevel:1399811149)
  version: string; // Matches version number in package.json
  walletConnectProjectId: string; // Project ID provided by walletconnect
  walletProtocols: ProtocolType[] | undefined; // Wallet Protocols to show in the wallet connect modal. Leave undefined to include all of them
  rpcOverrides: string; // JSON string containing a map of chain names to an object with an URL for RPC overrides (For an example check the .env.example file)
}

export const config: Config = Object.freeze({
  addressBlacklist: ADDRESS_BLACKLIST.map((address) => address.toLowerCase()),
  chainWalletWhitelists,
  enableExplorerLink: false,
  defaultOriginChain: undefined,
  defaultDestinationChain: undefined,
  isDevMode,
  registryUrl,
  registryBranch,
  registryProxyUrl,
  showAddRouteButton: true,
  showAddChainButton: true,
  showDisabledTokens: false,
  showTipBox: true,
  version,
  transferBlacklist,
  walletConnectProjectId,
  walletProtocols: [ProtocolType.Ethereum, ProtocolType.Sealevel, ProtocolType.Cosmos],
  shouldDisableChains: false,
  rpcOverrides,
});
