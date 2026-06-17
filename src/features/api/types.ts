// Mirrors universal-router-engine/src/api/types.ts. Drop the openapi
// extension since the UI doesn't generate spec docs.
import { z } from 'zod';

export const Address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
// Permissive token-address schema mirroring the engine's TokenAddress —
// length-bounded string so non-EVM addresses (Solana base58 mints,
// Cosmos bech32) validate. The strict EVM `Address` is still used for
// request-side fields like sender/recipient.
export const TokenAddress = z.string().min(1).max(100);
export const BigIntString = z.string().regex(/^\d+$/);
export const Hex = z.string().regex(/^0x[0-9a-fA-F]*$/);
// bytes20 (EVM) or bytes32 (padded EVM / non-EVM pubkey).
export const Recipient = z.string().regex(/^0x([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/);

export const HealthResponseSchema = z.object({ ok: z.boolean() });
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ReadinessResponseSchema = z.object({
  ok: z.boolean(),
  graphReady: z.boolean(),
  graphConnections: z.number(),
  coreConfigChains: z.number(),
  chainCacheHydrated: z.boolean(),
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
  canBridge: z.boolean(),
  canSwap: z.boolean(),
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
// Id format: `chainName-symbol` (e.g. "ethereum-USDC").
export interface TokensQuery {
  chain?: number;
  search?: string;
  ids?: string[];
}

// ── Quote request ──────────────────────────────────────────────────────

export const QuoteRequestSchema = z.object({
  srcChain: z.number(),
  dstChain: z.number(),
  srcToken: Address,
  dstToken: Address,
  amount: BigIntString,
  sender: Address,
  recipient: Recipient.optional(),
  slippageBps: z.number().optional(),
  // Optional client-supplied salt mixed into commitment hash derivation.
  // Engine generates random bytes32 if absent.
  commitmentSalt: Hex.optional(),
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
  minPoolTvlUsd: z.number().nullable().optional(),
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

export const RouteTxSchema = z.object({
  // EVM: 0x-hex contract address; Solana: base58 programId
  to: z.string().min(1).max(100),
  // EVM: 0x-hex calldata; Solana: base64 instruction data
  data: z.string().min(0),
  value: BigIntString,
  // Solana-only: accounts array for the instruction
  accounts: z
    .array(z.object({ pubkey: z.string(), isSigner: z.boolean(), isWritable: z.boolean() }))
    .optional(),
  // Solana-only: ephemeral keypairs that must co-sign before sending to wallet.
  // Each is a base64-encoded 64-byte Solana keypair (privKey[32] || pubKey[32]).
  additionalSigners: z.array(z.string()).optional(),
  // Solana-only: Address Lookup Table addresses for V0 transactions.
  altAddresses: z.array(z.string()).optional(),
  // Solana-only: instructions to prepend before the main UR instruction.
  // Used for compute budget and idempotent ATA creation.
  preInstructions: z
    .array(
      z.object({
        programId: z.string(),
        accounts: z.array(
          z.object({ pubkey: z.string(), isSigner: z.boolean(), isWritable: z.boolean() }),
        ),
        data: z.string(), // base64-encoded instruction data
      }),
    )
    .optional(),
});
export type RouteTx = z.infer<typeof RouteTxSchema>;

// CCS payload — engine assembles it server-side. Client just POSTs.
// Mirror of `PostCallsSchema` from @hyperlane-xyz/sdk.
export const ICACallSchema = z.object({
  to: z.string().regex(/^0x[0-9a-fA-F]{64}$/), // bytes32
  value: BigIntString,
  data: Hex,
});
export type ICACall = z.infer<typeof ICACallSchema>;

export const CallCommitmentBodySchema = z.object({
  calls: z.array(ICACallSchema),
  relayers: z.array(Address),
  salt: Hex,
  userSalt: Hex,
  originDomain: z.number(),
  destinationDomain: z.number(),
  owner: Address,
  ismOverride: Address.optional(),
  localRouter: Hex.optional(),
});
export type CallCommitmentBody = z.infer<typeof CallCommitmentBodySchema>;

// Engine returns this on routes that need CCS coordination. Pre-built
// HTTP request — UI just fetches `${CCS_URL}${path}` with method/body.
export const CallCommitmentSchema = z.object({
  version: z.literal(1),
  commitment: Hex,
  hash: z.object({
    algorithm: z.literal('keccak256'),
    preimage: z.string(),
    encodedCalls: Hex,
  }),
  ccs: z.object({
    method: z.literal('POST'),
    path: z.string(),
    body: CallCommitmentBodySchema,
  }),
});
export type CallCommitment = z.infer<typeof CallCommitmentSchema>;

export const SolanaCommitmentSchema = z.object({
  version: z.literal(1),
  commitment: Hex,
  hash: z.object({
    algorithm: z.literal('keccak256'),
    preimage: z.string(),
  }),
  ccs: z.object({
    method: z.literal('POST'),
    path: z.string(),
    body: z.object({
      commitment: Hex,
      calldata: Hex,
      destinationDomain: z.number(),
      encoding: z.string(),
      revealSalt: Hex,
      userSalt: Hex,
    }),
  }),
});
export type SolanaCommitment = z.infer<typeof SolanaCommitmentSchema>;

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
  solanaCommitment: SolanaCommitmentSchema.optional(),
});
export type RouteResponse = z.infer<typeof RouteResponseSchema>;

export const QuoteResponseSchema = z.object({
  routes: z.array(RouteResponseSchema),
  expiresAt: z.number(),
});
export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;
