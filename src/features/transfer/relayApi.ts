import { config } from '../../consts/config';
import { logger } from '../../utils/logger';

interface RelayResponse {
  messages: Array<{
    message_id: string;
    origin: number;
    destination: number;
    nonce: number;
  }>;
}

/**
 * Submits an origin transaction hash to the relayer API for fast processing.
 * Fire-and-forget: errors are logged but never surfaced to the user.
 */
export async function submitToRelayApi(originChain: string, txHash: string): Promise<void> {
  if (!config.relayApiUrl) return;

  try {
    const payload = { origin_chain: originChain, tx_hash: txHash };
    console.log('[RelayAPI] Requesting relay', { url: `${config.relayApiUrl}/relay`, payload });
    const response = await fetch(`${config.relayApiUrl}/relay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.warn(`[RelayAPI] ${response.status} for ${txHash} on ${originChain}: ${text}`);
      return;
    }

    const data: RelayResponse = await response.json();
    logger.debug(
      `[RelayAPI] Accepted ${data.messages.length} message(s) from ${txHash} on ${originChain}`,
      data.messages.map((m) => m.message_id),
    );
  } catch (error) {
    logger.warn(`[RelayAPI] Failed to submit ${txHash} on ${originChain}`, error);
  }
}
