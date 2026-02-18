import { chainAddresses } from '@hyperlane-xyz/registry';
import { IToken, MultiProtocolProvider, Token } from '@hyperlane-xyz/sdk';
import { ProtocolType, isValidAddress, normalizeAddress } from '@hyperlane-xyz/utils';
import { useAccountAddressForChain, useEthereumAccount } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'react-toastify';
import {
  Hex,
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  http,
  multicall3Abi,
} from 'viem';
import { useBalance as useWagmiBalance } from 'wagmi';
import { useToastError } from '../../components/toast/useToastError';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { TransferFormValues } from '../transfer/types';
import { useTokenByIndex } from './hooks';

export function useBalance(chain?: ChainName, token?: IToken, address?: Address) {
  const multiProvider = useMultiProvider();
  const { isLoading, isError, error, data } = useQuery({
    // The Token and Multiprovider classes are not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['useBalance', chain, address, token?.addressOrDenom],
    queryFn: () => {
      if (!chain || !token || !address || !isValidAddress(address, token.protocol)) return null;
      return token.getBalance(multiProvider, address);
    },
    refetchInterval: 30000,
  });

  useToastError(error, 'Error fetching balance');

  return {
    isLoading,
    isError,
    balance: data ?? undefined,
  };
}

export function useOriginBalance({ origin, tokenIndex }: TransferFormValues) {
  const multiProvider = useMultiProvider();
  const address = useAccountAddressForChain(multiProvider, origin);
  const token = useTokenByIndex(tokenIndex);
  return useBalance(origin, token, address);
}

export function useDestinationBalance({ destination, tokenIndex, recipient }: TransferFormValues) {
  const originToken = useTokenByIndex(tokenIndex);
  const connection = originToken?.getConnectionForChain(destination);
  return useBalance(destination, connection?.token, recipient);
}

export async function getDestinationNativeBalance(
  multiProvider: MultiProtocolProvider,
  { destination, recipient }: TransferFormValues,
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

// Default multicall3 address, deployed at the same address on most EVM chains
const MULTICALL3_ADDRESS = '0xca11bde05977b3631167028862be2a173976ca11' as Hex;

/**
 * Some chains have a custom batch contract address in the Hyperlane registry
 * (e.g. ancient8, viction) where the standard multicall3 address was compromised
 * or is unavailable. Prefer the registry's batchContractAddress when available.
 */
function getBatchAddress(chainName: string): Hex {
  const addresses = (chainAddresses as Record<string, Record<string, string>>)[chainName];
  if (addresses?.batchContractAddress) {
    return addresses.batchContractAddress.toLowerCase() as Hex;
  }
  return MULTICALL3_ADDRESS;
}

// Minimal ABI for HypCollateral.wrappedToken() — returns the underlying ERC20 address
const wrappedTokenAbi = [
  {
    inputs: [],
    name: 'wrappedToken',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

type TokenClassification = 'erc20' | 'lockbox' | 'native';

function classifyToken(token: Token): { type: TokenClassification; erc20Address?: Hex } {
  if (token.protocol !== ProtocolType.Ethereum) return { type: 'native' };
  if (token.isHypNative()) return { type: 'native' };

  const standard = token.standard as string;
  if (standard.includes('Lockbox')) return { type: 'lockbox' };
  if (token.collateralAddressOrDenom)
    return { type: 'erc20', erc20Address: normalizeAddress(token.collateralAddressOrDenom) as Hex };
  if (standard.includes('Synthetic'))
    return { type: 'erc20', erc20Address: normalizeAddress(token.addressOrDenom) as Hex };
  // Collateral without collateralAddressOrDenom — resolve via wrappedToken()
  return { type: 'lockbox' };
}

function tokenKey(token: Token): string {
  return `${token.chainName}:${normalizeAddress(token.addressOrDenom, token.protocol)}`;
}

interface CallInfo {
  target: Hex;
  callData: Hex;
  tokenKey: string;
}

/**
 * Batch-fetch EVM token balances via multicall3.aggregate3 — one eth_call per chain.
 *
 * All heavy work (classification, encoding) happens inside queryFn,
 * so the render path stays lightweight. Tokens input should be the
 * full route token set (not search-filtered) for stable query keys.
 */
export function useTokenBalances(tokens: Token[], origin: ChainName, destination: ChainName) {
  const multiProvider = useMultiProvider();
  const evmAddress = useEthereumAccount(multiProvider).addresses[0]?.address as Hex | undefined;
  const tokenKeys = useMemo(() => tokens.map((t) => tokenKey(t)), [tokens]);

  const { data: balances = {}, isLoading } = useQuery({
    queryKey: ['tokenBalances', evmAddress, origin, destination, tokenKeys],
    queryFn: async (): Promise<Record<string, bigint>> => {
      if (!evmAddress) return {};

      // Classify and group tokens by chain — all inside queryFn, not on render
      const chainGroups = new Map<
        number,
        {
          chainName: string;
          tokens: { token: Token; key: string }[];
          erc20: { address: Hex; key: string }[];
          lockbox: { routerAddress: Hex; key: string }[];
        }
      >();
      const nativeTokens: { token: Token; key: string }[] = [];

      for (const token of tokens) {
        if (token.protocol !== ProtocolType.Ethereum) continue;
        const chainMeta = multiProvider.tryGetChainMetadata(token.chainName);
        if (!chainMeta?.chainId) continue;
        const chainId = Number(chainMeta.chainId);

        if (!chainGroups.has(chainId)) {
          chainGroups.set(chainId, {
            chainName: token.chainName,
            tokens: [],
            erc20: [],
            lockbox: [],
          });
        }
        const group = chainGroups.get(chainId)!;
        const key = tokenKey(token);
        const classification = classifyToken(token);

        if (classification.type === 'erc20' && classification.erc20Address) {
          group.tokens.push({ token, key });
          group.erc20.push({ address: classification.erc20Address, key });
        } else if (classification.type === 'lockbox') {
          group.tokens.push({ token, key });
          group.lockbox.push({ routerAddress: normalizeAddress(token.addressOrDenom) as Hex, key });
        } else {
          // Native tokens are fetched separately via SDK getBalance at the bottom
          nativeTokens.push({ token, key });
        }
      }

      const results: Record<string, bigint> = {};
      const balanceOfCallData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [evmAddress],
      });

      // Run ERC20 multicall and native balance fetches in parallel — they're independent
      await Promise.all([
        ...Array.from(chainGroups.entries()).map(async ([chainId, group]) => {
          const chainMeta = multiProvider.tryGetChainMetadata(group.chainName);
          const rpcUrl = chainMeta?.rpcUrls?.[0]?.http;
          if (!rpcUrl) return;

          const client = createPublicClient({ transport: http(rpcUrl) });
          // Use registry's batchContractAddress if available (e.g. ancient8, viction
          // where standard multicall3 was compromised), otherwise default multicall3
          const batchAddress = getBatchAddress(group.chainName);

          // Phase 1: Resolve lockbox underlying ERC20 addresses via wrappedToken().
          // Lockbox tokens (e.g. EvmHypXERC20Lockbox) wrap an underlying ERC20 — we need
          // to call wrappedToken() on the router contract to discover the actual ERC20 address,
          // then balanceOf on that address in Phase 2.
          const lockboxResolved: CallInfo[] = [];
          if (group.lockbox.length > 0) {
            const resolveCallData = encodeFunctionData({
              abi: wrappedTokenAbi,
              functionName: 'wrappedToken',
            });
            try {
              const raw = await client.request({
                method: 'eth_call',
                params: [
                  {
                    to: batchAddress,
                    data: encodeFunctionData({
                      abi: multicall3Abi,
                      functionName: 'aggregate3',
                      args: [
                        group.lockbox.map((lb) => ({
                          target: lb.routerAddress,
                          allowFailure: true as const,
                          callData: resolveCallData,
                        })),
                      ],
                    }),
                  },
                  'latest',
                ],
              });
              const decoded = decodeFunctionResult({
                abi: multicall3Abi,
                functionName: 'aggregate3',
                data: raw,
              }) as Array<{ success: boolean; returnData: Hex }>;

              for (let i = 0; i < decoded.length; i++) {
                if (decoded[i].success && decoded[i].returnData !== '0x') {
                  const underlying = decodeFunctionResult({
                    abi: wrappedTokenAbi,
                    functionName: 'wrappedToken',
                    data: decoded[i].returnData,
                  }) as Hex;
                  lockboxResolved.push({
                    target: underlying,
                    callData: balanceOfCallData,
                    tokenKey: group.lockbox[i].key,
                  });
                }
              }
            } catch (err) {
              // Batch contract not deployed on this chain — skip lockbox resolution,
              // these tokens will be handled by the SDK fallback below
              logger.warn(`Lockbox resolution failed on chain ${chainId}`, err);
            }
          }

          // Phase 2: Batch all balanceOf calls (ERC20 + resolved lockbox) into one multicall3 aggregate3.
          // This is the main optimization — one single eth_call per chain instead of N individual calls.
          const allCalls: CallInfo[] = [
            ...group.erc20.map((t) => ({
              target: t.address,
              callData: balanceOfCallData,
              tokenKey: t.key,
            })),
            ...lockboxResolved,
          ];
          if (allCalls.length === 0) return;

          try {
            const raw = await client.request({
              method: 'eth_call',
              params: [
                {
                  to: batchAddress,
                  data: encodeFunctionData({
                    abi: multicall3Abi,
                    functionName: 'aggregate3',
                    args: [
                      allCalls.map((c) => ({
                        target: c.target,
                        allowFailure: true as const,
                        callData: c.callData,
                      })),
                    ],
                  }),
                },
                'latest',
              ],
            });
            const decoded = decodeFunctionResult({
              abi: multicall3Abi,
              functionName: 'aggregate3',
              data: raw,
            }) as Array<{ success: boolean; returnData: Hex }>;

            for (let i = 0; i < decoded.length; i++) {
              if (decoded[i].success && decoded[i].returnData !== '0x') {
                results[allCalls[i].tokenKey] = decodeFunctionResult({
                  abi: erc20Abi,
                  functionName: 'balanceOf',
                  data: decoded[i].returnData,
                }) as bigint;
              }
            }
          } catch (err) {
            // Batch contract unavailable on this chain. Fall back to the SDK's
            // token.getBalance() which handles all token standards correctly.
            // Runs in parallel — typically only 1-3 tokens per chain in a route.
            logger.warn(
              `Batch call failed on chain ${chainId}, falling back to SDK getBalance`,
              err,
            );
            await Promise.all(
              group.tokens.map(async ({ token, key }) => {
                try {
                  const balance = await token.getBalance(multiProvider, evmAddress);
                  results[key] = balance.amount;
                } catch (innerErr) {
                  logger.warn(`Failed to fetch balance for ${key} on chain ${chainId}`, innerErr);
                }
              }),
            );
          }
        }),
        // Native tokens (typically 0-1, uses eth_getBalance via SDK)
        ...nativeTokens.map(async ({ token, key }) => {
          try {
            const balance = await token.getBalance(multiProvider, evmAddress);
            results[key] = balance.amount;
          } catch (err) {
            logger.warn(`Failed to fetch native balance for ${key}`, err);
          }
        }),
      ]);

      return results;
    },
    enabled: tokens.length > 0 && !!evmAddress,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  return { balances, isLoading, evmAddress };
}

export { tokenKey };
