import { logger } from '../utils/logger';

export interface RelayRequest {
  origin_chain: string;
  tx_hash: string;
}

export interface RelayResponse {
  job_id: string;
}

export enum RelayJobStatus {
  Pending = 'Pending',
  Extracting = 'Extracting',
  Preparing = 'Preparing',
  Submitting = 'Submitting',
  Submitted = 'Submitted',
  Confirmed = 'Confirmed',
  Failed = 'Failed',
}

export interface RelayJobStatusResponse {
  id: string;
  origin_chain: string;
  origin_tx_hash: string;
  message_id?: string;
  destination_chain?: string;
  status: RelayJobStatus;
  destination_tx_hash?: string;
  error?: string;
  created_at: number;
  updated_at: number;
  expires_at: number;
}

const RELAYER_BASE_URL = process.env.NEXT_PUBLIC_RELAYER_API_URL || 'http://localhost:9090';

/**
 * Initiates a relay job for a cross-chain transfer
 */
export async function initiateRelay(request: RelayRequest): Promise<RelayResponse> {
  const url = `${RELAYER_BASE_URL}/relay`;
  logger.debug('Initiating relay for tx:', request.tx_hash);
  logger.debug('Relay URL:', url);
  logger.debug('Request body:', JSON.stringify(request, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    logger.debug('Relay response status:', response.status, response.statusText);
    logger.debug('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Relay error response (text):', errorText);

      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: errorText || 'Failed to initiate relay' };
      }

      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    logger.debug('Relay response (text):', responseText);

    const data = JSON.parse(responseText);
    logger.debug('Relay initiated, job_id:', data.job_id);
    return data;
  } catch (error: any) {
    logger.error('Relay fetch error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause,
      url,
      baseUrl: RELAYER_BASE_URL,
    });
    throw error;
  }
}

/**
 * Checks the status of a relay job
 */
export async function checkRelayStatus(jobId: string): Promise<RelayJobStatusResponse> {
  const url = `${RELAYER_BASE_URL}/relay/${jobId}`;
  logger.debug('Checking relay status for jobId:', jobId, 'URL:', url);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.debug('Status check response:', response.status, response.statusText);
    logger.debug('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Status check error response:', errorText);

      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: errorText || 'Failed to check relay status' };
      }

      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    logger.debug('Status check response (text):', responseText);

    const data = JSON.parse(responseText);
    logger.debug('Status check parsed data:', data);
    return data;
  } catch (error: any) {
    logger.error('Relay status check error:', {
      message: error.message,
      name: error.name,
      url,
      jobId,
    });
    throw error;
  }
}
