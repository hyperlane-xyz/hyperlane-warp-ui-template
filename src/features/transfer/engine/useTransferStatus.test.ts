import { describe, expect, test } from 'vitest';

import { detectDestinationOutcome } from './useTransferStatus';

const RECIPIENT = '0x3Fb137161365f273Ebb8262a26569C117b6CBAfb';
const BRIDGE_TOKEN = '0x1111111111111111111111111111111111111111';
const DST_TOKEN = '0x2222222222222222222222222222222222222222';
const ICA = '0x3333333333333333333333333333333333333333';
const ROUTER = '0x4444444444444444444444444444444444444444';
const POOL = '0x5555555555555555555555555555555555555555';
const HASH = '0xhash';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

describe('detectDestinationOutcome', () => {
  test('treats native destination output as success when no fallback transfer is emitted', async () => {
    await expect(
      detectDestinationOutcome(receiptProvider([]), HASH, RECIPIENT, BRIDGE_TOKEN, DST_TOKEN, true),
    ).resolves.toBe('success');
  });

  test('detects fallback recovery for native destination output', async () => {
    await expect(
      detectDestinationOutcome(
        receiptProvider([transferLog(BRIDGE_TOKEN, ICA, RECIPIENT)]),
        HASH,
        RECIPIENT,
        BRIDGE_TOKEN,
        DST_TOKEN,
        true,
      ),
    ).resolves.toBe('failed_recovered');
  });

  test('treats bridge-token dust swept by the swap router as native success', async () => {
    await expect(
      detectDestinationOutcome(
        receiptProvider([
          transferLog(BRIDGE_TOKEN, ICA, ROUTER),
          transferLog(BRIDGE_TOKEN, ROUTER, POOL),
          transferLog(BRIDGE_TOKEN, ROUTER, RECIPIENT),
        ]),
        HASH,
        RECIPIENT,
        BRIDGE_TOKEN,
        DST_TOKEN,
        true,
      ),
    ).resolves.toBe('success');
  });
});

function receiptProvider(logs: Array<{ topics: string[]; address: string }>) {
  return {
    async getTransactionReceipt() {
      return { logs };
    },
  };
}

function transferLog(address: string, from: string, to: string) {
  return {
    address,
    topics: [TRANSFER_TOPIC, addressTopic(from), addressTopic(to)],
  };
}

function addressTopic(address: string) {
  return `0x${'00'.repeat(12)}${address.slice(2)}`;
}
