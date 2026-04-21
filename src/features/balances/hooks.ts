import type { MultiProviderAdapter as MultiProtocolProvider } from '@hyperlane-xyz/sdk/providers/MultiProviderAdapter';
import type { IToken } from '@hyperlane-xyz/sdk/token/IToken';
import type { Token } from '@hyperlane-xyz/sdk/token/Token';
import { TokenAmount } from '@hyperlane-xyz/sdk/token/TokenAmount';
import { LOCKBOX_STANDARDS } from '@hyperlane-xyz/sdk/token/TokenStandard';
import {
  ProtocolType,
  getAddressProtocolType,
  isNullish,
  isValidAddress,
  isValidAddressEvm,
  normalizeAddress,
} from '@hyperlane-xyz/utils';
import { useAleoAccount } from '@hyperlane-xyz/widgets/walletIntegrations/aleoWallet';
import { useCosmosAccount } from '@hyperlane-xyz/widgets/walletIntegrations/cosmosWallet';
import { useEthereumAccount } from '@hyperlane-xyz/widgets/walletIntegrations/ethereumWallet';
import { useRadixAccount } from '@hyperlane-xyz/widgets/walletIntegrations/radixWallet';
import { useSolanaAccount } from '@hyperlane-xyz/widgets/walletIntegrations/solanaWallet';
import { useStarknetAccount } from '@hyperlane-xyz/widgets/walletIntegrations/starknetWallet';
import { useTronAccount } from '@hyperlane-xyz/widgets/walletIntegrations/tronWallet';
import { getAddressForChain } from '@hyperlane-xyz/widgets/walletIntegrations/walletAddresses';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'react-toastify';
import { Hex } from 'viem';
import { useBalance as useWagmiBalance } from 'wagmi';

import { useToastError } from '../../components/toast/useToastError';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { getSdkToken } from '../hyperlane/sdkTokenRuntime';
import { useStore } from '../store';
import { getTokenKey } from '../tokens/utils';
import { fetchCosmosChainBalances, groupCosmosTokensByChain } from './cosmos';
import { fetchChainBalances, groupEvmTokensByChain } from './evm';
import { fetchSealevelChainBalances, groupSealevelTokensByChain } from './svm';
import { fetchSdkBalance } from './tokens';

export function useBalance(chain?: ChainName, token?: IToken, address?: Address) {
  const multiProvider = useMultiProvider();
  const directEvmBalance = useDirectEvmBalance(chain, token, address);
  const hasBalanceFetcher =
    'getBalance' in (token || {}) && typeof token?.getBalance === 'function';
  const { isLoading, isError, error, data } = useQuery({
    // The Token and Multiprovider classes are not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: [
      'useBalance',
      chain,
      address,
      token?.addressOrDenom,
      token?.collateralAddressOrDenom,
      hasBalanceFetcher,
    ],
    queryFn: () => {
      if (!chain || !token || !address || !isValidAddress(address, token.protocol)) return null;
      if (!hasBalanceFetcher) {
        throw new Error('Token balance fetcher missing for enabled balance query');
      }
      return token.getBalance(multiProvider, address);
    },
    enabled: hasBalanceFetcher && !directEvmBalance.isEnabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  useToastError(
    directEvmBalance.isEnabled ? directEvmBalance.error : error,
    'Error fetching balance',
  );

  if (directEvmBalance.isEnabled) {
    return {
      isLoading: directEvmBalance.isLoading,
      isError: directEvmBalance.isError,
      balance: directEvmBalance.balance,
    };
  }

  return {
    isLoading,
    isError,
    balance: data ?? undefined,
  };
}

export function useOriginBalance(originToken?: Token) {
  const multiProvider = useMultiProvider();
  const origin = originToken?.chainName;
  const address = useWalletAddressForChain(multiProvider, origin, originToken?.protocol);
  return useBalance(origin, originToken, address);
}

export function useDestinationBalance(recipient?: string, destinationToken?: Token) {
  const destination = destinationToken?.chainName;
  return useBalance(destination, destinationToken, recipient);
}

export async function getDestinationNativeBalance(
  multiProvider: MultiProtocolProvider,
  { destination, recipient }: { destination: string; recipient: string },
) {
  try {
    const chainMetadata = multiProvider.getChainMetadata(destination);
    const Token = await getSdkToken();
    const token = Token.FromChainMetadataNativeToken(chainMetadata);
    const balance = await token.getBalance(multiProvider, recipient);
    return balance.amount;
  } catch (error) {
    const msg = `Error checking recipient balance on ${getChainDisplayName(multiProvider, destination)}`;
    logger.error(msg, error);
    toast.error(msg);
    return undefined;
  }
}

export function useEvmWalletBalance(
  chainName: string,
  chainId: number,
  token: string,
  refetchEnabled: boolean,
) {
  const multiProvider = useMultiProvider();
  const address = useWalletAddressForChain(multiProvider, chainName, ProtocolType.Ethereum);
  const allowRefetch = Boolean(address) && refetchEnabled;
  const normalizedAddress = !isNullish(address)
    ? (normalizeAddress(address, ProtocolType.Ethereum) as Hex)
    : undefined;
  const normalizedToken = token
    ? (normalizeAddress(token, ProtocolType.Ethereum) as Hex)
    : undefined;

  const { data, isError, isLoading } = useWagmiBalance({
    address: normalizedAddress,
    token: normalizedToken,
    chainId: chainId,
    query: {
      refetchInterval: allowRefetch ? 5000 : false,
      enabled: allowRefetch,
    },
  });

  return { balance: data, isError, isLoading };
}

function useWalletAddressForChain(
  multiProvider: MultiProtocolProvider,
  chainName?: ChainName,
  protocol?: ProtocolType,
) {
  const evmAddresses = useEthereumAccount(multiProvider).addresses;
  const solanaAddresses = useSolanaAccount(multiProvider).addresses;
  const cosmosAddresses = useCosmosAccount(multiProvider).addresses;
  const starknetAddresses = useStarknetAccount(multiProvider).addresses;
  const radixAddresses = useRadixAccount(multiProvider).addresses;
  const aleoAddresses = useAleoAccount(multiProvider).addresses;
  const tronAddresses = useTronAccount(multiProvider).addresses;

  return useMemo(() => {
    if (!chainName || !protocol) return undefined;
    switch (protocol) {
      case ProtocolType.Ethereum:
        return getAddressForChain(evmAddresses, protocol, chainName);
      case ProtocolType.Sealevel:
        return getAddressForChain(solanaAddresses, protocol, chainName);
      case ProtocolType.Cosmos:
      case ProtocolType.CosmosNative:
        return getAddressForChain(cosmosAddresses, protocol, chainName);
      case ProtocolType.Starknet:
        return getAddressForChain(starknetAddresses, protocol, chainName);
      case ProtocolType.Radix:
        return getAddressForChain(radixAddresses, protocol, chainName);
      case ProtocolType.Aleo:
        return getAddressForChain(aleoAddresses, protocol, chainName);
      case ProtocolType.Tron:
        return getAddressForChain(tronAddresses, protocol, chainName);
      default:
        return undefined;
    }
  }, [
    aleoAddresses,
    chainName,
    cosmosAddresses,
    evmAddresses,
    protocol,
    radixAddresses,
    solanaAddresses,
    starknetAddresses,
    tronAddresses,
  ]);
}

function useDirectEvmBalance(chain?: ChainName, token?: IToken, address?: Address) {
  const chainMetadata = useStore((s) => (chain ? s.chainMetadata[chain] : undefined));
  const chainId =
    chainMetadata?.protocol === ProtocolType.Ethereum ? chainMetadata.chainId : undefined;
  const tokenAddress = getDirectEvmBalanceTokenAddress(token);
  const isEnabled =
    Boolean(chainId) &&
    token?.protocol === ProtocolType.Ethereum &&
    Boolean(address) &&
    isValidAddressEvm(address as Address) &&
    (token.isHypNative() || Boolean(tokenAddress));
  const normalizedAddress = isEnabled
    ? (normalizeAddress(address as Address, ProtocolType.Ethereum) as Hex)
    : undefined;
  const normalizedTokenAddress =
    isEnabled && tokenAddress
      ? (normalizeAddress(tokenAddress, ProtocolType.Ethereum) as Hex)
      : undefined;

  const { data, error, isError, isLoading } = useWagmiBalance({
    address: normalizedAddress,
    token: normalizedTokenAddress,
    chainId: isEnabled ? chainId : undefined,
    query: {
      enabled: isEnabled,
      staleTime: 30_000,
      refetchInterval: 30_000,
    },
  });

  return {
    isEnabled,
    error,
    isError,
    isLoading,
    balance: data && token ? new TokenAmount(data.value, token) : undefined,
  };
}

function getDirectEvmBalanceTokenAddress(token?: IToken): Hex | undefined {
  if (!token || token.protocol !== ProtocolType.Ethereum || token.isHypNative()) {
    return undefined;
  }

  if (LOCKBOX_STANDARDS.includes(token.standard)) {
    return undefined;
  }

  if (
    token.collateralAddressOrDenom &&
    isValidAddressEvm(token.collateralAddressOrDenom as Address)
  ) {
    return token.collateralAddressOrDenom as Hex;
  }

  if (isValidAddressEvm(token.addressOrDenom as Address)) {
    return token.addressOrDenom as Hex;
  }

  return undefined;
}

/** Returns a Map<ProtocolType, string> of all connected wallet addresses. */
function useWalletAddresses(multiProvider: MultiProtocolProvider): Map<ProtocolType, string> {
  const evmAddresses = useEthereumAccount(multiProvider).addresses;
  const solanaAddresses = useSolanaAccount(multiProvider).addresses;

  return useMemo(() => {
    const map = new Map<ProtocolType, string>();
    const evmAddress = getAddressForChain(evmAddresses, ProtocolType.Ethereum);
    const solanaAddress = getAddressForChain(solanaAddresses, ProtocolType.Sealevel);
    if (evmAddress) map.set(ProtocolType.Ethereum, evmAddress);
    if (solanaAddress) map.set(ProtocolType.Sealevel, solanaAddress);
    return map;
  }, [evmAddresses, solanaAddresses]);
}

/**
 * Batch-fetch token balances across protocols.
 * - EVM: multicall3 — one eth_call per chain
 * - Sealevel: getParsedTokenAccountsByOwner per chain
 * - Cosmos: bank.allBalances per chain (with SDK fallback for CwHypNative)
 */
export function useTokenBalances(tokens: Token[], scope: string, addressOverride?: string) {
  const multiProvider = useMultiProvider();
  const walletAddresses = useWalletAddresses(multiProvider);
  const cosmosAddresses = useCosmosAccount(multiProvider).addresses;
  const tokenKeys = useMemo(() => tokens.map((t) => getTokenKey(t)), [tokens]);

  // When an address override is provided (e.g. pasted recipient),
  // detect its protocol and use it instead of the connected wallet address
  const effectiveAddresses = useMemo(() => {
    if (!addressOverride) return walletAddresses;
    const protocol = getAddressProtocolType(addressOverride);
    if (!protocol) return walletAddresses;
    const map = new Map(walletAddresses);
    map.set(protocol, addressOverride);
    return map;
  }, [walletAddresses, addressOverride]);

  const addressEntries = useMemo(
    () => Array.from(effectiveAddresses.entries()).sort(([a], [b]) => a.localeCompare(b)),
    [effectiveAddresses],
  );

  const cosmosAddressKey = useMemo(
    () => cosmosAddresses.map((a) => `${a.chainName}:${a.address}`).sort(),
    [cosmosAddresses],
  );

  const hasAnyAddress = effectiveAddresses.size > 0 || cosmosAddresses.length > 0;

  const { data: balances = {}, isLoading } = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps -- effectiveAddresses derived from addressEntries; tokens covered by tokenKeys; multiProvider is not serializable
    queryKey: ['tokenBalances', addressEntries, cosmosAddressKey, scope, tokenKeys],
    queryFn: async (): Promise<Record<string, bigint>> => {
      const promises: Promise<Record<string, bigint>>[] = [];

      // EVM
      const evmAddr = effectiveAddresses.get(ProtocolType.Ethereum);
      if (evmAddr) {
        const { chainGroups, fallbackTokens } = groupEvmTokensByChain(tokens, multiProvider);
        for (const [chainId, group] of chainGroups) {
          promises.push(fetchChainBalances(chainId, group, multiProvider, evmAddr as Hex));
        }
        for (const { token, key } of fallbackTokens) {
          promises.push(fetchSdkBalance(token, multiProvider, evmAddr, key));
        }
      }

      // Sealevel
      const solAddr = effectiveAddresses.get(ProtocolType.Sealevel);
      if (solAddr) {
        const sealevelGroups = groupSealevelTokensByChain(tokens);
        for (const [, group] of sealevelGroups) {
          const rpcUrl = multiProvider.tryGetChainMetadata(group.chainName)?.rpcUrls?.[0]?.http;
          if (rpcUrl) {
            promises.push(fetchSealevelChainBalances(group, rpcUrl, solAddr));
          }
        }
      }

      // Cosmos — per-chain bech32 address lookup
      // addressOverride: match bech32 prefix to chain metadata to find the right chain
      const cosmosOverride = effectiveAddresses.get(ProtocolType.Cosmos);
      if (cosmosAddresses.length > 0 || cosmosOverride) {
        const cosmosGroups = groupCosmosTokensByChain(tokens);
        for (const [, group] of cosmosGroups) {
          let addr = cosmosAddresses.find((a) => a.chainName === group.chainName)?.address;
          if (!addr && cosmosOverride) {
            const chainPrefix = multiProvider.tryGetChainMetadata(group.chainName)?.bech32Prefix;
            if (chainPrefix && cosmosOverride.startsWith(chainPrefix)) addr = cosmosOverride;
          }
          if (!addr) continue;
          const rpcUrl = multiProvider.tryGetChainMetadata(group.chainName)?.rpcUrls?.[0]?.http;
          if (!rpcUrl) continue;
          promises.push(fetchCosmosChainBalances(group, rpcUrl, addr));
          for (const { token, key } of group.fallbackTokens) {
            promises.push(fetchSdkBalance(token, multiProvider, addr, key));
          }
        }
      }

      const partials = await Promise.all(promises);
      return Object.assign({}, ...partials);
    },
    enabled: tokens.length > 0 && hasAnyAddress,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  return { balances, isLoading, hasAnyAddress };
}
