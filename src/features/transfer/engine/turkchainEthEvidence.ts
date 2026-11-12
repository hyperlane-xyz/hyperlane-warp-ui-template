import { z } from 'zod';

// This is the public observation verification key, never an EVM signing key.
export const TURKCHAIN_OBSERVATION_PUBLIC_DER =
  'MCowBQYDK2VwAyEAe5/Y8a+NSwbPcBv8KCO5XYoYsxMApVbCS7cGGiEtQgQ=';
const CONFIG_SHA = 'ea17108ece1dbe9aa9a12d4704333525f689f49da021af5e53b03ce78080c1ec';
const CONTAINER = '20765e28dd7063bba0f62574190d0fa04edb2ca3b4b86c14dd7985712522a18a';
const POLICY: Record<
  number,
  {
    daily: string;
    message: string;
    fee: string;
    minimum: string;
    finality: number;
    signer: string;
    router: string;
    mailbox: string;
  }
> = {
  1: {
    daily: '500000000000000',
    message: '250000000000000',
    fee: '1000000000',
    minimum: '500000000000000',
    finality: 64,
    signer: '0xfcd5afa38a99c564b3deb61ecb518cd421f298a2',
    router: '0xd13d97c537620ed5762343b78534c7581ed3a2fc',
    mailbox: '0xc005dc82818d67af737725bd4bf75435d065d239',
  },
  1919: {
    daily: '30000000000000000',
    message: '3000000000000000',
    fee: '5000000000',
    minimum: '5000000000000000',
    finality: 24,
    signer: '0x5b491b52ef948f9a60d75d2a56235fbfb8644f0b',
    router: '0xbf9569b06bcb6ccf776302b0697c79b8407d8e3f',
    mailbox: '0x5a1a042619aae32c5282db94769f78df93aeee6d',
  },
};
const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const need = (ok: unknown) => {
  if (!ok) throw new Error('Turkchain ETH: fresh signed operational readiness is unavailable');
};
const decimal = (x: unknown): x is string =>
  typeof x === 'string' && /^(0|[1-9][0-9]{0,77})$/.test(x);
const fresh = (t: string, now: number, ttl: number) =>
  Number.isFinite(Date.parse(t)) && Date.parse(t) <= now && now - Date.parse(t) <= ttl;

const booleanHealthSchema = z
  .object({
    rpcHealthy: z.literal(true),
    metricsFresh: z.literal(true),
    checkpointVerified: z.literal(true),
  })
  .passthrough();
const operationalFlagsSchema = z
  .object({
    running: z.literal(true),
    deliveryEnabled: z.literal(true),
    noUserAllowlist: z.literal(true),
    ethereumToTurkchain: z.literal(true),
    turkchainToEthereum: z.literal(true),
    supervisorHealthy: z.literal(true),
    credentialReady: z.literal(true),
    kmsBindingsVerified: z.literal(true),
    budget: z
      .object({
        enforcementVerified: z.literal(true),
        allRouterMessagesAccounted: z.literal(true),
        inflightReconciled: z.literal(true),
        destinationGasBudgetVerified: z.literal(true),
      })
      .passthrough(),
    chains: z.object({ '1': booleanHealthSchema, '1919': booleanHealthSchema }).passthrough(),
  })
  .passthrough();

export async function verifyTurkchainEvidence(
  envelope: { payload: string; signature: string },
  now = Date.now(),
  publicKey = TURKCHAIN_OBSERVATION_PUBLIC_DER,
) {
  need(
    envelope &&
      typeof envelope.payload === 'string' &&
      envelope.payload.length < 17000 &&
      typeof envelope.signature === 'string',
  );
  const payload = bytes(envelope.payload),
    signature = bytes(envelope.signature);
  need(signature.length === 64 && payload.length <= 12000);
  const key = await crypto.subtle.importKey('spki', bytes(publicKey), { name: 'Ed25519' }, false, [
    'verify',
  ]);
  need(await crypto.subtle.verify({ name: 'Ed25519' }, key, signature, payload));
  const p = JSON.parse(new TextDecoder().decode(payload));
  operationalFlagsSchema.parse(p);
  need(p.schemaVersion === 2 && p.environment === 'production' && p.host === '130.162.36.234');
  need(
    fresh(p.observedAt, now, 90000) &&
      Date.parse(p.expiresAt) > now &&
      Date.parse(p.expiresAt) - Date.parse(p.observedAt) <= 90000,
  );
  need(
    p.sourceGasPayer === 'user' &&
      p.destinationGasPayer === 'project' &&
      p.transferModel === 'direct-release',
  );
  need(
    p.running === true &&
      p.deliveryEnabled === true &&
      p.noUserAllowlist === true &&
      p.ethereumToTurkchain === true &&
      p.turkchainToEthereum === true &&
      p.supervisorHealthy === true &&
      p.credentialReady === true &&
      p.kmsBindingsVerified === true,
  );
  need(
    p.container?.id === CONTAINER &&
      p.container?.processCount === 1 &&
      p.container?.database === '/data/relayer-turkchain' &&
      p.configSha256 === CONFIG_SHA,
  );
  need(
    p.budget?.enforcementVerified === true &&
      p.budget?.executor === 'R1-only' &&
      p.budget?.allRouterMessagesAccounted === true &&
      p.budget?.inflightReconciled === true &&
      p.budget?.destinationGasBudgetVerified === true,
  );
  for (const id of [1, 1919]) {
    const c = p.chains?.[id],
      b = p.budget.chains?.[id],
      expected = POLICY[id];
    need(
      c &&
        b &&
        c.domain === id &&
        c.signer === expected.signer &&
        c.router === expected.router &&
        c.mailbox === expected.mailbox,
    );
    need(
      fresh(c.checkedAt, now, 30000) &&
        c.rpcHealthy === true &&
        c.metricsFresh === true &&
        c.checkpointVerified === true &&
        c.finality === expected.finality,
    );
    need(
      Number.isSafeInteger(c.head) &&
        Number.isSafeInteger(c.indexed) &&
        c.head >= c.indexed &&
        c.head - c.indexed <= c.finality + 8,
    );
    need(
      Number.isSafeInteger(c.checkpointAnchorBlock) &&
        c.checkpointAnchorBlock >= 0 &&
        c.checkpointAnchorBlock <= c.head - c.finality &&
        c.head - c.finality - c.checkpointAnchorBlock <= c.finality &&
        c.checkpointIndex === c.finalizedTreeIndex,
    );
    need(
      decimal(c.balanceWei) &&
        c.minimumBalanceWei === expected.minimum &&
        BigInt(c.balanceWei) >= BigInt(expected.minimum),
    );
    need(
      b.dailyLimitWei === expected.daily &&
        b.messageLimitWei === expected.message &&
        b.maxFeeWei === expected.fee &&
        b.maxGas === 700000,
    );
    need(
      decimal(b.spentWei) &&
        decimal(b.reservedWei) &&
        BigInt(b.spentWei) + BigInt(b.reservedWei) + BigInt(expected.message) <=
          BigInt(expected.daily),
    );
  }
}

export async function requireTurkchainOperationalReadiness() {
  const r = await fetch('https://bridge.turkscan.com/api/bridge/relayer-evidence', {
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  need(r.ok);
  await verifyTurkchainEvidence(await r.json());
}
