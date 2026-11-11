// The transfer history in localStorage (`gully-bridge:transfers`, the same key as before the multi-chain bridge).
// Older records (classic lanes only) are migrated on load: every field a v2 record needs gets its old implied value.
import { CHAINS, CHILD, type ChainKey } from '../config/chains';
import type { TransferRecord } from './types';

export const STORE = 'gully-bridge:transfers';
export const MAX_RECORDS = 50;

const FINAL = ['delivered', 'claimed', 'failed'];

export function migrateTransfers(raw: unknown): TransferRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: TransferRecord[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const t = r as Partial<TransferRecord>;
    if (typeof t.id !== 'string' || typeof t.originTx !== 'string') continue;
    if (!t.from || !t.to || !(t.from in CHAINS) || !(t.to in CHAINS)) continue;
    const now = Date.now();
    out.push({
      ...t,
      v: 2,
      id: t.id,
      originTx: t.originTx,
      from: t.from,
      to: t.to,
      kind: t.kind === 'canonical' ? 'canonical' : 'fast',
      direction: t.direction || (t.to === CHILD ? 'deposit' : 'withdraw'),
      amount: String(t.amount ?? '0'),
      sendSymbol: t.sendSymbol || 'ETH',
      receiveSymbol: t.receiveSymbol || 'ETH',
      sender: t.sender || '',
      recipient: t.recipient || t.sender || '',
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : now,
      updatedAt: typeof t.updatedAt === 'number' ? t.updatedAt : now,
      status: t.status || 'sent',
      etaSeconds: typeof t.etaSeconds === 'number' ? t.etaSeconds : 75,
      decimals: t.decimals ?? 18,
      receiveDecimals: t.receiveDecimals ?? t.decimals ?? 18,
    });
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export function loadTransfers(): TransferRecord[] {
  try {
    return migrateTransfers(JSON.parse(localStorage.getItem(STORE) || '[]'));
  } catch {
    return [];
  }
}

export function saveTransfers(list: TransferRecord[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(list.slice(0, MAX_RECORDS)));
  } catch {
    /* storage unavailable */
  }
}

export function isOpen(t: TransferRecord) {
  return !FINAL.includes(t.status);
}

/** the chain on the other side of GullyChain */
export function remoteOf(t: Pick<TransferRecord, 'from' | 'to'>): ChainKey {
  return t.from === CHILD ? t.to : t.from;
}
