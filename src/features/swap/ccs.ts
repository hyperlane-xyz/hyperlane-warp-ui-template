import { config } from '../../consts/config';
import { logger } from '../../utils/logger';
import type { CallCommitment } from '../api/types';

// POST the engine-assembled CCS body to the CallCommitmentsService.
// Must run BEFORE broadcasting the origin tx — the relayer fetches
// these calls at reveal time to verify the commitment hash on-chain.
export async function postCommitment(callCommitment: CallCommitment): Promise<void> {
  const url = `${config.ccsUrl.replace(/\/$/, '')}${callCommitment.ccs.path}`;
  logger.info('[ccs] POST', { url, callsCount: callCommitment.ccs.body.calls.length });
  const res = await fetch(url, {
    method: callCommitment.ccs.method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(callCommitment.ccs.body),
  });
  const responseText = res.ok ? '' : await res.text();
  logger.info('[ccs] response', { status: res.status, ok: res.ok, body: responseText });
  if (!res.ok) {
    throw new Error(`CCS post failed: ${res.status} ${responseText}`);
  }
}
