import type { Address } from 'viem';

import mainnetJson from './mainnet.json';
import { IS_TESTNET, MAINNET, NETWORK, ZERO_ADDRESS, canonicalReady, fastReady, isSet } from './network';
import { GULLY_MAINNET_PUBLIC_RPCS, GULLY_MAINNET_WALLET_RPCS, GULLY_PUBLIC_RPCS, GULLY_WALLET_RPCS, gullyRpcList } from './rpc';

export { IS_TESTNET, NETWORK };

/**
 * Chain slots: 'arbitrumsepolia' = the parent chain, 'gullychaintestnet' = Gully Chain (on mainnet: Arbitrum One and 48559).
 * Every chain the bridge knows. Keys are Hyperlane registry names (the multi-chain manifest, gully-ops
 * l3/hyperlane/multichain/routes.yaml, uses the same keys). arbitrumsepolia + gullychaintestnet are the classic pair
 * (Fast + Canonical lanes); the others reach Gully Chain through the multi-chain Hyperlane routes.
 */
export type ChainKey = 'arbitrumsepolia' | 'gullychaintestnet' | 'sepolia' | 'basesepolia' | 'bsctestnet' | 'solanadevnet';
export type Protocol = 'ethereum' | 'sealevel';

export interface ChainInfo {
  key: ChainKey;
  /** EVM chain id; for every chain here it equals the Hyperlane domain (Solana Devnet: domain 1399811151) */
  id: number;
  protocol: Protocol;
  name: string;
  short: string;
  nativeSymbol: string;
  nativeDecimals: number;
  /** RPCs the app reads from, in fallback order (first healthy wins; local builds may put a tunnel or proxy first). */
  rpcs: string[];
  /** Public RPCs handed to wallets in wallet_addEthereumChain (rpcUrls[0] is the one MetaMask uses). */
  walletRpcs: string[];
  explorer: string;
  /** explorer tx link template ({tx} is replaced); default `${explorer}/tx/{tx}` */
  txTemplate?: string;
  /** Hyperlane Mailbox. Sealevel: the mailbox program id (base58), never passed to viem. */
  mailbox: Address;
  /** Block to start scanning logs from (warp routers / bridge deployed after it). */
  fromBlock: bigint;
  /** First block of the Fast lane (warp routers deployed after it): backing history starts here. */
  fastFromBlock: bigint;
  blockSeconds: number;
  faucet?: string;
}

const env = import.meta.env;
const list = (v: string | undefined, fallback: string) =>
  (v || fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const TESTNET_CHAINS: Record<ChainKey, ChainInfo> = {
  arbitrumsepolia: {
    key: 'arbitrumsepolia',
    id: 421614,
    protocol: 'ethereum',
    name: 'Arbitrum Sepolia',
    short: 'Arb Sepolia',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    rpcs: [env.VITE_ARB_RPC || 'https://sepolia-rollup.arbitrum.io/rpc'],
    walletRpcs: ['https://sepolia-rollup.arbitrum.io/rpc'],
    explorer: 'https://sepolia.arbiscan.io',
    mailbox: '0x598facE78a4302f11E3de0bee1894Da0b2Cb71F8',
    fromBlock: 322568124n,
    fastFromBlock: 323_100_000n, // hypETH router deployed at 323103671, gETH after it
    blockSeconds: 0.25,
    faucet: 'https://www.alchemy.com/faucets/arbitrum-sepolia',
  },
  gullychaintestnet: {
    key: 'gullychaintestnet',
    id: 485590,
    protocol: 'ethereum',
    name: 'GullyChain Testnet',
    short: 'GullyChain',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    // VITE_GULLY_RPC (optional, comma-separated) goes first, then same-origin /rpc, then the public list (config/rpc.ts)
    rpcs: gullyRpcList(env.VITE_GULLY_RPC, undefined, GULLY_PUBLIC_RPCS),
    walletRpcs: [...GULLY_WALLET_RPCS],
    explorer: 'https://testnet.gullyscan.xyz',
    mailbox: '0x5b875dac092FcA7cE0DfEe8B7C1dbBD2c2a0cfDe',
    fromBlock: 0n,
    fastFromBlock: 0n,
    blockSeconds: 0.25,
    faucet: 'https://faucet.gullychain.xyz',
  },
  sepolia: {
    key: 'sepolia',
    id: 11155111,
    protocol: 'ethereum',
    name: 'Ethereum Sepolia',
    short: 'Sepolia',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    rpcs: list(env.VITE_SEPOLIA_RPC, 'https://ethereum-sepolia-rpc.publicnode.com,https://sepolia.drpc.org'),
    walletRpcs: ['https://ethereum-sepolia-rpc.publicnode.com'],
    explorer: 'https://sepolia.etherscan.io',
    mailbox: '0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766',
    fromBlock: 0n,
    fastFromBlock: 0n,
    blockSeconds: 12,
    faucet: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia',
  },
  basesepolia: {
    key: 'basesepolia',
    id: 84532,
    protocol: 'ethereum',
    name: 'Base Sepolia',
    short: 'Base Sepolia',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    rpcs: list(env.VITE_BASE_SEPOLIA_RPC, 'https://sepolia.base.org,https://base-sepolia-rpc.publicnode.com'),
    walletRpcs: ['https://sepolia.base.org'],
    explorer: 'https://sepolia.basescan.org',
    mailbox: '0x6966b0E55883d49BFB24539356a2f8A673E02039',
    fromBlock: 0n,
    fastFromBlock: 0n,
    blockSeconds: 2,
    faucet: 'https://www.alchemy.com/faucets/base-sepolia',
  },
  bsctestnet: {
    key: 'bsctestnet',
    id: 97,
    protocol: 'ethereum',
    name: 'BNB Chain Testnet',
    short: 'BNB Testnet',
    nativeSymbol: 'tBNB',
    nativeDecimals: 18,
    rpcs: list(env.VITE_BSC_TESTNET_RPC, 'https://bsc-testnet-rpc.publicnode.com,https://data-seed-prebsc-1-s1.bnbchain.org:8545'),
    walletRpcs: ['https://bsc-testnet-rpc.publicnode.com'],
    explorer: 'https://testnet.bscscan.com',
    mailbox: '0xF9F6F5646F478d5ab4e20B0F910C92F1CCC9Cc6D',
    fromBlock: 0n,
    fastFromBlock: 0n,
    blockSeconds: 3,
    faucet: 'https://www.bnbchain.org/en/testnet-faucet',
  },
  solanadevnet: {
    key: 'solanadevnet',
    id: 1399811151,
    protocol: 'sealevel',
    name: 'Solana Devnet',
    short: 'Solana',
    nativeSymbol: 'SOL',
    nativeDecimals: 9,
    rpcs: list(env.VITE_SOLANA_DEVNET_RPC, 'https://api.devnet.solana.com'),
    walletRpcs: [],
    explorer: 'https://explorer.solana.com/?cluster=devnet',
    txTemplate: 'https://explorer.solana.com/tx/{tx}?cluster=devnet',
    // mailbox program id (canonical Hyperlane registry, solanadevnet)
    mailbox: '5yM5YrrzHCrp4ZPLKN9Y2eUAqEWsTbBqaorgbngQcR54' as Address,
    fromBlock: 0n,
    fastFromBlock: 0n,
    blockSeconds: 0.4,
    faucet: 'https://faucet.solana.com',
  },
};

const mp = mainnetJson.parent;
const mc = mainnetJson.child;
/**
 * Mainnet values; an address that is not deployed yet is the zero address here and its lane is never offered.
 * Only the classic pair: the multi-chain routes are testnet-only until their mainnet routes are deployed
 * (config/multichain.ts lists none on mainnet, and REMOTE_CHAINS keeps only keys present here).
 */
const MAINNET_CHAINS = {
  arbitrumsepolia: {
    key: 'arbitrumsepolia',
    id: mp.id,
    protocol: 'ethereum',
    name: mp.name,
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    short: mp.short,
    rpcs: [env.VITE_ARB_RPC || mp.rpcs[0], ...mp.rpcs.slice(1)].filter((u, i, a) => a.indexOf(u) === i),
    walletRpcs: [...mp.walletRpcs],
    explorer: mp.explorer,
    mailbox: MAINNET.parentMailbox ?? ZERO_ADDRESS,
    fromBlock: MAINNET.parentFromBlock ?? 0n,
    fastFromBlock: MAINNET.fastFromBlock ?? 0n,
    blockSeconds: mp.blockSeconds,
  },
  gullychaintestnet: {
    key: 'gullychaintestnet',
    id: mc.id,
    protocol: 'ethereum',
    name: mc.name,
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    short: mc.short,
    // no same-origin /rpc on mainnet: on a gullychain.xyz host that path still proxies to the testnet
    rpcs: gullyRpcList(env.VITE_GULLY_RPC, undefined, GULLY_MAINNET_PUBLIC_RPCS, false),
    walletRpcs: [...GULLY_MAINNET_WALLET_RPCS],
    explorer: mc.explorer,
    mailbox: MAINNET.childMailbox ?? ZERO_ADDRESS,
    fromBlock: BigInt(mc.fromBlock),
    fastFromBlock: BigInt(mc.fastFromBlock),
    blockSeconds: mc.blockSeconds,
  },
} as Record<ChainKey, ChainInfo>;

export const CHAINS: Record<ChainKey, ChainInfo> = IS_TESTNET ? TESTNET_CHAINS : MAINNET_CHAINS;

export const PARENT: ChainKey = 'arbitrumsepolia';
export const CHILD: ChainKey = 'gullychaintestnet';

export function chainById(id: number): ChainInfo | undefined {
  return Object.values(CHAINS).find((c) => c.id === id);
}

export function isEvm(chain: ChainKey) {
  return CHAINS[chain].protocol === 'ethereum';
}

export function txUrl(chain: ChainKey, hash: string) {
  const c = CHAINS[chain];
  return c.txTemplate ? c.txTemplate.replace('{tx}', hash) : `${c.explorer}/tx/${hash}`;
}

/** Hyperlane's message explorer (shown under "Details", never on the main path). */
export function hyperlaneMessageUrl(messageId: string) {
  return `https://explorer.hyperlane.xyz/message/${messageId}`;
}

const NITRO_PRECOMPILES = {
  arbSys: '0x0000000000000000000000000000000000000064' as Address,
  nodeInterface: '0x00000000000000000000000000000000000000C8' as Address,
};

/** Arbitrum Nitro rollup bridge of GullyChain Testnet (gully-labs/arbitrum-token-bridge orbitChainsData.json). */
const TESTNET_CANONICAL = {
  inbox: '0x7B8499f1C058c9bdE2Bc9BdFEBE40364232C52B5' as Address,
  bridge: '0x2073106fd3fc844Bbde31f5Bf0BB91cf1e2d6C8A' as Address,
  outbox: '0x976C651fe5E63E45C8C28449507F51548922f68c' as Address,
  rollup: '0x85D80C06Fa5334E8Cd1C51F3F39D477E5dc35E0D' as Address,
  ...NITRO_PRECOMPILES,
  /** Parent-chain (L1 Sepolia) blocks in the challenge period; read live from the rollup when possible. */
  confirmPeriodBlocks: 150n,
  l1BlockSeconds: 12,
};

/**
 * GullyGasDrop on GullyChain (gully-ops): a small ETH drop for gas on a wallet's first bridge of a non-ETH token.
 * Not deployed yet: set VITE_GAS_DROP_ADDRESS at build time once it is. Unset = the feature is hidden.
 */
export const GAS_DROP_ADDRESS: string = (env.VITE_GAS_DROP_ADDRESS || '').trim();

/** Mainnet Nitro core on Arbitrum One: zero until launch day (mainnet.json / VITE_MAINNET_*), then the lane opens. */
const MAINNET_CANONICAL = {
  inbox: MAINNET.inbox ?? ZERO_ADDRESS,
  bridge: MAINNET.bridge ?? ZERO_ADDRESS,
  outbox: MAINNET.outbox ?? ZERO_ADDRESS,
  rollup: MAINNET.rollup ?? ZERO_ADDRESS,
  ...NITRO_PRECOMPILES,
  /** 50400 L1 blocks of 12 s = 7 days (gully-ops l3/mainnet/chain/rollup-config.json); read live from the rollup when possible. */
  confirmPeriodBlocks: MAINNET.confirmPeriodBlocks,
  l1BlockSeconds: mainnetJson.canonical.l1BlockSeconds,
};

export const CANONICAL = IS_TESTNET ? TESTNET_CANONICAL : MAINNET_CANONICAL;

/** True when every canonical-lane contract is known (always on testnet). */
export const CANONICAL_READY = IS_TESTNET || canonicalReady(MAINNET);
/** True when the mainnet Fast lane is configured (testnet: routes.json decides). */
export const MAINNET_FAST_READY = fastReady(MAINNET);
export { isSet };

export const LINKS = {
  explorer: CHAINS.gullychaintestnet.explorer,
  /** testnet only: there is no mainnet faucet (gully-ops l3/mainnet/INFRA.md), so the mainnet build links none */
  faucet: (IS_TESTNET ? 'https://faucet.gullychain.xyz' : null) as string | null,
  docs: 'https://docs.gullychain.xyz/bridging/',
  chain: 'https://gullychain.xyz',
  // design-gap audit 2026-10-29: every key Gully Chain surface one click from the bridge (footer + gc-switcher 1.7.0)
  dev: 'https://dev.gullychain.xyz/',
  chainEcosystem: 'https://gullychain.xyz/ecosystem/',
  status: 'https://status.gullylabs.xyz/',
  gullyLabs: 'https://gullylabs.xyz', // the Powered by Gully Labs badge only
  /** Every other Gully product is listed once, on the docs ecosystem page (owner rule 2026-10-29). */
  ecosystem: 'https://docs.gullychain.xyz/ecosystem/',
  telegram: 'https://t.me/GullyChain',
  discord: 'https://discord.com/invite/tY2ErsNNBp',
  x: 'https://x.com/Gully_Labs',
  hyperlane: 'https://hyperlane.xyz',
  /** Gully Chain's one Terms of Service and Privacy Policy cover the bridge; /terms and /privacy here redirect there. */
  terms: 'https://gullychain.xyz/terms',
  privacy: 'https://gullychain.xyz/privacy',
};
