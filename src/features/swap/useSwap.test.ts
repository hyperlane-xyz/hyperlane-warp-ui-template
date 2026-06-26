import { describe, expect, test } from 'vitest';

import type { AugmentedRoute, LabeledMsgId } from './types';
import {
  ensureSolanaMessageExtractionReady,
  ensureSolanaMessagesExtracted,
  getCcsMessageLabel,
  labelMessages,
  labelSolanaMessages,
  type ParsedMessage,
} from './useSwap';

const BRIDGE_ROUTER = '0x00000000000000000000000000000000000000aa';
const OTHER_SENDER = '0x00000000000000000000000000000000000000bb';
const UNIVERSAL_ROUTER = '0x0000000000000000000000000000000000000001';

function createRoute(router = BRIDGE_ROUTER): AugmentedRoute {
  return {
    raw: {
      tx: {
        to: '0x0000000000000000000000000000000000000001',
        data: '0x',
        value: '0',
      },
      output: '1',
      outputMin: '1',
      connection: null,
      gas: {
        originGas: '0',
        destGas: '0',
      },
      steps: [
        {
          type: 'bridge',
          chain: 1,
          destChain: 2,
          asset: '0x0000000000000000000000000000000000000002',
          router,
          amountIn: '1',
          amountOut: '1',
          fee: {
            tokenFee: '0',
            igpToken: '0x0000000000000000000000000000000000000000',
            igpAmount: '0',
          },
        },
      ],
    },
    feeBreakdown: { components: [], originGas: 0n, destGas: 0n },
    isBridgeOnly: false,
  } as AugmentedRoute;
}

function createCommitmentRoute(): AugmentedRoute {
  const route = createRoute();
  route.raw.callCommitment = {
    version: 1,
    commitment: `0x${'1'.repeat(64)}`,
    hash: {
      algorithm: 'keccak256',
      preimage: 'salt || abi.encode((bytes32 to,uint256 value,bytes data)[])',
      encodedCalls: '0x',
    },
    ccs: {
      method: 'POST',
      path: '/calldata',
      body: {
        commitment: `0x${'1'.repeat(64)}`,
        originDomain: 1,
        data: '0x',
        salt: `0x${'2'.repeat(64)}`,
        relayers: [],
        destinationAccount: `0x${'3'.repeat(64)}`,
      },
    },
  };
  return route;
}

function createMessage(msgId: `0x${string}`, sender: `0x${string}`, body: string): ParsedMessage {
  return { msgId, sender, body };
}

describe('getCcsMessageLabel', () => {
  test('reads commit and reveal labels from CCS body prefixes', () => {
    expect(getCcsMessageLabel('0x01abcdef')).toBe('commit');
    expect(getCcsMessageLabel('0x02abcdef')).toBe('reveal');
    expect(getCcsMessageLabel('0x03abcdef')).toBeNull();
  });
});

describe('labelMessages', () => {
  test('labels bridge router dispatches as warp messages', () => {
    const labels = labelMessages(
      [
        createMessage('0x01', OTHER_SENDER, '0x01'),
        createMessage('0x02', BRIDGE_ROUTER, '0x99'),
        createMessage('0x03', OTHER_SENDER, '0x02'),
      ],
      createRoute(),
    );

    expect(labels).toEqual<LabeledMsgId[]>([
      { msgId: '0x01', label: 'commit' },
      { msgId: '0x02', label: 'warp' },
      { msgId: '0x03', label: 'reveal' },
    ]);
  });

  test('uses CCS body labels before sender-order heuristics', () => {
    const labels = labelMessages(
      [
        createMessage('0x01', UNIVERSAL_ROUTER, '0x02'),
        createMessage('0x02', BRIDGE_ROUTER, '0x99'),
        createMessage('0x03', OTHER_SENDER, '0x01'),
      ],
      createCommitmentRoute(),
    );

    expect(labels).toEqual<LabeledMsgId[]>([
      { msgId: '0x01', label: 'reveal' },
      { msgId: '0x02', label: 'warp' },
      { msgId: '0x03', label: 'commit' },
    ]);
  });

  test('uses last non-warp message as reveal when body prefix looks unknown', () => {
    const labels = labelMessages(
      [
        createMessage('0x01', OTHER_SENDER, '0x03'),
        createMessage('0x02', BRIDGE_ROUTER, '0x99'),
        createMessage('0x03', OTHER_SENDER, '0x03'),
      ],
      createRoute(),
    );

    expect(labels).toEqual<LabeledMsgId[]>([
      { msgId: '0x01', label: 'commit' },
      { msgId: '0x02', label: 'warp' },
      { msgId: '0x03', label: 'reveal' },
    ]);
  });

  test('normalizes padded dispatch senders before matching bridge routers', () => {
    const paddedBridgeSender = `0x${'0'.repeat(24)}${BRIDGE_ROUTER.slice(2)}` as `0x${string}`;
    const labels = labelMessages(
      [
        createMessage('0x01', OTHER_SENDER, '0x01'),
        createMessage('0x02', paddedBridgeSender, '0x99'),
        createMessage('0x03', OTHER_SENDER, '0x99'),
      ],
      createRoute(),
    );

    expect(labels).toEqual<LabeledMsgId[]>([
      { msgId: '0x01', label: 'commit' },
      { msgId: '0x02', label: 'warp' },
      { msgId: '0x03', label: 'reveal' },
    ]);
  });

  test('falls back to last non-warp message as reveal for legacy bodies', () => {
    const labels = labelMessages(
      [
        createMessage('0x01', OTHER_SENDER, '0x99'),
        createMessage('0x02', BRIDGE_ROUTER, '0x99'),
        createMessage('0x03', OTHER_SENDER, '0x99'),
      ],
      createRoute(),
    );

    expect(labels).toEqual<LabeledMsgId[]>([
      { msgId: '0x01', label: 'commit' },
      { msgId: '0x02', label: 'warp' },
      { msgId: '0x03', label: 'reveal' },
    ]);
  });
});

describe('labelSolanaMessages', () => {
  test('labels Solana bridge-only dispatches as warp messages', () => {
    expect(labelSolanaMessages(['0x01', '0x02'], createRoute())).toEqual<LabeledMsgId[]>([
      { msgId: '0x01', label: 'warp' },
      { msgId: '0x02', label: 'warp' },
    ]);
  });

  test('labels Solana bridge, commit, reveal dispatch order for destination swaps', () => {
    expect(labelSolanaMessages(['0x01', '0x02', '0x03'], createCommitmentRoute())).toEqual<
      LabeledMsgId[]
    >([
      { msgId: '0x01', label: 'warp' },
      { msgId: '0x02', label: 'commit' },
      { msgId: '0x03', label: 'reveal' },
    ]);
  });
});

describe('Solana message extraction guards', () => {
  test('requires a source mailbox before extracting bridged Solana messages', () => {
    expect(() => ensureSolanaMessageExtractionReady(undefined, 'solanamainnet')).toThrow(
      'No mailbox address for Solana source chain solanamainnet',
    );
    expect(() =>
      ensureSolanaMessageExtractionReady('11111111111111111111111111111111', 'solanamainnet'),
    ).not.toThrow();
  });

  test('fails bridged Solana routes when no message ids are extracted', () => {
    expect(() => ensureSolanaMessagesExtracted([], true)).toThrow(
      'Origin Solana tx confirmed but no message IDs extracted',
    );
    expect(() => ensureSolanaMessagesExtracted([], false)).not.toThrow();
    expect(() =>
      ensureSolanaMessagesExtracted([{ msgId: '0x01', label: 'warp' }], true),
    ).not.toThrow();
  });
});
