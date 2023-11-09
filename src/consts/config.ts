const isDevMode = process?.env?.NODE_ENV === 'development';
const version = process?.env?.NEXT_PUBLIC_VERSION ?? null;
const explorerApiKeys = JSON.parse(process?.env?.EXPLORER_API_KEYS || '{}');
const walletConnectProjectId = process?.env?.NEXT_PUBLIC_WALLET_CONNECT_ID || '';
const withdrawalWhitelist = process?.env?.NEXT_PUBLIC_BLOCK_WITHDRAWAL_WHITELIST || '';
const transferBlacklist = process?.env?.NEXT_PUBLIC_TRANSFER_BLACKLIST || '';

interface Config {
  debug: boolean; // Enables some debug features in the app
  version: string | null; // Matches version number in package.json
  explorerApiKeys: Record<string, string>; // Optional map of API keys for block explorer
  showTipBox: boolean; // Show/Hide the blue tip box above the transfer form
  showDisabledTokens: boolean; // Show/Hide invalid token options in the selection modal
  walletConnectProjectId: string; // Project ID provided by walletconnect
  withdrawalWhitelist: string; // comma-separated list of CAIP2 chain IDs to which transfers are supported
  transferBlacklist: string; // comma-separated list of routes between which transfers are disabled. Expects Caip2Id-Caip2Id (e.g. ethereum:1-sealevel:1399811149)
  enableExplorerLink: boolean; // Include a link to the hyperlane explorer in the transfer modal
  enableAutoTokenSelection: boolean; // Automatically select the first valid for the token field
}

export const config: Config = Object.freeze({
  debug: isDevMode,
  version,
  explorerApiKeys,
  showTipBox: true,
  showDisabledTokens: true,
  walletConnectProjectId,
  withdrawalWhitelist,
  transferBlacklist,
  enableExplorerLink: false,
  enableAutoTokenSelection: false,
});
