import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { decodeFunctionData, decodeFunctionResult, encodeFunctionData, parseAbi } from 'viem';

import { getRouteTxs, isApprovalRouteTx, toEvmRouteTx } from '../../api/routeTx';
import type { RouteResponse } from '../../api/types';
import { requireTurkchainOperationalReadiness } from './turkchainEthEvidence';

export const TURKCHAIN_ETH_ROUTE = 'ETH/ethereum-turkchain';
const ROUTERS: Record<number, `0x${string}`> = {
  1: '0xd13d97c537620ed5762343b78534c7581ed3a2fc',
  1919: '0xbf9569b06bcb6ccf776302b0697c79b8407d8e3f',
};
const MAILBOXES: Record<number, string> = {
  1: '0xc005dc82818d67af737725bd4bf75435d065d239',
  1919: '0x5a1a042619aae32c5282db94769f78df93aeee6d',
};
const ABI = parseAbi([
  'function transferRemote(uint32 destination,bytes32 recipient,uint256 amount) payable returns(bytes32)',
  'function routers(uint32) view returns(bytes32)',
  'function mailbox() view returns(address)',
  'function isolationActive() view returns(bool)',
  'function collateralRouter() view returns(address)',
  'function legacySupply() view returns(uint256)',
  'function totalSupply() view returns(uint256)',
  'function totalRedemptionCredit() view returns(uint256)',
  'function redemptionCredit(address) view returns(uint256)',
]);
const MINIMUM = 44_000_000_000_000n;
const LEGACY = 500n * 10n ** 18n;
const requireSafe = (ok: unknown, reason: string) => {
  if (!ok) throw new Error(`Turkchain ETH: ${reason}`);
};

export function isTurkchainEthRoute(route: RouteResponse): boolean {
  return (
    route.connection?.warpRouteId === TURKCHAIN_ETH_ROUTE ||
    getRouteTxs(route).some((tx) => {
      const evm = toEvmRouteTx(tx);
      return evm && Object.values(ROUTERS).some((r) => r === evm.to.toLowerCase());
    }) ||
    route.steps.some((s) => s.type === 'bridge' && s.warpRouteId === TURKCHAIN_ETH_ROUTE)
  );
}

// Send-time preflight is independent of quoted source fees. A token balance can
// include legacy supply that the isolated synthetic deliberately cannot redeem.
// No approvals, wallet sends, claims or source-gas sponsorship are performed here.
export async function validateTurkchainEthTransfer({
  route,
  source,
  destination,
  sender,
  recipient,
  multiProvider,
}: {
  route: RouteResponse;
  source: number;
  destination: number;
  sender: string;
  recipient: string;
  multiProvider: MultiProtocolProvider;
}) {
  if (!isTurkchainEthRoute(route)) return;
  requireSafe(
    (source === 1 && destination === 1919) || (source === 1919 && destination === 1),
    'unsupported direction',
  );
  requireSafe(route.steps.length === 1, 'only direct bridge transfers are supported');
  const txs = getRouteTxs(route);
  requireSafe(txs.length === 1 && !txs.some(isApprovalRouteTx), 'unexpected transaction plan');
  const tx = toEvmRouteTx(txs[0]);
  requireSafe(tx && tx.to.toLowerCase() === ROUTERS[source], 'unexpected source router');
  if (!tx) return; // Type narrowing; the preceding guard always throws.
  const decoded = decodeFunctionData({ abi: ABI, data: tx.data as `0x${string}` });
  requireSafe(decoded.functionName === 'transferRemote', 'unexpected router call');
  const [domain, receiver, amount] = decoded.args as readonly [number, string, bigint];
  requireSafe(domain === destination, 'wrong destination domain');
  requireSafe(
    /^0x[0-9a-f]{40}$/i.test(recipient) &&
      BigInt(recipient) !== 0n &&
      receiver.toLowerCase() === `0x${recipient.slice(2).toLowerCase().padStart(64, '0')}`,
    'wrong recipient',
  );
  requireSafe(amount >= MINIMUM, 'amount below on-chain minimum');
  requireSafe(
    route.steps[0].type === 'bridge' &&
      route.steps[0].chain === source &&
      route.steps[0].destChain === destination &&
      (route.steps[0].warpRouteId === undefined ||
        route.steps[0].warpRouteId === TURKCHAIN_ETH_ROUTE) &&
      BigInt(route.steps[0].amountIn) === amount,
    'quoted bridge step differs from transaction',
  );
  await requireTurkchainOperationalReadiness();
  const providers = Object.fromEntries(
    [1, 1919].map((id) => [id, multiProvider.getEthersV5Provider(id)]),
  );
  const read = async (id: number, name: string, args: readonly unknown[] = []) => {
    const data = encodeFunctionData({ abi: ABI, functionName: name, args } as never);
    const result = await providers[id].call({ to: ROUTERS[id], data });
    return decodeFunctionResult({ abi: ABI, functionName: name, data: result } as never);
  };
  await Promise.all(
    [1, 1919].map(async (id) => {
      requireSafe((await providers[id].getNetwork()).chainId === id, 'RPC chain mismatch');
      const [mailbox, remote] = await Promise.all([
        read(id, 'mailbox'),
        read(id, 'routers', [id === 1 ? 1919 : 1]),
      ]);
      requireSafe(String(mailbox).toLowerCase() === MAILBOXES[id], 'mailbox mismatch');
      const peer = ROUTERS[id === 1 ? 1919 : 1];
      requireSafe(
        String(remote).toLowerCase() === `0x${peer.slice(2).padStart(64, '0')}`,
        'router enrollment mismatch',
      );
    }),
  );
  const [isolated, collateralRouter, legacy, supply, credit, reserve] = await Promise.all([
    read(1919, 'isolationActive'),
    read(1919, 'collateralRouter'),
    read(1919, 'legacySupply'),
    read(1919, 'totalSupply'),
    read(1919, 'totalRedemptionCredit'),
    providers[1].getBalance(ROUTERS[1]),
  ]);
  requireSafe(
    isolated === true &&
      String(collateralRouter).toLowerCase() === ROUTERS[1] &&
      BigInt(String(legacy)) === LEGACY &&
      BigInt(String(supply)) - LEGACY === BigInt(String(credit)) &&
      BigInt(reserve.toString()) >= BigInt(String(credit)),
    'isolated collateral accounting could not be verified',
  );
  if (source === 1919) {
    const redeemable = BigInt(String(await read(1919, 'redemptionCredit', [sender])));
    requireSafe(
      redeemable >= amount,
      'amount exceeds backed redemption credit; legacy ETH is not bridge collateral',
    );
    requireSafe(BigInt(tx.value) === 0n, 'unexpected native source fee');
    await providers[1].call({
      from: ROUTERS[1],
      to: recipient,
      value: '0x' + amount.toString(16),
      data: '0x',
    });
  } else {
    requireSafe(BigInt(tx.value) >= amount, 'native ETH collateral missing');
  }
  // Always simulate the exact populated source transaction, including quoted
  // value, even when the quote already supplies a sourceTransactionFee.
  await providers[source].call({ from: sender, to: tx.to, data: tx.data, value: tx.value });
}
