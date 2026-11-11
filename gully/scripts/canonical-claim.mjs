#!/usr/bin/env node
// Canonical (Arbitrum Nitro) withdrawal claim, end to end, on GullyChain Testnet -> Arbitrum Sepolia by default.
//
//   node scripts/canonical-claim.mjs check
//     Read-only, no key. Reads the rollup's latest confirmed assertion and its send count, every ArbSys L2ToL1Tx
//     withdrawal on the child chain, and for each confirmed one: Outbox.isSpent, the claim tx on record
//     (OutBoxTransactionExecuted) when spent, and when unspent NodeInterface.constructOutboxProof + an eth_call
//     simulation of Outbox.executeTransaction from the destination (proves the claim would succeed; sends nothing).
//     Prints one JSON summary. Exit 0 when at least one withdrawal is proven claimable or claimed on record.
//
//   KEY_FILE=/path/to/key AMOUNT_ETH=0.001 node scripts/canonical-claim.mjs run
//     Signs: ArbSys.withdrawEth on the child chain, waits for the challenge period (polls the confirmed send count),
//     then constructOutboxProof + Outbox.executeTransaction on the parent chain. KEY_FILE holds one 0x-prefixed hex
//     private key (never pass a key in argv or env). Needs: the key funded on the child chain with AMOUNT_ETH + gas and
//     on the parent chain with gas for the claim; WAIT_MIN (default 180) minutes of patience for the testnet challenge
//     period (150 L1 blocks plus the next assertion); on mainnet 7 days, so run it in two halves with RESUME_TX.
//     RESUME_TX=0x... skips the withdraw and claims that withdrawal.
//
// Env (defaults = testnet, gully/src/config/chains.ts): PARENT_RPC, CHILD_RPC, OUTBOX, ROLLUP, PARENT_FROM_BLOCK,
// EXPECT_PARENT_ID, EXPECT_CHILD_ID, MAX_ETH (run mode refuses more, default 0.01), LIMIT (check mode, default 20).
import { readFileSync } from 'node:fs';
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  formatEther,
  http,
  parseAbi,
  parseAbiItem,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const E = process.env;
const CFG = {
  parentRpc: E.PARENT_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
  childRpc: E.CHILD_RPC || 'https://testnet-rpc.gullychain.xyz',
  outbox: E.OUTBOX || '0x976C651fe5E63E45C8C28449507F51548922f68c',
  rollup: E.ROLLUP || '0x85D80C06Fa5334E8Cd1C51F3F39D477E5dc35E0D',
  parentFromBlock: BigInt(E.PARENT_FROM_BLOCK || '322568124'),
  expectParent: Number(E.EXPECT_PARENT_ID || 421614),
  expectChild: Number(E.EXPECT_CHILD_ID || 485590),
  maxEth: parseEther(E.MAX_ETH || '0.01'),
  limit: Number(E.LIMIT || 20),
};
const ARBSYS = '0x0000000000000000000000000000000000000064';
const NODE_INTERFACE = '0x00000000000000000000000000000000000000C8';

const l2ToL1Tx = parseAbiItem(
  'event L2ToL1Tx(address caller, address indexed destination, uint256 indexed hash, uint256 indexed position, uint256 arbBlockNum, uint256 ethBlockNum, uint256 timestamp, uint256 callvalue, bytes data)',
);
const assertionConfirmed = parseAbiItem('event AssertionConfirmed(bytes32 indexed assertionHash, bytes32 blockHash, bytes32 sendRoot)');
const outboxExecuted = parseAbiItem(
  'event OutBoxTransactionExecuted(address indexed to, address indexed l2Sender, uint256 indexed zero, uint256 transactionIndex)',
);
const outboxAbi = parseAbi([
  'function executeTransaction(bytes32[] proof, uint256 index, address l2Sender, address to, uint256 l2Block, uint256 l1Block, uint256 l2Timestamp, uint256 value, bytes data)',
  'function isSpent(uint256 index) view returns (bool)',
]);
const rollupAbi = parseAbi(['function latestConfirmed() view returns (bytes32)', 'function confirmPeriodBlocks() view returns (uint64)']);
const nodeInterfaceAbi = parseAbi([
  'function constructOutboxProof(uint64 size, uint64 leaf) view returns (bytes32 send, bytes32 root, bytes32[] proof)',
]);
const arbSysAbi = parseAbi(['function withdrawEth(address destination) payable returns (uint256)']);

const parent = createPublicClient({ transport: http(CFG.parentRpc, { timeout: 30_000, retryCount: 2 }) });
const child = createPublicClient({ transport: http(CFG.childRpc, { timeout: 30_000, retryCount: 2 }) });
const log = (...a) => console.error(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const big = (_k, v) => (typeof v === 'bigint' ? v.toString() : v);

/** eth_getLogs in windows (public RPCs cap the block range); newest first, stops after `want` hits. */
async function logsWindowed(client, params, from, to, step = 100_000n, want = Infinity) {
  const out = [];
  for (let hi = to; hi >= from && out.length < want; hi -= step) {
    const lo = hi - step + 1n > from ? hi - step + 1n : from;
    const got = await client.getLogs({ ...params, fromBlock: lo, toBlock: hi });
    out.push(...got.reverse());
    if (lo === from) break;
  }
  return out;
}

async function chainIds() {
  const [p, c] = await Promise.all([parent.getChainId(), child.getChainId()]);
  if (p !== CFG.expectParent || c !== CFG.expectChild)
    throw new Error(`wrong chains: parent ${p} (want ${CFG.expectParent}), child ${c} (want ${CFG.expectChild})`);
  return { parent: p, child: c };
}

/** Child-to-parent messages covered by the rollup's latest confirmed assertion. */
async function confirmedSendCount() {
  const latest = await parent.readContract({ address: CFG.rollup, abi: rollupAbi, functionName: 'latestConfirmed' });
  const head = await parent.getBlockNumber();
  const [l] = await logsWindowed(parent, { address: CFG.rollup, event: assertionConfirmed, args: { assertionHash: latest } }, CFG.parentFromBlock, head, 2_000_000n, 1);
  if (!l) return { latest, size: undefined };
  const b = await child.request({ method: 'eth_getBlockByHash', params: [l.args.blockHash, false] });
  return { latest, confirmedAtParentBlock: l.blockNumber, size: b?.sendCount ? BigInt(b.sendCount) : undefined };
}

async function proofFor(size, position) {
  const [, root, proof] = await child.readContract({ address: NODE_INTERFACE, abi: nodeInterfaceAbi, functionName: 'constructOutboxProof', args: [size, position] });
  return { root, proof };
}

const execArgs = (proof, a) => [proof, a.position, a.caller, a.destination, a.arbBlockNum, a.ethBlockNum, a.timestamp, a.callvalue, a.data];

async function check() {
  const ids = await chainIds();
  const confirmPeriodBlocks = await parent.readContract({ address: CFG.rollup, abi: rollupAbi, functionName: 'confirmPeriodBlocks' });
  const conf = await confirmedSendCount();
  const childHead = await child.getBlockNumber();
  const ws = await logsWindowed(child, { address: ARBSYS, event: l2ToL1Tx }, 0n, childHead, 500_000n, CFG.limit);
  const parentHead = await parent.getBlockNumber();
  const rows = [];
  for (const w of ws) {
    const a = w.args;
    const row = { withdrawTx: w.transactionHash, position: a.position, valueEth: formatEther(a.callvalue), destination: a.destination };
    if (conf.size === undefined || a.position >= conf.size) {
      rows.push({ ...row, state: 'in challenge period' });
      continue;
    }
    const spent = await parent.readContract({ address: CFG.outbox, abi: outboxAbi, functionName: 'isSpent', args: [a.position] });
    if (spent) {
      const ex = await logsWindowed(parent, { address: CFG.outbox, event: outboxExecuted, args: { to: a.destination } }, CFG.parentFromBlock, parentHead, 2_000_000n);
      const hit = ex.find((e) => e.args.transactionIndex === a.position);
      rows.push({ ...row, state: 'claimed', claimTx: hit?.transactionHash ?? null, claimParentBlock: hit?.blockNumber ?? null });
      continue;
    }
    const { root, proof } = await proofFor(conf.size, a.position);
    let simulated = 'ok';
    try {
      await parent.simulateContract({ address: CFG.outbox, abi: outboxAbi, functionName: 'executeTransaction', args: execArgs(proof, a), account: a.destination });
    } catch (e) {
      simulated = `reverted: ${(e.shortMessage || e.message || '').slice(0, 160)}`;
    }
    rows.push({ ...row, state: 'claimable', proofLength: proof.length, sendRoot: root, executeTransactionSimulation: simulated });
  }
  const proven = rows.filter((r) => (r.state === 'claimable' && r.executeTransactionSimulation === 'ok') || (r.state === 'claimed' && r.claimTx));
  const summary = {
    mode: 'check (read-only, nothing signed)',
    at: new Date().toISOString(),
    chains: ids,
    outbox: CFG.outbox,
    rollup: CFG.rollup,
    confirmPeriodBlocks,
    latestConfirmed: conf.latest,
    confirmedSendCount: conf.size ?? null,
    withdrawalsScanned: rows.length,
    claimedOnRecord: rows.filter((r) => r.state === 'claimed' && r.claimTx).length,
    claimableProven: rows.filter((r) => r.state === 'claimable' && r.executeTransactionSimulation === 'ok').length,
    inChallenge: rows.filter((r) => r.state === 'in challenge period').length,
    rows,
  };
  console.log(JSON.stringify(summary, big, 2));
  if (!proven.length) {
    log('no withdrawal proven claimable or claimed on record');
    process.exit(2);
  }
}

async function run() {
  await chainIds();
  if (!E.KEY_FILE) throw new Error('KEY_FILE (path to a file with one 0x hex private key) is required');
  const key = readFileSync(E.KEY_FILE, 'utf8').trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('KEY_FILE must hold one 0x-prefixed 32-byte hex key');
  const account = privateKeyToAccount(key);
  const chainOf = (id, rpc) => ({ id, name: `chain-${id}`, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });
  const cw = createWalletClient({ account, chain: chainOf(CFG.expectChild, CFG.childRpc), transport: http(CFG.childRpc) });
  const pw = createWalletClient({ account, chain: chainOf(CFG.expectParent, CFG.parentRpc), transport: http(CFG.parentRpc) });
  let txHash = E.RESUME_TX;
  if (!txHash) {
    const amount = parseEther(E.AMOUNT_ETH || '0.001');
    if (amount > CFG.maxEth) throw new Error(`AMOUNT_ETH is above MAX_ETH (${formatEther(CFG.maxEth)})`);
    const dest = E.DEST || account.address;
    log(`withdrawEth ${formatEther(amount)} ETH from ${account.address} to ${dest} on chain ${CFG.expectChild}`);
    txHash = await cw.writeContract({ address: ARBSYS, abi: arbSysAbi, functionName: 'withdrawEth', args: [dest], value: amount });
    log(`withdraw tx ${txHash}`);
  }
  const r = await child.waitForTransactionReceipt({ hash: txHash });
  const ev = r.logs
    .map((l) => {
      try {
        return decodeEventLog({ abi: [l2ToL1Tx], data: l.data, topics: l.topics }).args;
      } catch {
        return undefined;
      }
    })
    .find(Boolean);
  if (!ev) throw new Error('no L2ToL1Tx event in the withdraw receipt');
  log(`position ${ev.position}; waiting for a confirmed assertion that covers it`);
  const deadline = Date.now() + Number(E.WAIT_MIN || 180) * 60_000;
  let size;
  for (;;) {
    size = (await confirmedSendCount()).size;
    if (size !== undefined && size > ev.position) break;
    if (Date.now() > deadline) throw new Error(`not claimable after WAIT_MIN; resume later with RESUME_TX=${txHash}`);
    log(`confirmed send count ${size ?? 'none'}; next check in 5 min`);
    await new Promise((ok) => setTimeout(ok, 300_000));
  }
  if (await parent.readContract({ address: CFG.outbox, abi: outboxAbi, functionName: 'isSpent', args: [ev.position] })) {
    log('already claimed');
    return;
  }
  const { proof } = await proofFor(size, ev.position);
  const claimTx = await pw.writeContract({ address: CFG.outbox, abi: outboxAbi, functionName: 'executeTransaction', args: execArgs(proof, ev) });
  const cr = await parent.waitForTransactionReceipt({ hash: claimTx });
  console.log(JSON.stringify({ mode: 'run', withdrawTx: txHash, position: ev.position, claimTx, claimStatus: cr.status }, big, 2));
  if (cr.status !== 'success') process.exit(1);
}

const mode = process.argv[2] || 'check';
(mode === 'check' ? check() : mode === 'run' ? run() : Promise.reject(new Error('usage: canonical-claim.mjs check|run')))
  .catch((e) => {
    log(`FAILED: ${e.shortMessage || e.message}`);
    process.exit(1);
  });
