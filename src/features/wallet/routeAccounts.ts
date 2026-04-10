import type { MultiProviderAdapter as MultiProtocolProvider } from '@hyperlane-xyz/sdk/providers/MultiProviderAdapter';
import type { ChainName } from '@hyperlane-xyz/sdk/types';
import {
  ProtocolType,
  type Address,
  type HexString,
  type KnownProtocolType,
} from '@hyperlane-xyz/utils';
import {
  getAccountAddressAndPubKey,
  getAccountAddressForChain,
} from '@hyperlane-xyz/widgets/walletIntegrations/accountUtils';
import type { AccountInfo } from '@hyperlane-xyz/widgets/walletIntegrations/types';

export type RouteAccounts = Partial<Record<KnownProtocolType, AccountInfo>>;

export function buildRouteAccounts(accounts: AccountInfo[]): RouteAccounts {
  const routeAccounts: RouteAccounts = {};

  for (const account of accounts) {
    if (!account.isReady) continue;
    routeAccounts[account.protocol as KnownProtocolType] = account;
    if (account.protocol === ProtocolType.Cosmos) {
      routeAccounts[ProtocolType.CosmosNative] = account;
    }
  }

  return routeAccounts;
}

function getAccountIdentity(account?: AccountInfo) {
  if (!account) return '';
  return JSON.stringify({
    addresses: account.addresses,
    isReady: account.isReady,
    protocol: account.protocol,
  });
}

export function getRouteAccountsKey(accounts: RouteAccounts = {}) {
  return Object.entries(accounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([protocol, account]) => `${protocol}:${getAccountIdentity(account)}`)
    .join('|');
}

export function areRouteAccountsEqual(left: RouteAccounts = {}, right: RouteAccounts = {}) {
  return getRouteAccountsKey(left) === getRouteAccountsKey(right);
}

export function getRouteAccountAddressForChain(
  multiProvider: MultiProtocolProvider,
  chainName?: ChainName,
  accounts: RouteAccounts = {},
): Address | undefined {
  return getAccountAddressForChain(
    multiProvider,
    chainName,
    accounts as Record<KnownProtocolType, AccountInfo>,
  );
}

export function getRouteAccountAddressAndPubKey(
  multiProvider: MultiProtocolProvider,
  chainName?: ChainName,
  accounts: RouteAccounts = {},
): {
  address?: Address;
  publicKey?: Promise<HexString | undefined>;
} {
  return getAccountAddressAndPubKey(
    multiProvider,
    chainName,
    accounts as Record<KnownProtocolType, AccountInfo>,
  );
}
