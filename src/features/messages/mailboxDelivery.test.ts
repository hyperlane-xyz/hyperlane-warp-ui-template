import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { encodeFunctionResult, parseAbi, toEventSelector } from 'viem';
import { describe, expect, test, vi } from 'vitest';

import { getMailboxDeliveryStatus } from './mailboxDelivery';

const MAILBOX = '0x0000000000000000000000000000000000000001';
const MSG_ID = `0x${'01'.repeat(32)}`;
const TX_HASH = `0x${'02'.repeat(32)}`;
const CHAIN = 'ethereum';
const MAILBOX_ABI = parseAbi([
  'function delivered(bytes32) view returns (bool)',
  'function processedAt(bytes32) view returns (uint256)',
]);

function encodeMailboxResult(functionName: 'delivered', value: boolean): string;
function encodeMailboxResult(functionName: 'processedAt', value: bigint): string;
function encodeMailboxResult(functionName: 'delivered' | 'processedAt', value: boolean | bigint) {
  return encodeFunctionResult({
    abi: MAILBOX_ABI,
    functionName,
    result: value,
  });
}

function createMultiProvider({
  protocol = ProtocolType.Ethereum,
  providerType = 'ethers-v5',
  call = vi.fn(),
  getLogs = vi.fn(),
  getAccountInfo = vi.fn(),
}: {
  protocol?: ProtocolType;
  providerType?: string;
  call?: ReturnType<typeof vi.fn>;
  getLogs?: ReturnType<typeof vi.fn>;
  getAccountInfo?: ReturnType<typeof vi.fn>;
}) {
  return {
    tryGetProtocol: vi.fn().mockReturnValue(protocol),
    getSolanaWeb3Provider: vi.fn().mockReturnValue({ getAccountInfo }),
    getProvider: vi.fn().mockReturnValue({
      type: providerType,
      provider: { call, getLogs },
    }),
  } as unknown as MultiProtocolProvider;
}

describe('getMailboxDeliveryStatus', () => {
  test.each([true, false])(
    'checks Solana processed-message PDA without an indexer: %s',
    async (delivered) => {
      const getAccountInfo = vi
        .fn()
        .mockResolvedValue(delivered ? { data: Buffer.from([1]) } : null);
      const multiProvider = createMultiProvider({
        protocol: ProtocolType.Sealevel,
        getAccountInfo,
      });
      const result = await getMailboxDeliveryStatus({
        msgId: MSG_ID,
        destinationChain: CHAIN,
        chainAddresses: { [CHAIN]: { mailbox: '11111111111111111111111111111111' } },
        multiProvider,
      });
      expect(result).toEqual({ isDelivered: delivered, destinationTxHash: undefined });
      expect(getAccountInfo).toHaveBeenCalledOnce();
    },
  );

  test('supports Tron mailbox reads and transaction lookup', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce(encodeMailboxResult('delivered', true))
      .mockResolvedValueOnce(encodeMailboxResult('processedAt', 123n));
    const multiProvider = createMultiProvider({
      protocol: ProtocolType.Tron,
      providerType: 'tron',
      call,
      getLogs: vi.fn().mockResolvedValue([{ transactionHash: TX_HASH.slice(2) }]),
    });
    await expect(
      getMailboxDeliveryStatus({
        msgId: MSG_ID,
        destinationChain: CHAIN,
        chainAddresses: { [CHAIN]: { mailbox: MAILBOX } },
        multiProvider,
      }),
    ).resolves.toEqual({ isDelivered: true, destinationTxHash: TX_HASH.slice(2) });
  });

  test('does not interpret an RPC failure as proof of non-delivery', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(
        getMailboxDeliveryStatus({
          msgId: MSG_ID,
          destinationChain: CHAIN,
          chainAddresses: { [CHAIN]: { mailbox: MAILBOX } },
          multiProvider: createMultiProvider({
            call: vi.fn().mockRejectedValue(new Error('offline')),
          }),
        }),
      ).rejects.toThrow('offline');
    } finally {
      warn.mockRestore();
    }
  });

  test('skips unsupported protocols before reading provider', async () => {
    const multiProvider = createMultiProvider({ protocol: ProtocolType.Cosmos });

    const result = await getMailboxDeliveryStatus({
      msgId: MSG_ID,
      destinationChain: CHAIN,
      chainAddresses: { [CHAIN]: { mailbox: MAILBOX } },
      multiProvider,
    });

    expect(result).toEqual({ isDelivered: false, destinationTxHash: undefined });
    expect(multiProvider.getProvider).not.toHaveBeenCalled();
  });

  test('skips unsupported provider types', async () => {
    const multiProvider = createMultiProvider({ providerType: 'viem' });

    const result = await getMailboxDeliveryStatus({
      msgId: MSG_ID,
      destinationChain: CHAIN,
      chainAddresses: { [CHAIN]: { mailbox: MAILBOX } },
      multiProvider,
    });

    expect(result).toEqual({ isDelivered: false, destinationTxHash: undefined });
  });

  test('returns not delivered when mailbox delivered is false', async () => {
    const call = vi.fn().mockResolvedValue(encodeMailboxResult('delivered', false));
    const getLogs = vi.fn();
    const multiProvider = createMultiProvider({ call, getLogs });

    const result = await getMailboxDeliveryStatus({
      msgId: MSG_ID,
      destinationChain: CHAIN,
      chainAddresses: { [CHAIN]: { mailbox: MAILBOX } },
      multiProvider,
    });

    expect(result).toEqual({ isDelivered: false, destinationTxHash: undefined });
    expect(call).toHaveBeenCalledTimes(1);
    expect(getLogs).not.toHaveBeenCalled();
  });

  test('returns delivered without tx hash when processedAt is outside safe block range', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce(encodeMailboxResult('delivered', true))
      .mockResolvedValueOnce(
        encodeMailboxResult('processedAt', BigInt(Number.MAX_SAFE_INTEGER) + 1n),
      );
    const getLogs = vi.fn();
    const multiProvider = createMultiProvider({ call, getLogs });

    const result = await getMailboxDeliveryStatus({
      msgId: MSG_ID,
      destinationChain: CHAIN,
      chainAddresses: { [CHAIN]: { mailbox: MAILBOX } },
      multiProvider,
    });

    expect(result).toEqual({ isDelivered: true, destinationTxHash: undefined });
    expect(getLogs).not.toHaveBeenCalled();
  });

  test('returns ProcessId transaction hash when log lookup finds one', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce(encodeMailboxResult('delivered', true))
      .mockResolvedValueOnce(encodeMailboxResult('processedAt', 123n));
    const getLogs = vi.fn().mockResolvedValue([{ transactionHash: TX_HASH }]);
    const multiProvider = createMultiProvider({ call, getLogs });

    const result = await getMailboxDeliveryStatus({
      msgId: MSG_ID,
      destinationChain: CHAIN,
      chainAddresses: { [CHAIN]: { mailbox: MAILBOX } },
      multiProvider,
    });

    expect(result).toEqual({ isDelivered: true, destinationTxHash: TX_HASH });
    expect(getLogs).toHaveBeenCalledWith({
      address: MAILBOX,
      fromBlock: 123,
      toBlock: 123,
      topics: [toEventSelector('ProcessId(bytes32)'), MSG_ID],
    });
  });

  test('returns delivered without tx hash when ProcessId log lookup is empty', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce(encodeMailboxResult('delivered', true))
      .mockResolvedValueOnce(encodeMailboxResult('processedAt', 123n));
    const getLogs = vi.fn().mockResolvedValue([]);
    const multiProvider = createMultiProvider({ call, getLogs });

    const result = await getMailboxDeliveryStatus({
      msgId: MSG_ID,
      destinationChain: CHAIN,
      chainAddresses: { [CHAIN]: { mailbox: MAILBOX } },
      multiProvider,
    });

    expect(result).toEqual({ isDelivered: true, destinationTxHash: undefined });
  });
});
