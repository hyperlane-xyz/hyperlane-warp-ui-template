// The built-in bridge client: talks to the Hyperlane warp routers (Fast) and the Arbitrum Nitro rollup bridge
// (Canonical) directly with viem. @gullylabs/bridge-sdk replaces it through setBridgeClient() in bridgeClient.ts.
import {
  concat,
  decodeEventLog,
  getAddress,
  keccak256,
  numberToHex,
  pad,
  toRlp,
  type Address,
  type Hash,
  type Hex,
  type TransactionReceipt,
} from 'viem';

import { CANONICAL, CANONICAL_READY, CHAINS, CHILD, PARENT, type ChainKey } from '../config/chains';
import { CAPS } from '../config/network';
import { fastRoute, FAST_ROUTES, LEGACY_ROUTES, routeFor, routeReady } from '../config/routes';
import { checkCaps, needsParentLocked } from './caps';
import {
  arbSysAbi,
  assertionConfirmedEvent,
  dispatchIdEvent,
  erc20Abi,
  inboxAbi,
  inboxMessageDeliveredEvent,
  l2ToL1TxEvent,
  mailboxAbi,
  messageDeliveredEvent,
  nodeInterfaceAbi,
  outboxAbi,
  rollupAbi,
  sentTransferEvent,
  warpRouterAbi,
} from './abis';
import { checkRecipient } from '../config/mirrors';
import { pub } from './clients';
import type { ActivityItem, Quote, QuoteRequest, StepDef, StepUpdate, TransferRecord } from './types';
import { ensureChain, walletClient } from './wallet';

const ZERO: Address = '0x0000000000000000000000000000000000000000';
export const FAST_ETA = 75; // our relayer delivers ~10-60 s after the origin block
const DEPOSIT_ETA = 60;

export function ends(direction: QuoteRequest['direction']): { from: ChainKey; to: ChainKey } {
  return direction === 'deposit' ? { from: PARENT, to: CHILD } : { from: CHILD, to: PARENT };
}

let confirmBlocks: bigint | undefined;
export async function withdrawEtaSeconds() {
  if (confirmBlocks === undefined) {
    confirmBlocks = await pub(PARENT)
      .readContract({ address: CANONICAL.rollup, abi: rollupAbi, functionName: 'confirmPeriodBlocks' })
      .catch(() => CANONICAL.confirmPeriodBlocks);
  }
  // challenge period in L1 blocks, plus about one assertion interval before the withdrawal sits in a confirmed one
  return Number(confirmBlocks) * CANONICAL.l1BlockSeconds + 15 * 60;
}

export function stepsFor(kind: QuoteRequest['kind'], direction: QuoteRequest['direction'], approve: boolean): StepDef[] {
  const { from, to } = ends(direction);
  const fromName = CHAINS[from].short;
  const toName = CHAINS[to].short;
  if (kind === 'fast')
    return [
      ...(approve
        ? [{ id: 'approve', label: 'Approve', hint: 'Allow the bridge to move the token', chain: from, user: true } as StepDef]
        : []),
      { id: 'send', label: 'Send', hint: `Sign on ${fromName}`, chain: from, user: true },
      { id: 'relay', label: 'Relay', hint: 'Validators sign, relayer delivers', chain: to, user: false },
      { id: 'deliver', label: 'Delivered', hint: `Funds on ${toName}`, chain: to, user: false },
    ];
  if (direction === 'deposit')
    return [
      { id: 'send', label: 'Send', hint: `Sign on ${fromName}`, chain: from, user: true },
      { id: 'relay', label: 'Sequenced', hint: 'GullyChain reads the deposit', chain: to, user: false },
      { id: 'deliver', label: 'Delivered', hint: `Gas ETH on ${toName}`, chain: to, user: false },
    ];
  return [
    { id: 'send', label: 'Send', hint: `Sign on ${fromName}`, chain: from, user: true },
    { id: 'challenge', label: 'Challenge period', hint: 'Rollup confirms the withdrawal', chain: to, user: false },
    { id: 'claim', label: 'Claim', hint: `Sign on ${toName}`, chain: to, user: true },
  ];
}

/** A quote that only says why a lane is closed (not deployed yet, or over a Phase 1 cap). */
function closedQuote(req: QuoteRequest, reason: string): Quote {
  const { from, to } = ends(req.direction);
  return {
    req,
    from,
    to,
    sendSymbol: 'ETH',
    receiveSymbol: 'ETH',
    receive: req.amount,
    value: req.amount,
    fees: [],
    etaSeconds: 0,
    steps: stepsFor(req.kind, req.direction, false),
    needsApproval: false,
    available: false,
    reason,
    notes: [],
  };
}

/** ETH the parent-chain side holds for this lane (Fast: the route's Arbitrum router; Canonical: the Nitro bridge). */
async function parentLocked(req: QuoteRequest): Promise<bigint | undefined> {
  try {
    if (req.kind === 'canonical') return await pub(PARENT).getBalance({ address: CANONICAL.bridge });
    const t = routeFor(req.direction, req.fastRouteId).tokens[PARENT];
    if (t.tokenType === 'native') return await pub(PARENT).getBalance({ address: t.address });
    if (t.tokenType === 'collateral' && t.collateralAddress)
      return await pub(PARENT).readContract({ address: t.collateralAddress, abi: erc20Abi, functionName: 'balanceOf', args: [t.address] });
    return undefined;
  } catch {
    return undefined;
  }
}

/** quote() with the network gates: lanes that are not deployed are closed, and the Phase 1 caps apply (mainnet). */
async function quote(req: QuoteRequest): Promise<Quote> {
  if (req.kind === 'canonical' && !CANONICAL_READY) return closedQuote(req, 'Canonical bridge opens on launch day');
  if (req.kind === 'fast' && !routeReady(routeFor(req.direction, req.fastRouteId))) return closedQuote(req, 'Fast lane opens on launch day');
  const locked = needsParentLocked(CAPS, req.kind, req.direction) ? await parentLocked(req) : undefined;
  const cap = checkCaps(CAPS, { kind: req.kind, direction: req.direction, amount: req.amount, parentLocked: locked });
  const q = await laneQuote(req);
  return cap.ok || !q.available ? q : { ...q, available: false, reason: cap.reason };
}

async function laneQuote(req: QuoteRequest): Promise<Quote> {
  const { from, to } = ends(req.direction);
  const notes: string[] = [];
  if (req.kind === 'fast') {
    const r = routeFor(req.direction, req.fastRouteId);
    const t = r.tokens[from];
    const dest = r.tokens[to];
    const recipient = pad(req.recipient || req.sender || ZERO);
    let quotes: readonly { token: Address; amount: bigint }[];
    try {
      quotes = await pub(from).readContract({
        address: t.address,
        abi: warpRouterAbi,
        functionName: 'quoteTransferRemote',
        args: [CHAINS[to].id, recipient, req.amount],
      });
    } catch {
      const gas = await pub(from).readContract({
        address: t.address,
        abi: warpRouterAbi,
        functionName: 'quoteGasPayment',
        args: [CHAINS[to].id],
      });
      quotes = [
        { token: ZERO, amount: gas },
        { token: t.tokenType === 'native' ? ZERO : t.address, amount: req.amount },
      ];
    }
    // quotes: [0] relay gas (native), [1] amount (+ fee) in the route token, [2..] extra fees in the route token
    const value = quotes.filter((q) => q.token === ZERO).reduce((a, q) => a + q.amount, 0n);
    const gasFee = quotes[0]?.token === ZERO ? quotes[0].amount : 0n;
    const tokenFees = quotes.slice(2).reduce((a, q) => a + q.amount, 0n);
    const needsApproval = t.tokenType === 'collateral';
    let available = true;
    let reason: string | undefined;
    if (dest.tokenType === 'native' || dest.tokenType === 'collateral') {
      const liq =
        dest.tokenType === 'native'
          ? await pub(to).getBalance({ address: dest.address })
          : await pub(to).readContract({
              address: dest.collateralAddress!,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [dest.address],
            });
      if (req.amount > liq) {
        available = false;
        reason = `Fast lane liquidity on ${CHAINS[to].short} is ${Number(liq) / 1e18} ${dest.symbol}`;
      }
    }
    if (r.warp) {
      // Gully Warp Mirror: the coin is locked in its GullyCollateral on Gully Chain, the mirror is minted / burned 1:1
      notes.push(r.warp.label);
      notes.push(
        dest.tokenType === 'synthetic'
          ? `You receive ${dest.symbol} on ${CHAINS[to].short}, the official mirror of ${t.symbol}. Bridge back 1:1 any time to trade on Gully Core.`
          : `${t.symbol} is burned on ${CHAINS[from].short}; ${dest.symbol} is released 1:1 on ${CHAINS[to].short}.`,
      );
      if (r.warp.syncing) {
        available = false;
        reason = 'The relayer is syncing this mirror route; try again in a minute';
      }
    } else {
      if (dest.tokenType === 'synthetic')
        notes.push(`You receive ${dest.symbol} (${dest.name}), redeemable 1:1 for ETH through the Fast lane.`);
      if (t.tokenType === 'synthetic')
        notes.push(`${t.symbol} is burned on ${CHAINS[from].short}; ETH is released on ${CHAINS[to].short}.`);
    }
    return {
      req,
      from,
      to,
      sendSymbol: t.symbol,
      receiveSymbol: dest.symbol,
      receive: req.amount - tokenFees,
      value,
      fees: [
        { label: 'Relay fee', amount: gasFee, symbol: 'ETH' },
        ...(tokenFees ? [{ label: 'Route fee', amount: tokenFees, symbol: t.symbol }] : []),
      ],
      etaSeconds: FAST_ETA,
      steps: stepsFor('fast', req.direction, needsApproval),
      needsApproval,
      available,
      reason,
      notes,
    };
  }
  const eta = req.direction === 'deposit' ? DEPOSIT_ETA : await withdrawEtaSeconds();
  if (req.direction === 'withdraw')
    notes.push(`After the challenge period, come back and claim on ${CHAINS[PARENT].name} (one more transaction).`);
  else notes.push('You receive native ETH for gas on GullyChain.');
  return {
    req,
    from,
    to,
    sendSymbol: 'ETH',
    receiveSymbol: 'ETH',
    receive: req.amount,
    value: req.amount,
    fees: [{ label: 'Bridge fee', amount: 0n, symbol: 'ETH' }],
    etaSeconds: eta,
    steps: stepsFor('canonical', req.direction, false),
    needsApproval: false,
    available: true,
    notes,
  };
}

function baseRecord(q: Quote, sender: Address, originTx: Hash): TransferRecord {
  const now = Date.now();
  return {
    id: originTx,
    kind: q.req.kind,
    direction: q.req.direction,
    from: q.from,
    to: q.to,
    amount: q.req.amount.toString(),
    sendSymbol: q.sendSymbol,
    receiveSymbol: q.receiveSymbol,
    sender,
    recipient: q.req.recipient || sender,
    ref: q.req.ref,
    originTx,
    createdAt: now,
    updatedAt: now,
    status: 'sent',
    etaSeconds: q.etaSeconds,
  };
}

/** Child-chain hash of an ETH deposit (ArbitrumDepositTx, type 0x64). Checked against deposit #39 on 2026-10-26. */
export function depositTxId(messageNum: bigint, aliasedSender: Address, data: Hex): Hash {
  const to = getAddress(`0x${data.slice(2, 42)}`);
  const value = BigInt(`0x${data.slice(42, 106)}`);
  const strip = (n: bigint) => (n === 0n ? '0x' : numberToHex(n));
  return keccak256(
    concat([
      '0x64',
      toRlp([
        strip(BigInt(CHAINS[CHILD].id)),
        pad(numberToHex(messageNum), { size: 32 }),
        getAddress(aliasedSender),
        to,
        strip(value),
      ]),
    ]),
  );
}

export function depositTxIdFromReceipt(r: TransactionReceipt): Hash | undefined {
  let messageNum: bigint | undefined;
  let data: Hex | undefined;
  let sender: Address | undefined;
  for (const l of r.logs) {
    try {
      if (l.address.toLowerCase() === CANONICAL.inbox.toLowerCase()) {
        const d = decodeEventLog({ abi: [inboxMessageDeliveredEvent], data: l.data, topics: l.topics });
        messageNum = d.args.messageNum;
        data = d.args.data;
      } else if (l.address.toLowerCase() === CANONICAL.bridge.toLowerCase()) {
        const d = decodeEventLog({ abi: [messageDeliveredEvent], data: l.data, topics: l.topics });
        sender = d.args.sender;
      }
    } catch {
      /* other events */
    }
  }
  if (messageNum === undefined || !data || !sender) return undefined;
  return depositTxId(messageNum, sender, data);
}

function messageIdFromReceipt(r: TransactionReceipt, chain: ChainKey): Hash | undefined {
  const mb = CHAINS[chain].mailbox.toLowerCase();
  for (const l of r.logs) {
    if (l.address.toLowerCase() !== mb) continue;
    try {
      return decodeEventLog({ abi: [dispatchIdEvent], data: l.data, topics: l.topics }).args.messageId;
    } catch {
      /* the Dispatch event */
    }
  }
  return undefined;
}

async function execute(given: Quote, onStep: (u: StepUpdate) => void): Promise<TransferRecord> {
  const req = given.req;
  // the quote on screen can be stale (the amount just changed, the router just filled up): the caps and the destination
  // router are read again right before the wallet opens, for this exact amount. Unreadable = nothing is sent.
  const q = await quote(req);
  if (!q.available) throw new Error(q.reason || 'Route unavailable');
  await ensureChain(q.from);
  const wc = walletClient(q.from);
  const sender = wc.account!.address;
  const recipient = checkRecipient(req.recipient || sender);
  const client = pub(q.from);
  let hash: Hash;
  if (req.kind === 'fast') {
    const t = routeFor(req.direction, req.fastRouteId).tokens[q.from];
    if (q.needsApproval && t.collateralAddress) {
      const allowance = await client.readContract({
        address: t.collateralAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [sender, t.address],
      });
      if (allowance < req.amount) {
        onStep({ step: 'approve', state: 'active' });
        const ah = await wc.writeContract({
          address: t.collateralAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [t.address, req.amount],
          chain: wc.chain,
          account: sender,
        });
        await client.waitForTransactionReceipt({ hash: ah });
      }
      onStep({ step: 'approve', state: 'done' });
    }
    onStep({ step: 'send', state: 'active' });
    hash = await wc.writeContract({
      address: t.address,
      abi: warpRouterAbi,
      functionName: 'transferRemote',
      args: [CHAINS[q.to].id, pad(recipient), req.amount],
      value: q.value,
      chain: wc.chain,
      account: sender,
    });
  } else if (req.direction === 'deposit') {
    onStep({ step: 'send', state: 'active' });
    hash = await wc.writeContract({
      address: CANONICAL.inbox,
      abi: inboxAbi,
      functionName: 'depositEth',
      value: req.amount,
      chain: wc.chain,
      account: sender,
    });
  } else {
    onStep({ step: 'send', state: 'active' });
    hash = await wc.writeContract({
      address: CANONICAL.arbSys,
      abi: arbSysAbi,
      functionName: 'withdrawEth',
      args: [recipient],
      value: req.amount,
      chain: wc.chain,
      account: sender,
    });
  }
  onStep({ step: 'send', state: 'active', tx: hash, message: 'Waiting for confirmation' });
  const receipt = await client.waitForTransactionReceipt({ hash });
  const rec = baseRecord(q, sender, hash);
  if (receipt.status !== 'success') return { ...rec, status: 'failed', error: 'Transaction reverted' };
  onStep({ step: 'send', state: 'done', tx: hash });
  if (req.kind === 'fast') {
    rec.messageId = messageIdFromReceipt(receipt, q.from);
    rec.status = 'relaying';
  } else if (req.direction === 'deposit') {
    rec.depositTxId = depositTxIdFromReceipt(receipt);
    rec.status = 'relaying';
  } else {
    for (const l of receipt.logs) {
      try {
        rec.position = decodeEventLog({ abi: [l2ToL1TxEvent], data: l.data, topics: l.topics }).args.position.toString();
      } catch {
        /* other */
      }
    }
    rec.status = 'challenge';
  }
  return rec;
}

/** One status poll; returns the updated record. */
async function track(rec: TransferRecord): Promise<TransferRecord> {
  const upd = (p: Partial<TransferRecord>) => ({ ...rec, ...p, updatedAt: Date.now() });
  if (['delivered', 'claimed', 'failed'].includes(rec.status)) return rec;
  if (rec.kind === 'fast' && rec.messageId) {
    const ok = await pub(rec.to).readContract({
      address: CHAINS[rec.to].mailbox,
      abi: mailboxAbi,
      functionName: 'delivered',
      args: [rec.messageId],
    });
    return ok ? upd({ status: 'delivered' }) : rec;
  }
  if (rec.kind === 'canonical' && rec.direction === 'deposit' && rec.depositTxId) {
    const r = await pub(CHILD).getTransactionReceipt({ hash: rec.depositTxId }).catch(() => undefined);
    return r ? upd({ status: 'delivered', destTx: rec.depositTxId }) : rec;
  }
  if (rec.kind === 'canonical' && rec.direction === 'withdraw' && rec.position !== undefined) {
    const spent = await pub(PARENT).readContract({
      address: CANONICAL.outbox,
      abi: outboxAbi,
      functionName: 'isSpent',
      args: [BigInt(rec.position)],
    });
    if (spent) return upd({ status: 'claimed' });
    const size = await confirmedSendCount();
    return size !== undefined && size > BigInt(rec.position) ? upd({ status: 'claimable' }) : rec;
  }
  return rec;
}

/** Child-to-parent messages covered by the latest confirmed assertion (BoLD rollup); undefined while only genesis is. */
export async function confirmedSendCount(): Promise<bigint | undefined> {
  const p = pub(PARENT);
  const latest = await p.readContract({ address: CANONICAL.rollup, abi: rollupAbi, functionName: 'latestConfirmed' });
  const logs = await p.getLogs({
    address: CANONICAL.rollup,
    event: assertionConfirmedEvent,
    args: { assertionHash: latest },
    fromBlock: CHAINS[PARENT].fromBlock,
    toBlock: 'latest',
  });
  const blockHash = logs[0]?.args.blockHash;
  if (!blockHash) return undefined;
  const b = (await pub(CHILD).request({
    method: 'eth_getBlockByHash',
    params: [blockHash, false],
  } as never)) as { sendCount?: Hex } | null;
  return b?.sendCount ? BigInt(b.sendCount) : undefined;
}

async function claim(rec: TransferRecord, onStep: (u: StepUpdate) => void): Promise<TransferRecord> {
  if (rec.position === undefined) throw new Error('Unknown withdrawal');
  const size = await confirmedSendCount();
  if (size === undefined || size <= BigInt(rec.position)) throw new Error('Not claimable yet');
  const r = await pub(CHILD).getTransactionReceipt({ hash: rec.originTx });
  const ev = r.logs
    .map((l) => {
      try {
        return decodeEventLog({ abi: [l2ToL1TxEvent], data: l.data, topics: l.topics }).args;
      } catch {
        return undefined;
      }
    })
    .find(Boolean);
  if (!ev) throw new Error('Withdrawal event not found');
  const [, , proof] = await pub(CHILD).readContract({
    address: CANONICAL.nodeInterface,
    abi: nodeInterfaceAbi,
    functionName: 'constructOutboxProof',
    args: [size, BigInt(rec.position)],
  });
  await ensureChain(PARENT);
  const wc = walletClient(PARENT);
  onStep({ step: 'claim', state: 'active' });
  const hash = await wc.writeContract({
    address: CANONICAL.outbox,
    abi: outboxAbi,
    functionName: 'executeTransaction',
    args: [proof, ev.position, ev.caller, ev.destination, ev.arbBlockNum, ev.ethBlockNum, ev.timestamp, ev.callvalue, ev.data],
    chain: wc.chain,
    account: wc.account!,
  });
  await pub(PARENT).waitForTransactionReceipt({ hash });
  onStep({ step: 'claim', state: 'done', tx: hash });
  return { ...rec, status: 'claimed', claimTx: hash, updatedAt: Date.now() };
}

/** Canonical withdrawals paying out to `address`, newest first. */
async function withdrawalsOf(address: Address): Promise<TransferRecord[]> {
  if (!CANONICAL_READY) return [];
  const logs = await pub(CHILD).getLogs({
    address: CANONICAL.arbSys,
    event: l2ToL1TxEvent,
    args: { destination: address },
    fromBlock: 0n,
    toBlock: 'latest',
  });
  if (!logs.length) return [];
  const size = await confirmedSendCount().catch(() => undefined);
  const eta = await withdrawEtaSeconds();
  const out: TransferRecord[] = [];
  for (const l of [...logs].reverse()) {
    const a = l.args;
    const spent = await pub(PARENT).readContract({
      address: CANONICAL.outbox,
      abi: outboxAbi,
      functionName: 'isSpent',
      args: [a.position!],
    });
    out.push({
      id: l.transactionHash!,
      kind: 'canonical',
      direction: 'withdraw',
      from: CHILD,
      to: PARENT,
      amount: a.callvalue!.toString(),
      sendSymbol: 'ETH',
      receiveSymbol: 'ETH',
      sender: a.caller!,
      recipient: a.destination!,
      originTx: l.transactionHash!,
      position: a.position!.toString(),
      createdAt: Number(a.timestamp!) * 1000,
      updatedAt: Date.now(),
      status: spent ? 'claimed' : size !== undefined && size > a.position! ? 'claimable' : 'challenge',
      etaSeconds: eta,
    });
  }
  return out;
}

export interface Balances {
  parentEth?: bigint;
  childEth?: bigint;
  /** Gully Warp Mirror routes: the wallet's mirror balance on the destination chain (what "Bridge back" sends) */
  mirrorToken?: bigint;
  /** what the Fast route sends from GullyChain: native ETH (the default route) or the route's token (gETH / hypETH) */
  fastToken?: bigint;
  /** balances of retired routes' GullyChain tokens (gETH, hypETH) by route id, so the UI can offer a redeem */
  legacy?: Record<string, bigint>;
}

const tokenBalance = (g: { tokenType: string; address: Address; collateralAddress: Address | null }, address: Address) =>
  pub(CHILD)
    .readContract({
      address: g.tokenType === 'collateral' ? g.collateralAddress! : g.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    })
    .catch(() => undefined);

async function balances(address: Address, routeId?: string): Promise<Balances> {
  const route = fastRoute(routeId);
  const g = route.tokens[CHILD];
  const m = route.warp;
  const [parentEth, childEth, token, legacyList, mirrorToken] = await Promise.all([
    pub(PARENT).getBalance({ address }).catch(() => undefined),
    pub(CHILD).getBalance({ address }).catch(() => undefined),
    g.tokenType === 'native' ? Promise.resolve(undefined) : tokenBalance(g, address),
    Promise.all(LEGACY_ROUTES.map((r) => tokenBalance(r.tokens[CHILD], address))),
    m
      ? pub(m.chain)
          .readContract({ address: m.mirror, abi: erc20Abi, functionName: 'balanceOf', args: [address] })
          .catch(() => undefined)
      : Promise.resolve(undefined),
  ]);
  const legacy: Record<string, bigint> = {};
  LEGACY_ROUTES.forEach((r, i) => {
    if (legacyList[i] !== undefined) legacy[r.id] = legacyList[i]!;
  });
  // a native GullyChain router sends the wallet's own gas ETH
  const fastToken = g.tokenType === 'native' ? childEth : token;
  return { parentEth, childEth, fastToken, legacy, mirrorToken };
}

const blockTimes = new Map<string, number>();
async function blockTime(chain: ChainKey, n: bigint) {
  const k = `${chain}:${n}`;
  if (!blockTimes.has(k)) blockTimes.set(k, Number((await pub(chain).getBlock({ blockNumber: n })).timestamp) * 1000);
  return blockTimes.get(k)!;
}

/** Recent transfers on both lanes, read from the chains (no indexer). */
async function recentActivity(limit = 24): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];
  const tasks: Promise<unknown>[] = [];
  const parentHead = await pub(PARENT).getBlockNumber();
  const parentFrom = parentHead > 700_000n ? parentHead - 700_000n : 0n; // ~2 days of parent-chain blocks (0.25 s)
  for (const r of FAST_ROUTES) {
    for (const chain of [PARENT, CHILD] as ChainKey[]) {
      tasks.push(
        pub(chain)
          .getLogs({
            address: r.tokens[chain].address,
            event: sentTransferEvent,
            fromBlock: chain === PARENT ? parentFrom : 0n,
            toBlock: 'latest',
          })
          .then((logs) => {
            for (const l of logs)
              items.push({
                key: `${l.transactionHash}:${l.logIndex}`,
                kind: 'fast',
                direction: chain === PARENT ? 'deposit' : 'withdraw',
                amount: l.args.amount!,
                symbol: chain === PARENT ? 'ETH' : r.tokens[CHILD].symbol,
                tx: l.transactionHash!,
                chain,
                block: l.blockNumber!,
              });
          })
          .catch(() => undefined),
      );
    }
  }
  tasks.push(
    pub(PARENT)
      .getLogs({ address: CANONICAL.bridge, event: messageDeliveredEvent, fromBlock: parentFrom, toBlock: 'latest' })
      .then(async (logs) => {
        const deps = logs.filter(
          (l) => l.args.kind === 12 && l.args.inbox?.toLowerCase() === CANONICAL.inbox.toLowerCase(),
        );
        if (!deps.length) return;
        const inboxLogs = await pub(PARENT).getLogs({
          address: CANONICAL.inbox,
          event: inboxMessageDeliveredEvent,
          fromBlock: deps[0].blockNumber!,
          toBlock: 'latest',
        });
        const byNum = new Map(inboxLogs.map((l) => [l.args.messageNum!.toString(), l.args.data!]));
        for (const l of deps) {
          const data = byNum.get(l.args.messageIndex!.toString());
          if (!data) continue;
          items.push({
            key: `${l.transactionHash}:${l.logIndex}`,
            kind: 'canonical',
            direction: 'deposit',
            amount: BigInt(`0x${data.slice(42, 106)}`),
            symbol: 'ETH',
            tx: l.transactionHash!,
            chain: PARENT,
            block: l.blockNumber!,
            time: Number(l.args.timestamp!) * 1000,
          });
        }
      })
      .catch(() => undefined),
  );
  tasks.push(
    pub(CHILD)
      .getLogs({ address: CANONICAL.arbSys, event: l2ToL1TxEvent, fromBlock: 0n, toBlock: 'latest' })
      .then((logs) => {
        for (const l of logs)
          items.push({
            key: `${l.transactionHash}:${l.logIndex}`,
            kind: 'canonical',
            direction: 'withdraw',
            amount: l.args.callvalue!,
            symbol: 'ETH',
            tx: l.transactionHash!,
            chain: CHILD,
            block: l.blockNumber!,
            time: Number(l.args.timestamp!) * 1000,
          });
      })
      .catch(() => undefined),
  );
  await Promise.all(tasks);
  await Promise.all(
    items.map(async (i) => {
      if (!i.time) i.time = await blockTime(i.chain, i.block).catch(() => undefined);
    }),
  );
  return items.sort((a, b) => (b.time || 0) - (a.time || 0)).slice(0, limit);
}

export const localBridgeClient = {
  id: 'gully-local',
  quote,
  execute,
  track,
  claim,
  withdrawalsOf,
  balances,
  recentActivity,
};
