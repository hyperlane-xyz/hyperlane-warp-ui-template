import { PredicateAttestationRequest, PredicateAttestationResponse } from '@hyperlane-xyz/sdk';

export type AttestationRequest = PredicateAttestationRequest;

const PREDICATE_PROXY_URL = '/api/predicate/attestation';

/**
 * Fetches Predicate attestation via Next.js API proxy route
 * Routes through backend to avoid CORS and keep API key server-side
 */
export async function fetchAttestation(
  request: AttestationRequest,
): Promise<PredicateAttestationResponse> {
  const response = await fetch(PREDICATE_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch attestation');
  }

  return response.json();
}
