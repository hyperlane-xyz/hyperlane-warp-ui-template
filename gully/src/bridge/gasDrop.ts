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
]);

export interface GasDropState {
  dropped: boolean;
  dropAmount: bigint;
  remainingToday: bigint;
}

export function gasDropEnabled(address: string = GAS_DROP_ADDRESS): address is Address {
  return isAddress(address);
}

export function dropEligible(s: GasDropState): boolean {
  return !s.dropped && s.dropAmount > 0n && s.remainingToday >= s.dropAmount;
}

/** Only deposits into GullyChain of something that is not gas there (USDC, USDT, BNB, SOL...). */
export function dropApplies(o: { direction: 'deposit' | 'withdraw'; receive: { tokenType: string } }): boolean {
  return o.direction === 'deposit' && o.receive.tokenType !== 'native';
}

export async function readGasDrop(recipient: Address, address: string = GAS_DROP_ADDRESS): Promise<GasDropState | undefined> {
  if (!gasDropEnabled(address)) return undefined;
  const c = pub(CHILD);
  const [dropped, dropAmount, remainingToday] = await Promise.all([
    c.readContract({ address, abi: gasDropAbi, functionName: 'dropped', args: [recipient] }),
    c.readContract({ address, abi: gasDropAbi, functionName: 'dropAmount' }),
    c.readContract({ address, abi: gasDropAbi, functionName: 'remainingToday' }),
  ]);
  return { dropped, dropAmount, remainingToday };
}
