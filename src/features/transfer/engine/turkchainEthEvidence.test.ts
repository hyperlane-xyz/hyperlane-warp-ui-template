import { generateKeyPairSync, sign } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { TURKCHAIN_OBSERVATION_PUBLIC_DER, verifyTurkchainEvidence } from './turkchainEthEvidence';
import fixture from './turkchainEthEvidence.fixture.json';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicDer = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const now = Date.now();
function payload() {
  const p = structuredClone(fixture);
  p.observedAt = new Date(now - 1000).toISOString();
  p.expiresAt = new Date(now + 60000).toISOString();
  for (const c of Object.values(p.chains)) c.checkedAt = new Date(now - 1000).toISOString();
  return p;
}
function envelope(p: unknown) {
  const bytes = Buffer.from(JSON.stringify(p));
  return {
    payload: bytes.toString('base64'),
    signature: sign(null, bytes, privateKey).toString('base64'),
  };
}
describe('signed Turkchain route readiness', () => {
  it('accepts valid Ed25519 fixture with RAM-only test key', async () => {
    await verifyTurkchainEvidence(envelope(payload()), now, publicDer);
  });
  it('production verification uses an independent pinned public key', async () => {
    expect(TURKCHAIN_OBSERVATION_PUBLIC_DER).not.toBe(publicDer);
    await expect(verifyTurkchainEvidence(envelope(payload()), now)).rejects.toThrow();
  });
  const mutations = {
    stale: (p: ReturnType<typeof payload>) => (p.observedAt = new Date(now - 91000).toISOString()),
    expired: (p: ReturnType<typeof payload>) => (p.expiresAt = new Date(now - 1).toISOString()),
    wrongSigner: (p: ReturnType<typeof payload>) => (p.chains[1].signer = p.chains[1919].signer),
    wrongRouter: (p: ReturnType<typeof payload>) => (p.chains[1].router = p.chains[1919].router),
    staleMetrics: (p: ReturnType<typeof payload>) =>
      (p.chains[1].checkedAt = new Date(now - 31000).toISOString()),
    weakerFinality: (p: ReturnType<typeof payload>) => (p.chains[1].finality = 1),
    wrongContainer: (p: ReturnType<typeof payload>) => (p.container.id = 'wrong'),
    unlimitedBudget: (p: ReturnType<typeof payload>) => (p.budget.enforcementVerified = false),
    highDailyCap: (p: ReturnType<typeof payload>) =>
      (p.budget.chains[1].dailyLimitWei = '9999999999999999'),
    highMessageCap: (p: ReturnType<typeof payload>) =>
      (p.budget.chains[1].messageLimitWei = '9999999999999999'),
    budgetExhausted: (p: ReturnType<typeof payload>) =>
      (p.budget.chains[1].spentWei = p.budget.chains[1].dailyLimitWei),
  };
  for (const [name, change] of Object.entries(mutations))
    it('rejects ' + name, async () => {
      const p = payload();
      change(p);
      await expect(verifyTurkchainEvidence(envelope(p), now, publicDer)).rejects.toThrow();
    });
  it('rejects tampered signed bytes', async () => {
    const e = envelope(payload());
    e.payload = Buffer.from('{}').toString('base64');
    await expect(verifyTurkchainEvidence(e, now, publicDer)).rejects.toThrow();
  });
});
