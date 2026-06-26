import { describe, expect, test } from 'vitest';

import { detectSwapOutcome } from './useSwapStatus';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const RECIPIENT = '0x1111111111111111111111111111111111111111';
const BRIDGE_TOKEN = '0x2222222222222222222222222222222222222222';
const DST_TOKEN = '0x3333333333333333333333333333333333333333';
const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';

function transferLog(token: string, to: string, amount = 1n) {
  return {
    address: token,
    data: `0x${amount.toString(16).padStart(64, '0')}`,
    topics: [
      TRANSFER_TOPIC,
      `0x${'0'.repeat(64)}`,
      `0x${'0'.repeat(24)}${to.slice(2).toLowerCase()}`,
    ],
  };
}

function providerWithLogs(
  logs: Array<{ topics: string[]; address: string; data?: string }>,
  status?: number | string | boolean | null,
) {
  return {
    getTransactionReceipt: async () => ({ logs, status }),
  };
}

describe('detectSwapOutcome', () => {
  test('returns success when the destination token is transferred to the recipient', async () => {
    await expect(
      detectSwapOutcome(
        providerWithLogs([transferLog(DST_TOKEN, RECIPIENT)]),
        '0xhash',
        RECIPIENT,
        BRIDGE_TOKEN,
        DST_TOKEN,
      ),
    ).resolves.toBe('success');
  });

  test('requires destination token transfers to meet the minimum output when known', async () => {
    await expect(
      detectSwapOutcome(
        providerWithLogs([
          transferLog(DST_TOKEN, RECIPIENT, 40n),
          transferLog(DST_TOKEN, RECIPIENT, 50n),
        ]),
        '0xhash',
        RECIPIENT,
        BRIDGE_TOKEN,
        DST_TOKEN,
        '90',
      ),
    ).resolves.toBe('success');

    await expect(
      detectSwapOutcome(
        providerWithLogs([transferLog(DST_TOKEN, RECIPIENT, 89n)]),
        '0xhash',
        RECIPIENT,
        BRIDGE_TOKEN,
        DST_TOKEN,
        '90',
      ),
    ).resolves.toBe('dest_failed');
  });

  test('ignores zero-value destination and fallback transfers', async () => {
    await expect(
      detectSwapOutcome(
        providerWithLogs([
          transferLog(DST_TOKEN, RECIPIENT, 0n),
          transferLog(BRIDGE_TOKEN, RECIPIENT, 0n),
        ]),
        '0xhash',
        RECIPIENT,
        BRIDGE_TOKEN,
        DST_TOKEN,
      ),
    ).resolves.toBe('dest_failed');
  });

  test('returns failed_recovered when bridge token fallback is transferred to the recipient', async () => {
    await expect(
      detectSwapOutcome(
        providerWithLogs([transferLog(BRIDGE_TOKEN, RECIPIENT)]),
        '0xhash',
        RECIPIENT,
        BRIDGE_TOKEN,
        DST_TOKEN,
      ),
    ).resolves.toBe('failed_recovered');
  });

  test('returns dest_failed when neither destination nor fallback transfer is found', async () => {
    await expect(
      detectSwapOutcome(providerWithLogs([]), '0xhash', RECIPIENT, BRIDGE_TOKEN, DST_TOKEN),
    ).resolves.toBe('dest_failed');
  });

  test('treats native output as success unless bridge-token fallback was delivered', async () => {
    await expect(
      detectSwapOutcome(providerWithLogs([]), '0xhash', RECIPIENT, BRIDGE_TOKEN, NATIVE_TOKEN),
    ).resolves.toBe('success');

    await expect(
      detectSwapOutcome(
        providerWithLogs([transferLog(BRIDGE_TOKEN, RECIPIENT)]),
        '0xhash',
        RECIPIENT,
        BRIDGE_TOKEN,
        NATIVE_TOKEN,
      ),
    ).resolves.toBe('failed_recovered');
  });

  test.each([0, '0', '0x0', 'reverted', 'ReVeRtEd', false])(
    'does not treat reverted native output receipts as success for status %s',
    async (status) => {
      await expect(
        detectSwapOutcome(
          providerWithLogs([], status),
          '0xhash',
          RECIPIENT,
          BRIDGE_TOKEN,
          NATIVE_TOKEN,
        ),
      ).resolves.toBe('dest_failed');
    },
  );

  test.each([1, '1', '0x1', 'success', true, undefined])(
    'keeps non-reverted native output receipts optimistic for status %s',
    async (status) => {
      await expect(
        detectSwapOutcome(
          providerWithLogs([], status),
          '0xhash',
          RECIPIENT,
          BRIDGE_TOKEN,
          NATIVE_TOKEN,
        ),
      ).resolves.toBe('success');
    },
  );

  test('checks reverted receipts before ERC20 logs', async () => {
    await expect(
      detectSwapOutcome(
        providerWithLogs([transferLog(DST_TOKEN, RECIPIENT)], 'reverted'),
        '0xhash',
        RECIPIENT,
        BRIDGE_TOKEN,
        DST_TOKEN,
      ),
    ).resolves.toBe('dest_failed');
  });

  test('throws when the destination receipt is unavailable', async () => {
    const provider = { getTransactionReceipt: async () => null };

    await expect(
      detectSwapOutcome(provider, '0xhash', RECIPIENT, BRIDGE_TOKEN, DST_TOKEN),
    ).rejects.toThrow('Destination transaction receipt not found');
  });
});
