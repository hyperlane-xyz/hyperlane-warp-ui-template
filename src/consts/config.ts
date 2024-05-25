import { ADDRESS_BLACKLIST } from './blacklist';

const isDevMode = process?.env?.NODE_ENV === 'development';
const version = process?.env?.NEXT_PUBLIC_VERSION || '0.0.0';
const registryUrl = process?.env?.NEXT_PUBLIC_REGISTRY_URL || undefined;
const explorerApiKeys = JSON.parse(process?.env?.EXPLORER_API_KEYS || '{}');
const walletConnectProjectId = process?.env?.NEXT_PUBLIC_WALLET_CONNECT_ID || '';
const withdrawalWhitelist = process?.env?.NEXT_PUBLIC_BLOCK_WITHDRAWAL_WHITELIST || '';
const transferBlacklist = process?.env?.NEXT_PUBLIC_TRANSFER_BLACKLIST || '';

interface Config {
  isDevMode: boolean; // Enables some debug features in the app
  version: string; // Matches version number in package.json
  registryUrl: string | undefined; // Optional URL to use a custom registry instead of the published canonical version
  explorerApiKeys: Record<string, string>; // Optional map of API keys for block explorer
  showTipBox: boolean; // Show/Hide the blue tip box above the transfer form
  showDisabledTokens: boolean; // Show/Hide invalid token options in the selection modal
  walletConnectProjectId: string; // Project ID provided by walletconnect
  withdrawalWhitelist: string; // comma-separated list of CAIP2 chain IDs to which transfers are supported
  transferBlacklist: string; // comma-separated list of routes between which transfers are disabled. Expects Caip2Id-Caip2Id (e.g. ethereum:1-sealevel:1399811149)
  enableExplorerLink: boolean; // Include a link to the hyperlane explorer in the transfer modal
  addressBlacklist: string[]; // A list of addresses that are blacklisted and cannot be used in the app
}

export const config: Config = Object.freeze({
  isDevMode,
  version,
  registryUrl,
  explorerApiKeys,
  showTipBox: true,
  showDisabledTokens: true,
  walletConnectProjectId,
  withdrawalWhitelist,
  transferBlacklist,
  enableExplorerLink: false,
  addressBlacklist: ADDRESS_BLACKLIST.map((address) => address.toLowerCase()),
});
