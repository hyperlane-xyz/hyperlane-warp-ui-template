import { logger } from '../utils/logger';

interface AttestationRequest {
  to: string;
  from: string;
  data: string;
  msg_value: string;
  chain: string;
}

interface AttestationResponse {
  attestation: {
    uuid: string;
    [key: string]: any;
  };
}

/**
 * Proxy client for Predicate API that routes through Next.js API route
 * to avoid CORS issues
 */
class PredicateProxyClient {
  private proxyUrl = '/api/predicate/attestation';

  async fetchAttestation(request: AttestationRequest): Promise<AttestationResponse> {
    const response = await fetch(this.proxyUrl, {
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
}

let predicateClientInstance: PredicateProxyClient | null = null;

/**
 * Get or create singleton PredicateProxyClient instance
 * Returns null if API key not configured
 */
export function getPredicateClient(): PredicateProxyClient | null {
  if (predicateClientInstance) {
    return predicateClientInstance;
  }

  const apiKey = process.env.NEXT_PUBLIC_PREDICATE_API_KEY;

  if (!apiKey) {
    logger.debug('Predicate API key not configured, attestation support disabled');
    return null;
  }

  predicateClientInstance = new PredicateProxyClient();
  logger.debug('Predicate proxy client initialized');

  return predicateClientInstance;
}
