import type { Page, Route } from '@playwright/test';
import { MOCK_EVM_ADDRESS } from './constants';
import type { CapturedEvmTx } from './types';

const FAKE_TX_HASH = ('0x' + 'ee'.repeat(32)) as `0x${string}`;
const ONE_ETH_HEX = '0xde0b6b3a7640000';
const DEFAULT_GAS_PRICE = '0x3b9aca00'; // 1 gwei
const DEFAULT_BLOCK_HEX = '0x12345';
const MAX_UINT256 = '0x' + 'f'.repeat(64);

export interface ChainUrlMatcher {
  chainId: number;
  urlMatch: RegExp;
}

export interface Erc20Fixture {
  decimals?: number;
  symbol?: string;
  // Owner address → hex balance (padded or not).
  balances?: Record<string, string>;
  // Fallback balance for any owner not in `balances`. Lets tests seed a
  // blanket "router holds enough collateral" without needing to know each
  // warp-route's router address.
  defaultBalance?: string;
  // Max by default; override to force approval flow.
  allowance?: string;
}

export interface InstallEvmRpcMockOptions {
  // Maps chain RPC URL patterns → chainId. First match wins.
  chainUrlMap?: ChainUrlMatcher[];
  // ERC20 fixtures by contract address (lowercased, no 0x stripped).
  // chainId-aware key: `${chainId}:${contractLower}`.
  // `*` is a wildcard fallback for any otherwise-unmatched ERC20 contract.
  erc20?: Record<string, Erc20Fixture>;
  // Native balance per owner (hex). Defaults to 1 ETH for any address.
  nativeBalances?: Record<string, string>;
  // Hyperlane HypCollateral routers call `wrappedToken()` to discover the
  // underlying ERC20. Mock returns this address per chainId.
  wrappedTokenByChainId?: Record<number, string>;
  // routers(uint32) result keyed by remote domain. Falls back to a
  // deterministic address derived from the requested domain.
  routerByDomain?: Record<number, string>;
}

export interface EvmRpcMockHandle {
  txs: CapturedEvmTx[];
  resolveChainId: (url: string) => number | undefined;
}

export async function installEvmRpcMock(
  page: Page,
  opts: InstallEvmRpcMockOptions = {},
): Promise<EvmRpcMockHandle> {
  const txs: CapturedEvmTx[] = [];
  const erc20 = opts.erc20 ?? {};
  const chainUrlMap = opts.chainUrlMap ?? [];

  const resolveChainId = (url: string): number | undefined =>
    chainUrlMap.find((m) => m.urlMatch.test(url))?.chainId;

  await page.route('**/*', async (route: Route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.continue();
    let body: unknown;
    try {
      body = req.postDataJSON();
    } catch {
      return route.continue();
    }
    if (!body || typeof body !== 'object') return route.continue();
    const isBatch = Array.isArray(body);
    const items = isBatch ? (body as unknown[]) : [body];
    const firstItem = items[0] as { jsonrpc?: string; method?: string };
    if (!firstItem?.jsonrpc) return route.continue();
    // Only handle EVM-shaped JSON-RPC. Solana RPC also uses JSON-RPC over
    // POST (getBalance/getTokenAccountsByOwner/…), so without this guard
    // we'd return eth_* shaped responses to Solana calls.
    const method = firstItem.method ?? '';
    const isEvmMethod =
      method.startsWith('eth_') ||
      method.startsWith('net_') ||
      method.startsWith('wallet_') ||
      method.startsWith('web3_');
    if (!isEvmMethod) return route.continue();

    const url = req.url();
    const chainId = resolveChainId(url);
    const responses = items.map((item) => handleOne(item, { url, chainId, erc20, opts, txs }));
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isBatch ? responses : responses[0]),
    });
  });

  return { txs, resolveChainId };
}

interface HandleCtx {
  url: string;
  chainId: number | undefined;
  erc20: Record<string, Erc20Fixture>;
  opts: InstallEvmRpcMockOptions;
  txs: CapturedEvmTx[];
}

function handleOne(itemUnknown: unknown, ctx: HandleCtx): unknown {
  const item = itemUnknown as { id?: unknown; method?: string; params?: unknown[] };
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id: item.id ?? null, result });
  const fail = (message: string) => ({
    jsonrpc: '2.0',
    id: item.id ?? null,
    error: { code: -32601, message },
  });

  const { method, params = [] } = item;
  const chainIdHex = ctx.chainId !== undefined ? `0x${ctx.chainId.toString(16)}` : '0x1';

  switch (method) {
    case 'eth_chainId':
      return ok(chainIdHex);
    case 'net_version':
      return ok(String(ctx.chainId ?? 1));
    case 'eth_blockNumber':
      return ok(DEFAULT_BLOCK_HEX);
    case 'eth_getBlockByNumber':
    case 'eth_getBlockByHash':
      // Ethers v5 parses every hash field via isHexString(value, 32) and throws
      // "invalid hash" on undefined — include every hash-shaped field so fee
      // resolution in the Hyperlane SDK path works end-to-end.
      return ok({
        number: DEFAULT_BLOCK_HEX,
        hash: '0x' + '1'.repeat(64),
        parentHash: '0x' + '2'.repeat(64),
        sha3Uncles: '0x' + '3'.repeat(64),
        stateRoot: '0x' + '4'.repeat(64),
        transactionsRoot: '0x' + '5'.repeat(64),
        receiptsRoot: '0x' + '6'.repeat(64),
        mixHash: '0x' + '7'.repeat(64),
        logsBloom: '0x' + '0'.repeat(512),
        difficulty: '0x0',
        totalDifficulty: '0x0',
        extraData: '0x',
        size: '0x1000',
        gasLimit: '0x1c9c380',
        gasUsed: '0x0',
        timestamp: '0x65000000',
        uncles: [],
        nonce: '0x0000000000000000',
        miner: '0x' + '0'.repeat(40),
        baseFeePerGas: DEFAULT_GAS_PRICE,
        transactions: [],
      });
    case 'eth_gasPrice':
    case 'eth_maxPriorityFeePerGas':
      return ok(DEFAULT_GAS_PRICE);
    case 'eth_feeHistory':
      return ok({
        oldestBlock: DEFAULT_BLOCK_HEX,
        baseFeePerGas: [DEFAULT_GAS_PRICE, DEFAULT_GAS_PRICE],
        gasUsedRatio: [0.5],
        reward: [['0x0']],
      });
    case 'eth_estimateGas':
      return ok('0x186a0');
    case 'eth_getBalance': {
      const addr = String(params[0] ?? '').toLowerCase();
      return ok(ctx.opts.nativeBalances?.[addr] ?? ONE_ETH_HEX);
    }
    case 'eth_call':
      return ok(handleEthCall(params[0] as { to?: string; data?: string }, ctx));
    case 'eth_sendTransaction':
    case 'eth_sendRawTransaction': {
      if (method === 'eth_sendTransaction') {
        const tx = params[0] as {
          to?: `0x${string}`;
          data?: `0x${string}`;
          value?: string;
          from?: `0x${string}`;
        };
        ctx.txs.push({
          chainId: ctx.chainId ?? 0,
          to: tx?.to,
          data: tx?.data,
          value: tx?.value,
          from: tx?.from,
        });
      }
      return ok(FAKE_TX_HASH);
    }
    case 'eth_getTransactionReceipt':
      return ok({
        status: '0x1',
        transactionHash: params[0],
        blockNumber: DEFAULT_BLOCK_HEX,
        blockHash: '0x' + '1'.repeat(64),
        from: MOCK_EVM_ADDRESS.toLowerCase(),
        to: '0x' + '0'.repeat(40),
        gasUsed: '0x186a0',
        cumulativeGasUsed: '0x186a0',
        effectiveGasPrice: DEFAULT_GAS_PRICE,
        logs: [],
        logsBloom: '0x' + '0'.repeat(512),
        type: '0x2',
        contractAddress: null,
      });
    case 'eth_getTransactionByHash':
      return ok({
        hash: params[0],
        blockNumber: DEFAULT_BLOCK_HEX,
        blockHash: '0x' + '1'.repeat(64),
        transactionIndex: '0x0',
        from: MOCK_EVM_ADDRESS.toLowerCase(),
        to: '0x' + '0'.repeat(40),
        value: '0x0',
        gas: '0x186a0',
        gasPrice: DEFAULT_GAS_PRICE,
        nonce: '0x0',
        input: '0x',
        type: '0x2',
      });
    case 'eth_getCode':
      return ok('0x');
    case 'eth_getTransactionCount':
      return ok('0x0');
    case 'web3_clientVersion':
      return ok('warp-e2e-mock/1.0');
    default:
      return fail(`Method not mocked: ${method}`);
  }
}

function handleEthCall(call: { to?: string; data?: string }, ctx: HandleCtx): string {
  const to = (call.to ?? '').toLowerCase();
  const data = call.data ?? '0x';
  const erc20Key = `${ctx.chainId ?? '?'}:${to}`;
  const erc20Fixture = ctx.erc20[erc20Key] ?? ctx.erc20[to] ?? ctx.erc20['*'];

  // ERC20 balanceOf(address)
  if (data.startsWith('0x70a08231')) {
    const owner = ('0x' + data.slice(34, 74)).toLowerCase();
    const direct = erc20Fixture?.balances?.[owner];
    if (direct !== undefined) return padHex(direct);
    if (erc20Fixture?.defaultBalance !== undefined) return padHex(erc20Fixture.defaultBalance);
    return padHex('0x0');
  }
  // ERC20 allowance(address,address)
  if (data.startsWith('0xdd62ed3e')) {
    return padHex(erc20Fixture?.allowance ?? MAX_UINT256);
  }
  // decimals()
  if (data.startsWith('0x313ce567')) {
    return padHex('0x' + (erc20Fixture?.decimals ?? 18).toString(16));
  }
  // symbol()
  if (data.startsWith('0x95d89b41')) {
    return encodeString(erc20Fixture?.symbol ?? 'TEST');
  }
  // Hyperlane router probes — without these the SDK throws during
  // warpCore.getTransferRemoteTxs / estimateTransferRemoteFees (semver parse).

  // PACKAGE_VERSION() — string; "6.0.0" passes all compareVersions gates.
  if (data.startsWith('0x93c44847')) return encodeString('6.0.0');
  // wrappedToken() — Hyperlane HypCollateral queries this to discover the
  // underlying ERC20 before calling balanceOf. Must return a real address,
  // otherwise the SDK reads balanceOf on 0x0 and the collateral check fails.
  if (data.startsWith('0x996c6cc3')) {
    const perChain = ctx.opts.wrappedTokenByChainId?.[ctx.chainId ?? -1];
    if (perChain) return padHex(perChain);
    return padHex('0x0');
  }
  // Other address-returning probes (mailbox, owner, feeRecipient, hook, ISM).
  if (
    data.startsWith('0xd5438eae') ||
    data.startsWith('0x8da5cb5b') ||
    data.startsWith('0x46904840') ||
    data.startsWith('0x7f5a7c7b') ||
    data.startsWith('0xde523cf3')
  ) {
    return padHex('0x0');
  }
  // quoteGasPayment(uint32) / destinationGas(uint32) — uint256, 0 is a fine default.
  if (data.startsWith('0xf2ed8c53') || data.startsWith('0x775313a1')) return padHex('0x0');
  // routers(uint32) — bytes32 router address on remote domain.
  if (data.startsWith('0x2ead72f6')) {
    const domain = readUint32Arg(data);
    const router =
      domain == null
        ? '0x' + 'a'.repeat(40)
        : (ctx.opts.routerByDomain?.[domain] ??
          `0x${domain.toString(16).padStart(40, '0')}`);
    return padHex(router);
  }
  // domains() — uint32[]; empty array works (SDK has .catch fallback).
  if (data.startsWith('0x440df4f4')) return '0x' + '20'.padStart(64, '0') + '0'.repeat(64);
  // Multicall3 aggregate3 — empty Result[] forces SDK to use individual getBalance calls.
  if (data.startsWith('0x82ad56cb')) return '0x' + '20'.padStart(64, '0') + '0'.repeat(64);

  return '0x' + '0'.repeat(64);
}

function padHex(hex: string): string {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex;
  return '0x' + stripped.padStart(64, '0');
}

function encodeString(s: string): string {
  const bytes = Array.from(new TextEncoder().encode(s))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const len = s.length.toString(16).padStart(64, '0');
  const offset = '20'.padStart(64, '0');
  const padded = (bytes + '0'.repeat(64)).slice(0, Math.ceil(bytes.length / 64) * 64 || 64);
  return '0x' + offset + len + padded;
}

function readUint32Arg(data: string): number | undefined {
  const word = data.slice(10, 74);
  if (word.length !== 64) return undefined;
  return Number.parseInt(word.slice(56), 16);
}
