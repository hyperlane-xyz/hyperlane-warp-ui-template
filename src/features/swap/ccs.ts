import { config } from '../../consts/config';
import type { CallCommitment } from '../api/types';

/**
 * POST the commitment calldata to the CCS /calldata endpoint.
 * Must run BEFORE broadcasting the origin tx.
 */
export async function postCalldata(commitment: CallCommitment): Promise<void> {
  const baseUrl = config.ccsUrl.replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/calldata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(commitment.ccs.body),
  });
  if (!res.ok) {
    throw new Error(`CCS /calldata POST failed: ${res.status} ${await res.text()}`);
  }
}

// Alias for backwards-compatibility with existing callers.
export const postCommitment = postCalldata;
