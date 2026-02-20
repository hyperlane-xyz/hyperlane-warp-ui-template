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

// ─── Constants & ABIs ────────────────────────────────────────────────────────

// Default multicall3 address, deployed at the same address on most EVM chains
const MULTICALL3_ADDRESS = '0xca11bde05977b3631167028862be2a173976ca11' as Hex;

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

// ─── Types ───────────────────────────────────────────────────────────────────

type TokenClassification = 'erc20' | 'lockbox' | 'native' | 'unknown';

interface TokenEntry {
  token: Token;
  key: string;
}

interface ChainGroup {
  chainName: string;
  tokens: TokenEntry[];
  erc20: { address: Hex; key: string }[];
  lockbox: { routerAddress: Hex; key: string }[];
}

interface CallInfo {
  target: Hex;
  callData: Hex;
  tokenKey: string;
}

type Aggregate3Result = Array<{ success: boolean; returnData: Hex }>;

// ─── Pure helpers ────────────────────────────────────────────────────────────

function tokenKey(token: Token): string {
  return `${token.chainName}-${normalizeAddress(token.addressOrDenom, token.protocol)}-${token.symbol}`;
}

function classifyToken(token: Token): { type: TokenClassification; erc20Address?: Hex } {
  if (token.protocol !== ProtocolType.Ethereum) return { type: 'native' };
  if (token.isHypNative()) return { type: 'native' };

  const standard = token.standard as string;
  if (standard.includes('Lockbox')) return { type: 'lockbox' };
  if (token.collateralAddressOrDenom)
    return { type: 'erc20', erc20Address: normalizeAddress(token.collateralAddressOrDenom) as Hex };
  if (standard.includes('Synthetic'))
    return { type: 'erc20', erc20Address: normalizeAddress(token.addressOrDenom) as Hex };
  // Unrecognized token type — fall back to SDK getBalance()
  return { type: 'unknown' };
}

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

// ─── Token grouping ──────────────────────────────────────────────────────────

/** Classify tokens and group by EVM chain. Non-EVM / native / unknown tokens use SDK fallback. */
function groupTokensByChain(
  tokens: Token[],
  multiProvider: MultiProtocolProvider,
): { chainGroups: Map<number, ChainGroup>; sdkFallbackTokens: TokenEntry[] } {
  const chainGroups = new Map<number, ChainGroup>();
  const sdkFallbackTokens: TokenEntry[] = [];

  for (const token of tokens) {
    if (token.protocol !== ProtocolType.Ethereum) continue;
    const chainMeta = multiProvider.tryGetChainMetadata(token.chainName);
    if (!chainMeta?.chainId) continue;
    const chainId = Number(chainMeta.chainId);

    const key = tokenKey(token);
    const classification = classifyToken(token);

    // Native and unknown tokens use SDK getBalance() individually
    if (classification.type === 'native' || classification.type === 'unknown') {
      sdkFallbackTokens.push({ token, key });
      continue;
    }

    if (!chainGroups.has(chainId)) {
      chainGroups.set(chainId, { chainName: token.chainName, tokens: [], erc20: [], lockbox: [] });
    }
    const group = chainGroups.get(chainId)!;
    group.tokens.push({ token, key });

    if (classification.type === 'erc20' && classification.erc20Address) {
      group.erc20.push({ address: classification.erc20Address, key });
    } else {
      group.lockbox.push({ routerAddress: normalizeAddress(token.addressOrDenom) as Hex, key });
    }
  }

  return { chainGroups, sdkFallbackTokens };
}

// ─── RPC helpers ─────────────────────────────────────────────────────────────

/** Send a multicall3 aggregate3 batch via a single eth_call. */
async function callAggregate3(
  client: any, // ReturnType<typeof createPublicClient> triggers TS2589
  batchAddress: Hex,
  calls: Array<{ target: Hex; callData: Hex }>,
): Promise<Aggregate3Result> {
  const raw = await client.request({
    method: 'eth_call',
    params: [
      {
        to: batchAddress,
        data: encodeFunctionData({
          abi: multicall3Abi,
          functionName: 'aggregate3',
          args: [
            calls.map((c) => ({
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
  return decodeFunctionResult({
    abi: multicall3Abi,
    functionName: 'aggregate3',
    data: raw,
  }) as Aggregate3Result;
}

/** Fetch a single token balance via SDK fallback. */
async function fetchSdkBalance(
  token: Token,
  multiProvider: MultiProtocolProvider,
  address: string,
  out: Record<string, bigint>,
  key: string,
) {
  try {
    const balance = await token.getBalance(multiProvider, address);
    out[key] = balance.amount;
  } catch (err) {
    logger.warn(`Failed to fetch balance for ${key}`, err);
  }
}

/**
 * Resolve lockbox underlying ERC20 addresses via wrappedToken() multicall.
 * Returns CallInfo[] ready for Phase 2 balanceOf batching.
 */
async function resolveLockboxTokens(
  client: any,
  batchAddress: Hex,
  lockboxTokens: ChainGroup['lockbox'],
  balanceOfCallData: Hex,
  chainId: number,
): Promise<CallInfo[]> {
  if (lockboxTokens.length === 0) return [];

  const resolveCallData = encodeFunctionData({
    abi: wrappedTokenAbi,
    functionName: 'wrappedToken',
  });
  try {
    const decoded = await callAggregate3(
      client,
      batchAddress,
      lockboxTokens.map((lb) => ({ target: lb.routerAddress, callData: resolveCallData })),
    );
    const resolved: CallInfo[] = [];
    for (let i = 0; i < decoded.length; i++) {
      if (decoded[i].success && decoded[i].returnData !== '0x') {
        const underlying = decodeFunctionResult({
          abi: wrappedTokenAbi,
          functionName: 'wrappedToken',
          data: decoded[i].returnData,
        }) as Hex;
        resolved.push({
          target: underlying,
          callData: balanceOfCallData,
          tokenKey: lockboxTokens[i].key,
        });
      }
    }
    return resolved;
  } catch (err) {
    // Batch contract not deployed — these tokens fall back to SDK in the caller
    logger.warn(`Lockbox resolution failed on chain ${chainId}`, err);
    return [];
  }
}

/** Decode successful balanceOf results from an aggregate3 response into `out`. */
function decodeBalanceResults(
  decoded: Aggregate3Result,
  calls: CallInfo[],
  out: Record<string, bigint>,
) {
  for (let i = 0; i < decoded.length; i++) {
    if (decoded[i].success && decoded[i].returnData !== '0x') {
      out[calls[i].tokenKey] = decodeFunctionResult({
        abi: erc20Abi,
        functionName: 'balanceOf',
        data: decoded[i].returnData,
      }) as bigint;
    }
  }
}

/**
 * Fetch all ERC20 balances for a single chain via multicall3.
 * Phase 1: resolve lockbox underlying ERC20 addresses.
 * Phase 2: batch all balanceOf calls into one aggregate3.
 * Falls back to SDK getBalance() if the batch contract is unavailable.
 */
async function fetchChainBalances(
  chainId: number,
  group: ChainGroup,
  multiProvider: MultiProtocolProvider,
  evmAddress: Hex,
  out: Record<string, bigint>,
) {
  const chainMeta = multiProvider.tryGetChainMetadata(group.chainName);
  const rpcUrl = chainMeta?.rpcUrls?.[0]?.http;
  if (!rpcUrl) return;

  const client = createPublicClient({ transport: http(rpcUrl) });
  const batchAddress = getBatchAddress(group.chainName);
  const balanceOfCallData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [evmAddress],
  });

  // Phase 1: resolve lockbox wrappedToken() addresses
  const lockboxResolved = await resolveLockboxTokens(
    client,
    batchAddress,
    group.lockbox,
    balanceOfCallData,
    chainId,
  );

  // Phase 2: batch all balanceOf calls (direct ERC20 + resolved lockbox)
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
    const decoded = await callAggregate3(client, batchAddress, allCalls);
    decodeBalanceResults(decoded, allCalls, out);
  } catch (err) {
    // Batch contract unavailable — fall back to SDK getBalance() per token
    logger.warn(`Batch call failed on chain ${chainId}, falling back to SDK getBalance`, err);
    await Promise.all(
      group.tokens.map(({ token, key }) =>
        fetchSdkBalance(token, multiProvider, evmAddress, out, key),
      ),
    );
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

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
    // Token and MultiProvider classes are not serializable — tokenKeys covers token identity
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['tokenBalances', evmAddress, origin, destination, tokenKeys],
    queryFn: async (): Promise<Record<string, bigint>> => {
      if (!evmAddress) return {};

      const { chainGroups, sdkFallbackTokens } = groupTokensByChain(tokens, multiProvider);
      const results: Record<string, bigint> = {};

      await Promise.all([
        ...Array.from(chainGroups.entries()).map(([chainId, group]) =>
          fetchChainBalances(chainId, group, multiProvider, evmAddress, results),
        ),
        ...sdkFallbackTokens.map(({ token, key }) =>
          fetchSdkBalance(token, multiProvider, evmAddress, results, key),
        ),
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
