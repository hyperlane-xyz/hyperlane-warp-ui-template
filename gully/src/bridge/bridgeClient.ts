// The seam between the UI and the bridge logic. The UI only ever calls getBridgeClient().
// When @gullylabs/bridge-sdk (GullyBridgeRouter, integrator fees) is ready, in boot.tsx:
//   import { createGullyBridgeClient } from '@gullylabs/bridge-sdk';
//   setBridgeClient(createGullyBridgeClient({ ... }));
// It must implement BridgeClient; `req.ref` carries the integrator address from ?ref=.
import type { Address } from 'viem';

import { localBridgeClient, type Balances } from './localClient';
import { loadStats, type BridgeStats } from './stats';
import type { ActivityItem, Quote, QuoteRequest, StepUpdate, TransferRecord } from './types';

export interface BridgeClient {
  id: string;
  quote(req: QuoteRequest): Promise<Quote>;
  execute(quote: Quote, onStep: (u: StepUpdate) => void): Promise<TransferRecord>;
  track(rec: TransferRecord): Promise<TransferRecord>;
  claim(rec: TransferRecord, onStep: (u: StepUpdate) => void): Promise<TransferRecord>;
  withdrawalsOf(address: Address): Promise<TransferRecord[]>;
  balances(address: Address, fastRouteId?: string): Promise<Balances>;
  recentActivity(limit?: number): Promise<ActivityItem[]>;
  /** live analytics for the charts */
  stats(): Promise<BridgeStats>;
}

let current: BridgeClient = { ...localBridgeClient, stats: loadStats };
const subs = new Set<() => void>();

export function getBridgeClient(): BridgeClient {
  return current;
}

export function setBridgeClient(c: BridgeClient) {
  current = c;
  subs.forEach((f) => f());
}

export function onBridgeClientChange(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

export type { Balances };
