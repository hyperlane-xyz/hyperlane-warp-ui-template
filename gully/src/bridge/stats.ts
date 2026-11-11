// Live bridge analytics, read from chain events only (no indexer has bridge data yet). About 12 eth_getLogs plus
// a few reads per refresh, batched; block timestamps are cached, so a refresh costs well under the public RPC limits.
import { keccak256, parseAbiItem, type Address, type Hash, type Hex } from 'viem';

import { CANONICAL, CHAINS, CHILD, PARENT, type ChainKey } from '../config/chains';
import { FAST_ROUTES } from '../config/routes';
import { inboxMessageDeliveredEvent, l2ToL1TxEvent, messageDeliveredEvent, outboxAbi, receivedTransferEvent, sentTransferEvent, warpRouterAbi } from './abis';
import { pub } from './clients';
import { confirmedSendCount, depositTxId, withdrawEtaSeconds } from './localClient';
import type { Direction, RouteKind } from './types';

const dispatchEvent = parseAbiItem(
  'event Dispatch(address indexed sender, uint32 indexed destination, bytes32 indexed recipient, bytes message)',
);
const processIdEvent = parseAbiItem('event ProcessId(bytes32 indexed messageId)');

export const WINDOW_HOURS = 48;

export interface StatTransfer {
  kind: RouteKind;
  direction: Direction;
  amount: bigint;
  time: number; // ms
  deliverySec?: number;
  delivered: boolean;
}

export interface BackingPoint {
  t: number;
  supply: number; // ETH
  locked: number;
}

export interface Backing {
  routeId: string;
  symbol: string;
  /** native: HypNative on GullyChain too (liquidity on both sides); synthetic: a minted token on GullyChain */
  kind: 'native' | 'synthetic';
  legacy: boolean;
  supply: bigint; // synthetic: supply on GullyChain (totalSupply); native: ETH held by the GullyChain router
  locked: bigint; // ETH held by the Arbitrum Sepolia router
  series: BackingPoint[];
}

export interface PendingWithdrawal {
  position: bigint;
  amount: bigint;
  createdAt: number;
  readyAt: number;
  claimable: boolean;
  tx: Hash;
}

export interface BridgeStats {
  at: number;
  transfers: StatTransfer[]; // last WINDOW_HOURS
  backing: Backing[];
  lastDeliveryAt?: number;
  pendingFast: number;
  oldestPendingFastAt?: number;
  withdrawals: PendingWithdrawal[];
  assertionConfirmed: boolean;
}

/** Arbitrum Sepolia's public RPC allows only 100k blocks per eth_getLogs when a filter position has several values,
 * so those queries go out in 90k-block windows (a few requests per refresh). */
const WINDOW = 90_000n;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLogsWindowed(chain: ChainKey, params: any, fromBlock: bigint, head: bigint): Promise<any[]> {
  if (chain === CHILD) return pub(chain).getLogs({ ...params, fromBlock, toBlock: 'latest' });
  const out = [];
  for (let a = fromBlock; a <= head; a += WINDOW) {
    const b = a + WINDOW - 1n < head ? a + WINDOW - 1n : head;
    out.push(...(await pub(chain).getLogs({ ...params, fromBlock: a, toBlock: b })));
  }
  return out;
}

const times = new Map<string, number>();
async function blockTimes(chain: ChainKey, blocks: bigint[]) {
  const need = [...new Set(blocks.filter((b) => !times.has(`${chain}:${b}`)))];
  // newest first and capped: older blocks fall outside the window anyway
  for (const b of need.sort((x, y) => (y > x ? 1 : -1)).slice(0, 80)) {
    const blk = await pub(chain).getBlock({ blockNumber: b });
    times.set(`${chain}:${b}`, Number(blk.timestamp) * 1000);
  }
}
const timeOf = (chain: ChainKey, b?: bigint | null) => (b == null ? undefined : times.get(`${chain}:${b}`));

export async function loadStats(): Promise<BridgeStats> {
  const now = Date.now();
  const since = now - WINDOW_HOURS * 3600_000;
  const parentHead = await pub(PARENT).getBlockNumber();
  const windowFrom = parentHead - BigInt(Math.ceil((WINDOW_HOURS * 3600) / CHAINS[PARENT].blockSeconds));
  const parentFrom = CHAINS[PARENT].fromBlock > windowFrom ? CHAINS[PARENT].fromBlock : windowFrom;
  const fastFrom = CHAINS[PARENT].fastFromBlock;
  const heads: Record<string, bigint> = { arbitrumsepolia: parentHead, gullychaintestnet: 0n };
  const routers: Record<string, Address[]> = {
    arbitrumsepolia: FAST_ROUTES.map((r) => r.tokens.arbitrumsepolia.address),
    gullychaintestnet: FAST_ROUTES.map((r) => r.tokens.gullychaintestnet.address),
  };
  const from = (c: ChainKey) => (c === PARENT ? fastFrom : 0n);

  // Fast: router events + mailbox dispatches from our routers (message ids), on both chains
  const [warp, dispatch] = await Promise.all([
    Promise.all(
      ([PARENT, CHILD] as ChainKey[]).map((c) =>
        getLogsWindowed(c, { address: routers[c], events: [sentTransferEvent, receivedTransferEvent] }, from(c), heads[c]),
      ),
    ),
    Promise.all(
      ([PARENT, CHILD] as ChainKey[]).map((c) =>
        getLogsWindowed(c, { address: CHAINS[c].mailbox, event: dispatchEvent, args: { sender: routers[c] } }, from(c), heads[c]),
      ),
    ),
  ]);
  const ids = dispatch.map((logs) => logs.map((l) => ({ id: keccak256(l.args.message as Hex), block: l.blockNumber!, tx: l.transactionHash! })));
  const processed = await Promise.all(
    ([PARENT, CHILD] as ChainKey[]).map((c, i) => {
      const other = ids[1 - i].map((x) => x.id);
      return other.length
        ? getLogsWindowed(c, { address: CHAINS[c].mailbox, event: processIdEvent, args: { messageId: other } }, from(c), heads[c])
        : Promise.resolve([]);
    }),
  );

  // Canonical: deposits (bridge + inbox) on Arbitrum Sepolia, withdrawals on GullyChain
  const [delivered, inboxLogs, l2l1] = await Promise.all([
    pub(PARENT).getLogs({ address: CANONICAL.bridge, event: messageDeliveredEvent, fromBlock: parentFrom, toBlock: 'latest' }),
    pub(PARENT).getLogs({ address: CANONICAL.inbox, event: inboxMessageDeliveredEvent, fromBlock: parentFrom, toBlock: 'latest' }),
    pub(CHILD).getLogs({ address: CANONICAL.arbSys, event: l2ToL1TxEvent, fromBlock: 0n, toBlock: 'latest' }),
  ]);
  const deposits = delivered.filter((l) => l.args.kind === 12 && l.args.inbox?.toLowerCase() === CANONICAL.inbox.toLowerCase());
  const inboxData = new Map(inboxLogs.map((l) => [l.args.messageNum!.toString(), l.args.data!]));

  await Promise.all([
    blockTimes(PARENT, [...warp[0], ...dispatch[0], ...processed[0]].map((l) => l.blockNumber!)),
    blockTimes(CHILD, [...warp[1], ...dispatch[1], ...processed[1]].map((l) => l.blockNumber!)),
  ]);

  const transfers: StatTransfer[] = [];
  // fast transfers, keyed by message id for delivery times
  ([PARENT, CHILD] as ChainKey[]).forEach((c, i) => {
    const dest = processed[1 - i];
    const doneAt = new Map(dest.map((p) => [p.args.messageId!, timeOf(i === 0 ? CHILD : PARENT, p.blockNumber)]));
    const sent = warp[i].filter((l) => l.eventName === 'SentTransferRemote');
    for (const s of sent) {
      const t = timeOf(c, s.blockNumber);
      if (!t) continue;
      const msg = ids[i].find((x) => x.tx === s.transactionHash);
      const d = msg ? doneAt.get(msg.id) : undefined;
      transfers.push({
        kind: 'fast',
        direction: c === PARENT ? 'deposit' : 'withdraw',
        amount: s.args.amount!,
        time: t,
        delivered: !!d,
        deliverySec: d ? Math.max(0, (d - t) / 1000) : undefined,
      });
    }
  });
  // canonical deposits (the deposit lands as a child-chain tx we can compute; checked for the newest 12)
  const recentDeps = deposits.filter((l) => Number(l.args.timestamp!) * 1000 >= since);
  await Promise.all(
    recentDeps.map(async (l, n) => {
      const data = inboxData.get(l.args.messageIndex!.toString());
      if (!data) return;
      const t = Number(l.args.timestamp!) * 1000;
      let deliverySec: number | undefined;
      if (n >= recentDeps.length - 12) {
        const tx = await pub(CHILD)
          .getTransaction({ hash: depositTxId(l.args.messageIndex!, l.args.sender!, data) })
          .catch(() => undefined);
        if (tx?.blockNumber != null) {
          await blockTimes(CHILD, [tx.blockNumber]);
          const d = timeOf(CHILD, tx.blockNumber);
          if (d) deliverySec = Math.max(0, (d - t) / 1000);
        }
      }
      transfers.push({ kind: 'canonical', direction: 'deposit', amount: BigInt(`0x${data.slice(42, 106)}`), time: t, delivered: deliverySec !== undefined, deliverySec });
    }),
  );
  for (const l of l2l1)
    transfers.push({ kind: 'canonical', direction: 'withdraw', amount: l.args.callvalue!, time: Number(l.args.timestamp!) * 1000, delivered: false });

  // backing per fast route: live totals + cumulative series from events
  const backing: Backing[] = await Promise.all(
    FAST_ROUTES.map(async (r) => {
      const a = r.tokens.arbitrumsepolia;
      const g = r.tokens.gullychaintestnet;
      const gNative = g.tokenType === 'native';
      const [supply, locked] = await Promise.all([
        g.tokenType === 'synthetic'
          ? pub(CHILD).readContract({ address: g.address, abi: warpRouterAbi, functionName: 'totalSupply' })
          : gNative
            ? pub(CHILD).getBalance({ address: g.address })
            : Promise.resolve(0n),
        a.tokenType === 'native' ? pub(PARENT).getBalance({ address: a.address }) : Promise.resolve(0n),
      ]);
      const ev = [
        ...warp[0].filter((l) => l.address.toLowerCase() === a.address.toLowerCase()).map((l) => ({ t: timeOf(PARENT, l.blockNumber) || 0, dl: l.eventName === 'SentTransferRemote' ? l.args.amount! : -l.args.amount!, ds: 0n })),
        ...warp[1].filter((l) => l.address.toLowerCase() === g.address.toLowerCase()).map((l) => ({ t: timeOf(CHILD, l.blockNumber) || 0, dl: 0n, ds: (l.eventName === 'ReceivedTransferRemote') !== gNative ? l.args.amount! : -l.args.amount! })),
      ].sort((x, y) => x.t - y.t);
      let s = 0n;
      let k = 0n;
      const series: BackingPoint[] = ev.map((e) => {
        s += e.ds;
        k += e.dl;
        return { t: e.t, supply: Number(s) / 1e18, locked: Number(k) / 1e18 };
      });
      series.push({ t: now, supply: Number(supply) / 1e18, locked: Number(locked) / 1e18 });
      if (gNative) {
        // native routers also hold their liquidity seeds (plain transfers, no event): anchor the history on today's balances
        const ds = Number(supply) / 1e18 - Number(s) / 1e18;
        const dl = Number(locked) / 1e18 - Number(k) / 1e18;
        for (let i = 0; i < series.length - 1; i++) {
          series[i].supply += ds;
          series[i].locked += dl;
        }
      }
      return { routeId: r.id, symbol: g.symbol, kind: gNative ? 'native' : 'synthetic', legacy: !!r.legacy, supply, locked, series };
    }),
  );

  // relayer: last delivery on either side; dispatched-but-unprocessed fast messages
  const processedIds = new Set(processed.flat().map((p) => p.args.messageId!));
  const allDeliveries = [
    ...processed[0].map((p) => timeOf(PARENT, p.blockNumber)),
    ...processed[1].map((p) => timeOf(CHILD, p.blockNumber)),
  ].filter((x): x is number => !!x);
  const pending = ids
    .flatMap((list, i) => list.map((x) => ({ ...x, chain: (i === 0 ? PARENT : CHILD) as ChainKey })))
    .filter((x) => !processedIds.has(x.id));

  // canonical withdrawals still open
  const eta = await withdrawEtaSeconds();
  const size = await confirmedSendCount().catch(() => undefined);
  const open = await Promise.all(
    l2l1.map(async (l) => {
      const spent = await pub(PARENT).readContract({ address: CANONICAL.outbox, abi: outboxAbi, functionName: 'isSpent', args: [l.args.position!] });
      const createdAt = Number(l.args.timestamp!) * 1000;
      return spent
        ? undefined
        : {
            position: l.args.position!,
            amount: l.args.callvalue!,
            createdAt,
            readyAt: createdAt + eta * 1000,
            claimable: size !== undefined && size > l.args.position!,
            tx: l.transactionHash!,
          };
    }),
  );

  return {
    at: now,
    transfers: transfers.filter((t) => t.time >= since).sort((x, y) => x.time - y.time),
    backing,
    lastDeliveryAt: allDeliveries.length ? Math.max(...allDeliveries) : undefined,
    pendingFast: pending.length,
    oldestPendingFastAt: pending.length ? Math.min(...pending.map((p) => timeOf(p.chain, p.block) || now)) : undefined,
    withdrawals: open.filter((x): x is PendingWithdrawal => !!x),
    assertionConfirmed: size !== undefined,
  };
}


/** hourly buckets for the last WINDOW_HOURS (oldest first) */
export function hourly(transfers: StatTransfer[], now = Date.now()) {
  const end = Math.ceil(now / 3600_000) * 3600_000;
  const buckets = Array.from({ length: WINDOW_HOURS }, (_, i) => ({ t: end - (WINDOW_HOURS - i) * 3600_000, fast: 0, canonical: 0, count: 0 }));
  for (const t of transfers) {
    const i = Math.floor((t.time - buckets[0].t) / 3600_000);
    if (i < 0 || i >= buckets.length) continue;
    buckets[i][t.kind] += Number(t.amount) / 1e18;
    buckets[i].count += 1;
  }
  return buckets;
}
