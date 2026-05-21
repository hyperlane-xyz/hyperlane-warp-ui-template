import { config } from '../../consts/config';
import type { CallCommitment } from '../api/types';

// POST the engine-assembled CCS body to the CallCommitmentsService.
// Must run BEFORE broadcasting the origin tx — the relayer fetches
// these calls at reveal time to verify the commitment hash on-chain.
export async function postCommitment(callCommitment: CallCommitment): Promise<void> {
  const url = `${config.ccsUrl.replace(/\/$/, '')}${callCommitment.ccs.path}`;
  const res = await fetch(url, {
    method: callCommitment.ccs.method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(callCommitment.ccs.body),
  });
  if (!res.ok) {
    throw new Error(`CCS post failed: ${res.status} ${await res.text()}`);
  }
}
