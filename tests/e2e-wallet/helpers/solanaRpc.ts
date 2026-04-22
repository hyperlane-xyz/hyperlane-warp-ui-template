import type { Page, Route } from '@playwright/test';

// Solana RPC methods the warp UI and SDK balance path actually call.
//   - getParsedTokenAccountsByOwner  → balance listing for SPL/Token-2022 holders
//   - getBalance                     → native SOL lamports
//   - getAccountInfo                 → mint info lookups (isSpl2022 probe, etc.)
// The goal here is enough surface to make the origin-card balance render a
// known number; transaction signing is not exercised.

export interface SolanaSplFixture {
  // Mint base58 → owner balance in raw atoms (u64 as string to dodge Number limits).
  // One mint may be held by multiple token accounts in reality; we collapse to
  // a single synthetic account per mint/owner pair.
  balancesByMint: Record<string, string>;
  // Mark select mints as Token-2022 so the adapter takes the right program-id
  // code path. All others default to the classic SPL program.
  token2022Mints?: string[];
}

export interface InstallSolanaRpcMockOptions {
  // Optional endpoint guard. When omitted we intercept any Solana JSON-RPC
  // method regardless of host, which is safer on current main because the app
  // fans out across many provider URLs per chain.
  urlMatch?: RegExp;
  // Lamports → owner base58 → hex/decimal string. Defaults to 1 SOL for any
  // owner not listed.
  nativeLamports?: Record<string, number>;
  spl?: SolanaSplFixture;
}

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const SOL_LAMPORTS = 1_000_000_000;

export async function installSolanaRpcMock(
  page: Page,
  opts: InstallSolanaRpcMockOptions = {},
): Promise<void> {
  const urlMatch = opts.urlMatch;
  const balancesByMint = opts.spl?.balancesByMint ?? {};
  const token2022 = new Set(opts.spl?.token2022Mints ?? []);
  const nativeLamports = opts.nativeLamports ?? {};

  await page.route('**/*', async (route: Route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.continue();
    const url = req.url();
    let body: unknown;
    try {
      body = req.postDataJSON();
    } catch {
      return route.continue();
    }
    if (!body || typeof body !== 'object') return route.continue();
    const isBatch = Array.isArray(body);
    const items = isBatch ? (body as unknown[]) : [body];
    const first = items[0] as { jsonrpc?: string; method?: string };
    if (urlMatch && !urlMatch.test(url)) return route.continue();
    if (first?.jsonrpc !== '2.0') return route.continue();
    // Only claim Solana JSON-RPC methods; everything else (eth_*, cosmos REST)
    // stays on the wire or is handled by another matcher.
    if (!isSolanaMethod(first.method)) return route.continue();

    const responses = items.map((item) =>
      handleOne(item, { balancesByMint, token2022, nativeLamports }),
    );
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isBatch ? responses : responses[0]),
    });
  });
}

function isSolanaMethod(method?: string): boolean {
  if (!method) return false;
  // The Solana RPC method namespace is flat (no common prefix), so enumerate.
  return [
    'getParsedTokenAccountsByOwner',
    'getTokenAccountsByOwner',
    'getBalance',
    'getAccountInfo',
    'getMultipleAccounts',
    'getTokenAccountBalance',
    'getTokenSupply',
    'getLatestBlockhash',
    'getMinimumBalanceForRentExemption',
    'getSignatureStatuses',
    'sendTransaction',
    'getGenesisHash',
    'getHealth',
    'getEpochInfo',
    'getBlockHeight',
    'getSlot',
  ].includes(method);
}

interface HandleCtx {
  balancesByMint: Record<string, string>;
  token2022: Set<string>;
  nativeLamports: Record<string, number>;
}

function handleOne(itemUnknown: unknown, ctx: HandleCtx): unknown {
  const item = itemUnknown as { id?: unknown; method?: string; params?: unknown[] };
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id: item.id ?? null, result });
  const { method, params = [] } = item;

  switch (method) {
    case 'getBalance': {
      const owner = String(params[0] ?? '');
      const value = ctx.nativeLamports[owner] ?? SOL_LAMPORTS;
      return ok({ context: { slot: 1 }, value });
    }
    case 'getParsedTokenAccountsByOwner': {
      const owner = String(params[0] ?? '');
      const filter = params[1] as { programId?: string } | undefined;
      const programId = filter?.programId ?? TOKEN_PROGRAM_ID;
      // Return one synthetic parsed token account per mint whose program matches.
      const accounts = Object.entries(ctx.balancesByMint)
        .filter(([mint]) => {
          const isToken2022 = ctx.token2022.has(mint);
          return programId === TOKEN_2022_PROGRAM_ID ? isToken2022 : !isToken2022;
        })
        .map(([mint, amount]) => buildParsedAccount({ owner, mint, amount }));
      return ok({ context: { slot: 1 }, value: accounts });
    }
    case 'getAccountInfo': {
      // Minimal account shape — the mint-info probe in
      // SealevelTokenAdapter.isSpl2022 only checks owner program.
      const pubkey = String(params[0] ?? '');
      const owner = ctx.token2022.has(pubkey) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
      return ok({
        context: { slot: 1 },
        value: {
          lamports: 1_000_000,
          owner,
          data: ['', 'base64'],
          executable: false,
          rentEpoch: 0,
        },
      });
    }
    case 'getTokenAccountBalance': {
      // SealevelTokenAdapter.getBalance derives an ATA and calls this —
      // we don't know which mint corresponds to that ATA without replicating
      // the derivation, so return the sum of all seeded mint balances. Tests
      // stage exactly one mint at a time in practice.
      const total = Object.values(ctx.balancesByMint).reduce(
        (acc, v) => acc + BigInt(v),
        0n,
      );
      return ok({
        context: { slot: 1 },
        value: {
          amount: total.toString(),
          decimals: 6,
          uiAmount: Number(total) / 1e6,
          uiAmountString: (Number(total) / 1e6).toString(),
        },
      });
    }
    case 'getHealth':
      return ok('ok');
    case 'getBlockHeight':
    case 'getSlot':
      // Any positive integer passes the SDK's Solana health probe.
      return ok(123_456);
    case 'getGenesisHash':
      return ok('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d');
    case 'getLatestBlockhash':
      return ok({
        context: { slot: 1 },
        value: {
          blockhash: '11111111111111111111111111111111',
          lastValidBlockHeight: 1,
        },
      });
    default:
      return { jsonrpc: '2.0', id: item.id ?? null, result: null };
  }
}

function buildParsedAccount({
  owner,
  mint,
  amount,
}: {
  owner: string;
  mint: string;
  amount: string;
}): unknown {
  // Synthesize the getParsedTokenAccountsByOwner shape the SDK/app consume.
  // `pubkey` is usually the derived ATA; the reader only cares that the entry
  // is associated with this mint + has the right parsed amount, so a
  // deterministic string is fine.
  return {
    pubkey: deriveSyntheticAta(owner, mint),
    account: {
      data: {
        parsed: {
          info: {
            mint,
            owner,
            tokenAmount: {
              amount,
              decimals: 6,
              uiAmount: Number(amount) / 1e6,
              uiAmountString: (Number(amount) / 1e6).toString(),
            },
          },
          type: 'account',
        },
        program: 'spl-token',
        space: 165,
      },
      executable: false,
      lamports: 1_000_000,
      owner: TOKEN_PROGRAM_ID,
      rentEpoch: 0,
    },
  };
}

function deriveSyntheticAta(owner: string, mint: string): string {
  // Deterministic-but-fake; distinct per (owner, mint) pair, and always valid
  // base58 of reasonable length.
  const seed = (owner + mint).slice(0, 32).padEnd(32, 'x');
  return 'Mock' + seed;
}
