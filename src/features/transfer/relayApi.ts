import { ProviderType, TypedTransactionReceipt } from '@hyperlane-xyz/sdk';
import { ProtocolType, isNullish } from '@hyperlane-xyz/utils';

import { config } from '../../consts/config';
import { logger } from '../../utils/logger';

// keccak256("MessageSent(bytes)") — emitted by MessageTransmitter V2 for both native USDC
// transfers (depositForBurn) and GMP-only messages. Covers CCTP V2 GMP that lacks DepositForBurn.
const MESSAGE_SENT_TOPIC = '0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036';

// Circle's MessageTransmitter V2 addresses (lowercase for comparison).
// Source: https://developers.circle.com/cctp/references/contract-addresses#messagetransmitterv2
const MESSAGE_TRANSMITTER_V2_ADDRESSES = new Set([
  '0x81d40f21f12a8f0e3252bccb954d722d4c464b64', // mainnet (all chains except EDGE)
  '0x5b61381fc9e58e70efc13a4a97516997019198ee', // mainnet EDGE
  '0xe737e5cebeeba77efe34d4aa090756590b1ce275', // testnet (all chains)
]);

interface RelayResponse {
  messages: Array<{
    message_id: string;
    origin: number;
    destination: number;
    nonce: number;
  }>;
}

/**
 * Submits an origin transaction hash to the relayer API for fast CCTP processing.
 * Fire-and-forget: errors are logged but never surfaced to the user.
 */
export async function submitToRelayApi(
  originChain: string,
  txHash: string,
  originProtocol: ProtocolType,
  txReceipt: TypedTransactionReceipt | null | undefined,
): Promise<void> {
  if (!config.relayApiUrl) return;

  try {
    const isCctp =
      originProtocol === ProtocolType.Ethereum &&
      !isNullish(txReceipt) &&
      (txReceipt.type === ProviderType.EthersV5 || txReceipt.type === ProviderType.Viem) &&
      txReceipt.receipt.logs.some(
        (log) =>
          log.topics[0] === MESSAGE_SENT_TOPIC &&
          MESSAGE_TRANSMITTER_V2_ADDRESSES.has(log.address.toLowerCase()),
      );
    if (!isCctp) return;

    const baseUrl = config.relayApiUrl.replace(/\/$/, '');
    const payload = { origin_chain: originChain, tx_hash: txHash };
    logger.debug('[RelayAPI] Requesting relay', { url: `${baseUrl}/relay`, payload });
    const response = await fetch(`${baseUrl}/relay`, {
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
