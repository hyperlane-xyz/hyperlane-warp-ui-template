import { IToken, MultiProtocolProvider, Token } from '@hyperlane-xyz/sdk';
import { ProtocolType, isValidAddress } from '@hyperlane-xyz/utils';
import {
  useAccountAddressForChain,
  useEthereumAccount,
  useSolanaAccount,
} from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'react-toastify';
import { Hex } from 'viem';
import { useBalance as useWagmiBalance } from 'wagmi';
import { useToastError } from '../../components/toast/useToastError';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { fetchChainBalances, groupEvmTokensByChain } from './evm';
import { fetchSealevelChainBalances, groupSealevelTokensByChain } from './svm';
import { fetchSdkBalance, tokenKey } from './tokens';

export function useBalance(chain?: ChainName, token?: IToken, address?: Address) {
  const multiProvider = useMultiProvider();
  const { isLoading, isError, error, data } = useQuery({
    // The Token and Multiprovider classes are not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: [
      'useBalance',
      chain,
      address,
      token?.addressOrDenom,
      token?.collateralAddressOrDenom,
    ],
    queryFn: () => {
      if (!chain || !token || !address || !isValidAddress(address, token.protocol)) return null;
      return token.getBalance(multiProvider, address);
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  useToastError(error, 'Error fetching balance');

  return {
    isLoading,
    isError,
    balance: data ?? undefined,
  };
}

export function useOriginBalance(originToken?: Token) {
  const multiProvider = useMultiProvider();
  const origin = originToken?.chainName;
  const address = useAccountAddressForChain(multiProvider, origin);
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
  const address = useAccountAddressForChain(multiProvider, chainName);
  const allowRefetch = Boolean(address) && refetchEnabled;

  const { data, isError, isLoading } = useWagmiBalance({
    address: address ? (address as Hex) : undefined,
    token: token ? (token as Hex) : undefined,
    chainId: chainId,
    query: {
      refetchInterval: allowRefetch ? 5000 : false,
      enabled: allowRefetch,
    },
  });

  return { balance: data, isError, isLoading };
}

/** Returns a Map<ProtocolType, string> of all connected wallet addresses. */
function useWalletAddresses(multiProvider: MultiProtocolProvider): Map<ProtocolType, string> {
  const evmAddress = useEthereumAccount(multiProvider).addresses[0]?.address;
  const solanaAddress = useSolanaAccount(multiProvider).addresses[0]?.address;

  return useMemo(() => {
    const map = new Map<ProtocolType, string>();
    if (evmAddress) map.set(ProtocolType.Ethereum, evmAddress);
    if (solanaAddress) map.set(ProtocolType.Sealevel, solanaAddress);
    return map;
  }, [evmAddress, solanaAddress]);
}

/**
 * Batch-fetch token balances for EVM and Sealevel protocols.
 * - EVM: multicall3.aggregate3 — one eth_call per chain
 * - Sealevel: getParsedTokenAccountsByOwner — 2-3 RPC calls per SVM chain
 * - Other VMs are not supported and silently skipped.
 */
export function useTokenBalances(tokens: Token[], scope: string, addressOverride?: string) {
  const multiProvider = useMultiProvider();
  const walletAddresses = useWalletAddresses(multiProvider);
  const tokenKeys = useMemo(() => tokens.map((t) => tokenKey(t)), [tokens]);

  // When an address override is provided (e.g. pasted recipient),
  // detect its protocol and use it instead of the connected wallet address
  const effectiveAddresses = useMemo(() => {
    if (!addressOverride) return walletAddresses;
    const map = new Map(walletAddresses);
    if (isValidAddress(addressOverride, ProtocolType.Ethereum)) {
      map.set(ProtocolType.Ethereum, addressOverride);
    }
    if (isValidAddress(addressOverride, ProtocolType.Sealevel)) {
      map.set(ProtocolType.Sealevel, addressOverride);
    }
    return map;
  }, [walletAddresses, addressOverride]);

  const addressEntries = useMemo(
    () => Array.from(effectiveAddresses.entries()).sort(([a], [b]) => a.localeCompare(b)),
    [effectiveAddresses],
  );

  const { data: balances = {}, isLoading } = useQuery({
    queryKey: ['tokenBalances', addressEntries, scope, tokenKeys],
    queryFn: async (): Promise<Record<string, bigint>> => {
      const promises: Promise<Record<string, bigint>>[] = [];

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

      const partials = await Promise.all(promises);
      return Object.assign({}, ...partials);
    },
    enabled: tokens.length > 0 && effectiveAddresses.size > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  return { balances, isLoading, hasAnyAddress: effectiveAddresses.size > 0 };
}
