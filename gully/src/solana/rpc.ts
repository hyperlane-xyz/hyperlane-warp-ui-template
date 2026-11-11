// Minimal Solana JSON-RPC over fetch (no @solana/web3.js), with the chain's RPC list as a fallback.
import { CHAINS } from '../config/chains';

let seq = 0;
export async function solRpc<T>(method: string, params: unknown[]): Promise<T> {
  let last: unknown;
  for (const url of CHAINS.solanadevnet.rpcs) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params }),
      });
      const j = (await res.json()) as { result?: T; error?: { message?: string } };
      if (j.error) throw new Error(j.error.message || `${method} failed`);
      return j.result as T;
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error(`${method} failed`);
}

export function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function toBase64(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

export async function getAccount(address: string): Promise<{ data: Uint8Array; owner: string; lamports: number } | null> {
  const r = await solRpc<{ value: { data: [string, string]; owner: string; lamports: number } | null }>('getAccountInfo', [
    address,
    { encoding: 'base64', commitment: 'confirmed' },
  ]);
  return r.value ? { data: fromBase64(r.value.data[0]), owner: r.value.owner, lamports: r.value.lamports } : null;
}

export async function getSolBalance(address: string): Promise<bigint> {
  const r = await solRpc<{ value: number }>('getBalance', [address, { commitment: 'confirmed' }]);
  return BigInt(r.value);
}

/** Sum of the owner's token accounts for `mint`, in base units. */
export async function getSplBalance(owner: string, mint: string): Promise<bigint> {
  const r = await solRpc<{ value: { account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } } }[] }>(
    'getTokenAccountsByOwner',
    [owner, { mint }, { encoding: 'jsonParsed', commitment: 'confirmed' }],
  );
  return r.value.reduce((a, x) => a + BigInt(x.account.data.parsed.info.tokenAmount.amount), 0n);
}

export async function getLatestBlockhash(): Promise<string> {
  const r = await solRpc<{ value: { blockhash: string } }>('getLatestBlockhash', [{ commitment: 'finalized' }]);
  return r.value.blockhash;
}

export async function simulate(txBase64: string): Promise<{ err: unknown; logs: string[]; returnData?: Uint8Array }> {
  const r = await solRpc<{ value: { err: unknown; logs: string[] | null; returnData?: { data: [string, string] } | null } }>(
    'simulateTransaction',
    [txBase64, { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true, commitment: 'confirmed' }],
  );
  return {
    err: r.value.err,
    logs: r.value.logs || [],
    returnData: r.value.returnData?.data?.[0] ? fromBase64(r.value.returnData.data[0]) : undefined,
  };
}

export async function getTx(signature: string): Promise<{ err: unknown; logs: string[] } | null> {
  const r = await solRpc<{ meta: { err: unknown; logMessages: string[] | null } | null } | null>('getTransaction', [
    signature,
    { encoding: 'json', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
  ]);
  return r?.meta ? { err: r.meta.err, logs: r.meta.logMessages || [] } : null;
}

export async function lastSignatureFor(address: string): Promise<string | undefined> {
  const r = await solRpc<{ signature: string }[]>('getSignaturesForAddress', [address, { limit: 1, commitment: 'confirmed' }]);
  return r[0]?.signature;
}
