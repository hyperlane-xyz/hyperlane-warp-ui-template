// Mirrors universal-router-engine/src/api/types.ts. Drop the openapi
// extension since the UI doesn't generate spec docs.
import { z } from 'zod';

export const Address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
// Permissive token-address schema mirroring the engine's Address —
// length-bounded string so non-EVM addresses (Solana base58 mints,
// Cosmos bech32) validate. The strict EVM `Address` is still used for
// EVM execution fields like Universal Router transactions.
export const TokenAddress = z.string().min(1).max(100);
export const BigIntString = z.string().regex(/^\d+$/);
const MAX_UINT256 = 2n ** 256n - 1n;
export const PositiveBigIntString = BigIntString.refine(
  (value) => {
    if (value.length > 78) return false;
    const amount = BigInt(value);
    return amount > 0n && amount <= MAX_UINT256;
  },
  { message: 'Expected positive uint256 integer' },
);
export const Hex = z.string().regex(/^0x[0-9a-fA-F]*$/);
export const Bytes32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
// Engine validates and normalizes per destination protocol.
export const Recipient = z.string().min(1).max(100);

export const HealthResponseSchema = z.object({ ok: z.boolean() });
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ReadinessResponseSchema = z.object({
  ok: z.boolean(),
  graphReady: z.boolean(),
  graphConnections: z.number(),
  coreConfigChains: z.number(),
  chainCacheHydrated: z.boolean(),
  activeSnapshotUpdatedAt: z.string().nullable(),
  activeSnapshotAgeMs: z.number().nullable(),
  activeSnapshotExpiresAt: z.string().nullable(),
  lastRouteCacheRefreshAt: z.string().nullable(),
  lastRouteCacheRefreshStatus: z.enum(['ok', 'error']).nullable(),
});
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;

export const NativeCurrencySchema = z.object({
  name: z.string(),
  symbol: z.string(),
  decimals: z.number(),
});

export const BlockExplorerSchema = z.object({
  name: z.string(),
  url: z.string(),
  family: z.string().optional(),
});
export type BlockExplorer = z.infer<typeof BlockExplorerSchema>;

export const ChainDiscoverySchema = z.object({
  id: z.number(),
  name: z.string(),
  chainName: z.string(),
  displayName: z.string().optional(),
  displayNameShort: z.string().optional(),
  protocol: z.string(),
  nativeCurrency: NativeCurrencySchema,
  universalRouter: Address,
  // Permit2 contract the UR pulls funds through. Set as an `immutable` at
  // UR construction so it's stable per UR — sourced from /v1/chains so
  // the UI doesn't have to hardcode or read UR.PERMIT2() itself.
  // Optional until production engine redeploys with the field; the swap
  // form gates approvals on its presence so an undefined value just
  // surfaces as "Loading Permit2…" instead of crashing the chains list.
  permit2: Address.optional(),
  dex: z.string().nullable(),
  canSwap: z.boolean(),
  canExecute: z.boolean(),
  supportsNative: z.boolean(),
  gasCurrencyCoinGeckoId: z.string().optional(),
  blockExplorers: z.array(BlockExplorerSchema).optional(),
});
export type ChainDiscovery = z.infer<typeof ChainDiscoverySchema>;

export const ChainsResponseSchema = z.object({
  chains: z.array(ChainDiscoverySchema),
});
export type ChainsResponse = z.infer<typeof ChainsResponseSchema>;

export const TokenDiscoverySchema = z.object({
  chainId: z.number(),
  // Permissive: engine returns non-EVM addresses (Solana base58, Cosmos
  // bech32) for tokens on those chains.
  address: TokenAddress,
  symbol: z.string(),
  name: z.string().optional(),
  decimals: z.number().nullable(),
  isNative: z.boolean(),
  wrappedAddress: TokenAddress.optional(),
  isBridgeToken: z.boolean(),
  isPoolToken: z.boolean(),
  isUserToken: z.boolean().optional(),
  canBridge: z.boolean(),
  canSwap: z.boolean(),
  balance: BigIntString.optional(),
  bridgeSymbols: z.array(z.string()),
  warpRouteIds: z.array(z.string()),
  logoURI: z.string().optional(),
  coinGeckoId: z.string().optional(),
});
export type TokenDiscovery = z.infer<typeof TokenDiscoverySchema>;

// Engine returns two shapes for /v1/tokens:
//   ?chain=N      → { chain: ChainDiscovery, tokens: TokenDiscovery[] }
//   no params /
//   ?ids /
//   ?search       → TokenDiscovery[]  (bare array, no wrapper)
// Normalize both into { chain?, tokens } so consumers don't branch.
export const TokensResponseSchema = z
  .union([
    z.object({
      chain: ChainDiscoverySchema.nullable().optional(),
      tokens: z.array(TokenDiscoverySchema),
    }),
    z.array(TokenDiscoverySchema),
  ])
  .transform((v) => (Array.isArray(v) ? { tokens: v } : v));
export type TokensResponse = z.infer<typeof TokensResponseSchema>;

// Client-side mirror of engine's TokensQuerySchema. Branches:
//   {}                       → featured/trending list
//   { chain }                → per-chain list
//   { chain, search }        → per-chain filtered
//   { search }               → cross-chain search
//   { ids }                  → explicit lookups (max 5; mutually exclusive)
// Id format: `chainName-tokenRef`, where tokenRef is an address, denom, or
// native zero-address ref (e.g. "base-0x0000000000000000000000000000000000000000").
export interface TokensQuery {
  chain?: number;
  search?: string;
  ids?: string[];
}

// ── Quote request ──────────────────────────────────────────────────────

export const QuoteRequestSchema = z.object({
  srcChain: z.number().int().positive(),
  dstChain: z.number().int().positive(),
  srcToken: TokenAddress,
  dstToken: TokenAddress,
  amount: PositiveBigIntString,
  sender: TokenAddress,
  recipient: Recipient.optional(),
  slippageBps: z.number().int().min(0).max(10_000).optional(),
  // Optional client-supplied salt mixed into commitment hash derivation.
  // Engine generates random bytes32 if absent.
  commitmentSalt: Bytes32.optional(),
  usePermit2: z.boolean().optional(),
});
export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

// ── Quote response ─────────────────────────────────────────────────────

export const QuoteSwapStepSchema = z.object({
  type: z.literal('swap'),
  chain: z.number(),
  dex: z.string(),
  tokenIn: TokenAddress,
  tokenOut: TokenAddress,
  amountIn: BigIntString,
  amountOut: BigIntString,
  path: z.array(TokenAddress),
  poolCount: z.number(),
  minPoolTvlUsd: z.number().nullable(),
  poolAddress: z.string().optional(),
});
export type QuoteSwapStep = z.infer<typeof QuoteSwapStepSchema>;

export const QuoteBridgeStepSchema = z.object({
  type: z.literal('bridge'),
  chain: z.number(),
  destChain: z.number(),
  asset: TokenAddress,
  router: TokenAddress,
  amountIn: BigIntString,
  amountOut: BigIntString,
  bridgeSymbol: z.string().optional(),
  warpRouteId: z.string().optional(),
  fee: z.object({
    tokenFee: BigIntString,
    igpToken: Address,
    igpAmount: BigIntString,
  }),
});
export type QuoteBridgeStep = z.infer<typeof QuoteBridgeStepSchema>;

export const QuoteStepSchema = z.discriminatedUnion('type', [
  QuoteSwapStepSchema,
  QuoteBridgeStepSchema,
]);
export type QuoteStep = z.infer<typeof QuoteStepSchema>;

export const RouteAccountSchema = z.object({
  pubkey: z.string(),
  isSigner: z.boolean(),
  isWritable: z.boolean(),
});
export type RouteAccount = z.infer<typeof RouteAccountSchema>;

export const RouteTxSchema = z.object({
  // EVM: contract address + hex calldata. Solana: program id + base64 instruction data.
  to: z.string(),
  data: z.string(),
  value: BigIntString,
  accounts: z.array(RouteAccountSchema).optional(),
  additionalSigners: z.array(z.string()).optional(),
  altAddresses: z.array(z.string()).optional(),
  preInstructions: z
    .array(
      z.object({
        programId: z.string(),
        accounts: z.array(RouteAccountSchema),
        data: z.string(),
      }),
    )
    .optional(),
});
export type RouteTx = z.infer<typeof RouteTxSchema>;

export const RevealAccountSchema = z.object({
  pubkey: z.string().min(32).max(44),
  isWritable: z.boolean(),
  isSigner: z.boolean(),
});
export type RevealAccount = z.infer<typeof RevealAccountSchema>;

export const CallCommitmentBodySchema = z.object({
  commitment: Bytes32,
  originDomain: z.number(),
  data: Hex,
  salt: Bytes32,
  relayers: z.array(Bytes32),
  destinationAccount: Bytes32,
  revealAccounts: z.array(RevealAccountSchema).optional(),
});
export type CallCommitmentBody = z.infer<typeof CallCommitmentBodySchema>;

// Engine returns this on routes that need CCS coordination. Pre-built
// HTTP request — UI just fetches `${CCS_URL}${path}` with method/body.
export const CallCommitmentSchema = z.object({
  version: z.literal(1),
  commitment: Bytes32,
  hash: z.object({
    algorithm: z.literal('keccak256'),
    preimage: z.string(),
    encodedCalls: Hex.optional(),
  }),
  ccs: z.object({
    method: z.literal('POST'),
    path: z.literal('/calldata'),
    body: CallCommitmentBodySchema,
  }),
});
export type CallCommitment = z.infer<typeof CallCommitmentSchema>;

export const RouteResponseSchema = z.object({
  steps: z.array(QuoteStepSchema),
  output: BigIntString,
  outputMin: BigIntString,
  connection: z
    .object({
      symbol: z.string(),
      warpRouteId: z.string(),
    })
    .nullable(),
  gas: z.object({
    originGas: BigIntString,
    destGas: BigIntString,
  }),
  tx: RouteTxSchema.nullable(),
  callCommitment: CallCommitmentSchema.optional(),
});
export type RouteResponse = z.infer<typeof RouteResponseSchema>;

export const QuoteResponseSchema = z.object({
  routes: z.array(RouteResponseSchema),
  expiresAt: z.number(),
});
export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;
