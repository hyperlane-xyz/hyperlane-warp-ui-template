import { config } from '../../consts/config';
import type { CallCommitment, SolanaCommitment } from '../api/types';

// POST the engine-assembled CCS body to the CallCommitmentsService.
// Must run BEFORE broadcasting the origin tx — the relayer fetches
// these calls at reveal time to verify the commitment hash on-chain.
export async function postCommitment(
  commitment: CallCommitment | SolanaCommitment,
): Promise<void> {
  const url = `${config.ccsUrl.replace(/\/$/, '')}${commitment.ccs.path}`;
  const res = await fetch(url, {
    method: commitment.ccs.method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(commitment.ccs.body),
  });
  if (!res.ok) {
    throw new Error(`CCS post failed: ${res.status} ${await res.text()}`);
  }
}
