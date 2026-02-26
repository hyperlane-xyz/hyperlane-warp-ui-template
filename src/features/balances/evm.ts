import { chainAddresses } from '@hyperlane-xyz/registry';
import { MultiProtocolProvider, Token } from '@hyperlane-xyz/sdk';
import { ProtocolType, normalizeAddress } from '@hyperlane-xyz/utils';
import {
  Hex,
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  http,
  multicall3Abi,
} from 'viem';
import { logger } from '../../utils/logger';
import { TokenEntry, fetchSdkBalance, tokenKey } from './tokens';

const MULTICALL3_ADDRESS = '0xca11bde05977b3631167028862be2a173976ca11' as Hex;

// Minimal ABI for HypCollateral.wrappedToken()
const wrappedTokenAbi = [
  {
    inputs: [],
    name: 'wrappedToken',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

type TokenClassification = 'erc20' | 'lockbox' | 'native' | 'unknown';

export interface ChainGroup {
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

/** Assumes EVM tokens only — callers must filter by ProtocolType.Ethereum first. */
function classifyToken(token: Token): { type: TokenClassification; erc20Address?: Hex } {
  if (token.isHypNative()) return { type: 'native' };

  const standard = token.standard;
  if (standard.includes('Lockbox')) return { type: 'lockbox' };
  if (token.collateralAddressOrDenom)
    return { type: 'erc20', erc20Address: normalizeAddress(token.collateralAddressOrDenom) as Hex };
  if (standard.includes('Synthetic'))
    return { type: 'erc20', erc20Address: normalizeAddress(token.addressOrDenom) as Hex };
  return { type: 'unknown' };
}

/**
 * Prefer the registry's batchContractAddress when available — some chains
 * (e.g. ancient8, viction) have the standard multicall3 address compromised.
 */
function getBatchAddress(chainName: string): Hex {
  const addresses = (chainAddresses as Record<string, Record<string, string>>)[chainName];
  if (addresses?.batchContractAddress) {
    return addresses.batchContractAddress.toLowerCase() as Hex;
  }
  return MULTICALL3_ADDRESS;
}

/** Group EVM tokens by chainId. Returns batched chain groups + SDK fallback for native/unknown. */
export function groupEvmTokensByChain(
  tokens: Token[],
  multiProvider: MultiProtocolProvider,
): {
  chainGroups: Map<number, ChainGroup>;
  fallbackTokens: TokenEntry[];
} {
  const chainGroups = new Map<number, ChainGroup>();
  const fallbackTokens: TokenEntry[] = [];

  for (const token of tokens) {
    if (token.protocol !== ProtocolType.Ethereum) continue;

    const key = tokenKey(token);
    const chainMeta = multiProvider.tryGetChainMetadata(token.chainName);
    if (!chainMeta?.chainId) continue;
    const chainId = Number(chainMeta.chainId);
    const classification = classifyToken(token);

    if (classification.type === 'native' || classification.type === 'unknown') {
      fallbackTokens.push({ token, key });
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

  return { chainGroups, fallbackTokens };
}

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
  });
}

interface LockboxResolution {
  resolved: CallInfo[];
  unresolvedKeys: string[];
}

/**
 * Resolve lockbox underlying ERC20 addresses via wrappedToken() multicall.
 * Returns resolved CallInfo[] for Phase 2 + keys of any unresolved lockboxes for SDK fallback.
 */
async function resolveLockboxTokens(
  client: any,
  batchAddress: Hex,
  lockboxTokens: ChainGroup['lockbox'],
  balanceOfCallData: Hex,
  chainId: number,
): Promise<LockboxResolution> {
  if (lockboxTokens.length === 0) return { resolved: [], unresolvedKeys: [] };

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
    const unresolvedKeys: string[] = [];
    for (let i = 0; i < decoded.length; i++) {
      if (decoded[i].success && decoded[i].returnData !== '0x') {
        const underlying = decodeFunctionResult({
          abi: wrappedTokenAbi,
          functionName: 'wrappedToken',
          data: decoded[i].returnData,
        });
        resolved.push({
          target: underlying,
          callData: balanceOfCallData,
          tokenKey: lockboxTokens[i].key,
        });
      } else {
        unresolvedKeys.push(lockboxTokens[i].key);
      }
    }
    return { resolved, unresolvedKeys };
  } catch (err) {
    logger.warn(`Lockbox resolution failed on chain ${chainId}`, err);
    return { resolved: [], unresolvedKeys: lockboxTokens.map((lb) => lb.key) };
  }
}

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
      });
    }
  }
}

/**
 * Fetch all ERC20 balances for a single chain via multicall3.
 * Phase 1: resolve lockbox underlying ERC20 addresses.
 * Phase 2: batch all balanceOf calls into one aggregate3.
 * Falls back to SDK getBalance() if the batch contract is unavailable.
 */
export async function fetchChainBalances(
  chainId: number,
  group: ChainGroup,
  multiProvider: MultiProtocolProvider,
  evmAddress: Hex,
): Promise<Record<string, bigint>> {
  const rpcUrl = multiProvider.tryGetChainMetadata(group.chainName)?.rpcUrls?.[0]?.http;
  if (!rpcUrl) {
    logger.warn(`No RPC URL for chain ${group.chainName}, skipping balance fetch`);
    return {};
  }

  const client = createPublicClient({ transport: http(rpcUrl) });
  const batchAddress = getBatchAddress(group.chainName);
  const balanceOfCallData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [evmAddress],
  });

  const { resolved: lockboxResolved, unresolvedKeys } = await resolveLockboxTokens(
    client,
    batchAddress,
    group.lockbox,
    balanceOfCallData,
    chainId,
  );

  const allCalls: CallInfo[] = [
    ...group.erc20.map((t) => ({
      target: t.address,
      callData: balanceOfCallData,
      tokenKey: t.key,
    })),
    ...lockboxResolved,
  ];

  // SDK fallback for lockbox tokens whose wrappedToken() couldn't be resolved
  const unresolvedFallbacks =
    unresolvedKeys.length > 0
      ? group.tokens
          .filter(({ key }) => unresolvedKeys.includes(key))
          .map(({ token, key }) => fetchSdkBalance(token, multiProvider, evmAddress, key))
      : [];

  if (allCalls.length === 0) {
    const partials = await Promise.all(unresolvedFallbacks);
    return Object.assign({}, ...partials);
  }

  try {
    const out: Record<string, bigint> = {};
    const decoded = await callAggregate3(client, batchAddress, allCalls);
    decodeBalanceResults(decoded, allCalls, out);
    const fallbackPartials = await Promise.all(unresolvedFallbacks);
    return Object.assign(out, ...fallbackPartials);
  } catch (err) {
    logger.warn(`Batch call failed on chain ${chainId}, falling back to SDK getBalance`, err);
    const partials = await Promise.all(
      group.tokens.map(({ token, key }) => fetchSdkBalance(token, multiProvider, evmAddress, key)),
    );
    return Object.assign({}, ...partials);
  }
}
