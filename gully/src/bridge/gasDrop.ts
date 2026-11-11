// GullyGasDrop (gully-ops, GullyChain): a small ETH drop for gas on a wallet's first bridge of a non-ETH token, so the
// user can move what they bridged. The minimum transfer value is enforced off-chain by the dropper; the UI only shows
// eligibility = not dropped yet && today's budget covers one drop. Hidden while VITE_GAS_DROP_ADDRESS is unset.
// Gully ID passkey smart accounts never need it: the Gully paymaster sponsors their gas.
import { isAddress, parseAbi, type Address } from 'viem';

import { CHILD, GAS_DROP_ADDRESS } from '../config/chains';
import { pub } from './clients';

export const gasDropAbi = parseAbi([
  'function dropped(address) view returns (bool)',
  'function dropAmount() view returns (uint256)',
  'function remainingToday() view returns (uint256)',
  'function eligible(address) view returns (bool)',
]);

export interface GasDropState {
  dropped: boolean;
  dropAmount: bigint;
  remainingToday: bigint;
  /** the contract's own check (not dropped, no code, holds less than dropAmount, budget left); unset = not read */
  eligible?: boolean;
}

export function gasDropEnabled(address: string = GAS_DROP_ADDRESS): address is Address {
  return isAddress(address);
}

export function dropEligible(s: GasDropState): boolean {
  return !s.dropped && s.dropAmount > 0n && s.remainingToday >= s.dropAmount && s.eligible !== false;
}

/**
 * Only deposits into GullyChain of something that is not gas there (USDC, USDT, BNB, SOL...), and the "Bridge back" of
 * a Gully Warp Mirror (the classic pair's option is native ETH, but the transfer delivers the coin, not gas).
 */
export function dropApplies(o: { direction: 'deposit' | 'withdraw'; receive: { tokenType: string } }, mirror = false): boolean {
  return o.direction === 'deposit' && (mirror || o.receive.tokenType !== 'native');
}

export async function readGasDrop(recipient: Address, address: string = GAS_DROP_ADDRESS): Promise<GasDropState | undefined> {
  if (!gasDropEnabled(address)) return undefined;
  const c = pub(CHILD);
  const [dropped, dropAmount, remainingToday, eligible] = await Promise.all([
    c.readContract({ address, abi: gasDropAbi, functionName: 'dropped', args: [recipient] }),
    c.readContract({ address, abi: gasDropAbi, functionName: 'dropAmount' }),
    c.readContract({ address, abi: gasDropAbi, functionName: 'remainingToday' }),
    c.readContract({ address, abi: gasDropAbi, functionName: 'eligible', args: [recipient] }),
  ]);
  return { dropped, dropAmount, remainingToday, eligible };
}

/**
 * The coin the gas note names: what actually ARRIVES on GullyChain. A mirror "Bridge back" runs on the classic pair,
 * whose option says ETH, but it delivers the Gully Core coin (TFROG), so the note must never say "use your ETH".
 */
export function arrivingSymbol(b: {
  mirror?: { coinSymbol?: string } | undefined;
  quote?: { receiveSymbol?: string } | undefined;
  option?: { receive: { symbol: string } } | undefined;
}): string {
  return b.mirror?.coinSymbol || b.quote?.receiveSymbol || b.option?.receive.symbol || 'coins';
}
