import { BaseSealevelAdapter, Token, TokenStandard } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from '../../utils/logger';
import { TokenEntry, tokenKey } from './tokens';

type SealevelTokenClassification = 'spl' | 'spl2022' | 'native' | 'unknown';

interface SealevelTokenEntry extends TokenEntry {
  mintAddress: string;
}

export interface SealevelChainGroup {
  chainName: string;
  splTokens: SealevelTokenEntry[];
  spl2022Tokens: SealevelTokenEntry[];
  nativeTokens: TokenEntry[];
}

function classifySealevelToken(token: Token): {
  type: SealevelTokenClassification;
  mintAddress?: string;
} {
  const standard = token.standard as string;
  switch (standard) {
    case TokenStandard.SealevelNative:
    case TokenStandard.SealevelHypNative:
      return { type: 'native' };
    case TokenStandard.SealevelSpl:
      return { type: 'spl', mintAddress: token.addressOrDenom };
    case TokenStandard.SealevelSpl2022:
      return { type: 'spl2022', mintAddress: token.addressOrDenom };
    case TokenStandard.SealevelHypCollateral:
      return { type: 'spl', mintAddress: token.collateralAddressOrDenom };
    case TokenStandard.SealevelHypSynthetic:
      // The synthetic token mint IS the PDA at these seeds.
      // SDK's deriveMintAuthorityAccount() is misleadingly named — it returns the mint address,
      // as confirmed by its use as the `mint` arg in getAssociatedTokenAddressSync.
      return {
        type: 'spl2022',
        mintAddress: BaseSealevelAdapter.derivePda(
          ['hyperlane_token', '-', 'mint'],
          token.addressOrDenom,
        ).toBase58(),
      };
    default:
      return { type: 'unknown' };
  }
}

/** Group Sealevel tokens by chain. Unknown standards are skipped. */
export function groupSealevelTokensByChain(tokens: Token[]): Map<string, SealevelChainGroup> {
  const chainGroups = new Map<string, SealevelChainGroup>();

  for (const token of tokens) {
    if (token.protocol !== ProtocolType.Sealevel) continue;

    const key = tokenKey(token);
    const classification = classifySealevelToken(token);
    if (classification.type === 'unknown') continue;

    if (!chainGroups.has(token.chainName)) {
      chainGroups.set(token.chainName, {
        chainName: token.chainName,
        splTokens: [],
        spl2022Tokens: [],
        nativeTokens: [],
      });
    }
    const group = chainGroups.get(token.chainName)!;

    if (classification.type === 'native') {
      group.nativeTokens.push({ token, key });
    } else if (classification.type === 'spl' && classification.mintAddress) {
      group.splTokens.push({ token, key, mintAddress: classification.mintAddress });
    } else if (classification.type === 'spl2022' && classification.mintAddress) {
      group.spl2022Tokens.push({ token, key, mintAddress: classification.mintAddress });
    }
  }

  return chainGroups;
}

/**
 * Build a map from mint address -> array of token keys.
 * Multiple tokens can map to the same mint (e.g. SealevelSpl + SealevelHypCollateral wrapping same token).
 */
function buildMintToKeysMap(entries: SealevelTokenEntry[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const entry of entries) {
    const existing = map.get(entry.mintAddress);
    if (existing) {
      existing.push(entry.key);
    } else {
      map.set(entry.mintAddress, [entry.key]);
    }
  }
  return map;
}

interface ParsedTokenAccount {
  account: { data: { parsed: { info: { mint: string; tokenAmount: { amount: string } } } } };
}

function parseSplTokenAccounts(
  accounts: ParsedTokenAccount[],
  mintToKeys: Map<string, string[]>,
): Record<string, bigint> {
  const out: Record<string, bigint> = {};
  for (const { account } of accounts) {
    const info = account.data.parsed.info;
    const keys = mintToKeys.get(info.mint);
    if (!keys) continue;
    const amount = BigInt(info.tokenAmount.amount);
    for (const key of keys) {
      out[key] = amount;
    }
  }
  return out;
}

/** Fetch all SPL token balances for a single Sealevel chain via getParsedTokenAccountsByOwner. */
export async function fetchSealevelChainBalances(
  group: SealevelChainGroup,
  rpcUrl: string,
  ownerAddress: string,
): Promise<Record<string, bigint>> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const owner = new PublicKey(ownerAddress);
  const promises: Promise<Record<string, bigint>>[] = [];

  // Fetch SPL and Token-2022 accounts
  const programFetches: [Map<string, string[]>, PublicKey, string][] = [
    [buildMintToKeysMap(group.splTokens), TOKEN_PROGRAM_ID, 'SPL'],
    [buildMintToKeysMap(group.spl2022Tokens), TOKEN_2022_PROGRAM_ID, 'Token-2022'],
  ];
  for (const [mintToKeys, programId, label] of programFetches) {
    if (mintToKeys.size === 0) continue;
    promises.push(
      connection
        .getParsedTokenAccountsByOwner(owner, { programId })
        .then((result) => parseSplTokenAccounts(result.value, mintToKeys))
        .catch((err) => {
          logger.warn(`${label} fetch failed on ${group.chainName}`, err);
          return {};
        }),
    );
  }

  // Fetch native SOL balance once and assign to all native token keys
  if (group.nativeTokens.length > 0) {
    promises.push(
      connection
        .getBalance(owner)
        .then((lamports) => {
          const balance = BigInt(lamports);
          const out: Record<string, bigint> = {};
          for (const { key } of group.nativeTokens) {
            out[key] = balance;
          }
          return out;
        })
        .catch((err) => {
          logger.warn(`Native SOL balance failed on ${group.chainName}`, err);
          return {};
        }),
    );
  }

  const partials = await Promise.all(promises);
  return Object.assign({}, ...partials);
}
