import { encodeAbiParameters, keccak256, toHex, type Hex } from 'viem';
import { describe, expect, it } from 'vitest';

import { CHAINS } from '../config/chains';
import { dropApplies, dropEligible, gasDropEnabled } from './gasDrop';
import { migrateTransfers } from './history';
import { messageIdFromLogs, recipientBytes32 } from './localClient';

const DISPATCH_ID = keccak256(toHex('DispatchId(bytes32)'));
const DISPATCH = keccak256(toHex('Dispatch(address,uint32,bytes32,bytes)'));

describe('Hyperlane message id from the origin receipt', () => {
  const id = `0x${'cd'.repeat(32)}` as Hex;
  const mailbox = CHAINS.sepolia.mailbox;
  it('reads DispatchId(bytes32 indexed messageId) emitted by the origin Mailbox', () => {
    const logs = [
      { address: '0x1111111111111111111111111111111111111111', data: '0x' as Hex, topics: [DISPATCH_ID, `0x${'00'.repeat(32)}`] as Hex[] },
      { address: mailbox.toLowerCase(), data: encodeAbiParameters([{ type: 'bytes' }], ['0x01']), topics: [DISPATCH, `0x${'00'.repeat(32)}`, `0x${'00'.repeat(32)}`, `0x${'00'.repeat(32)}`] as Hex[] },
      { address: mailbox, data: '0x' as Hex, topics: [DISPATCH_ID, id] as Hex[] },
    ];
    expect(messageIdFromLogs(logs as never, mailbox)).toBe(id);
  });
  it('ignores a DispatchId from any other contract', () => {
    expect(messageIdFromLogs([{ address: '0x2222222222222222222222222222222222222222', data: '0x', topics: [DISPATCH_ID, id] }] as never, mailbox)).toBeUndefined();
  });
  it('bytes32 recipients: EVM padded, Solana pubkey bytes', () => {
    expect(recipientBytes32('gullychaintestnet', '0x474D721C3B6c555E6F188dCCE7f0b165F1CD8631')).toBe(
      '0x000000000000000000000000474d721c3b6c555e6f188dcce7f0b165f1cd8631',
    );
    expect(recipientBytes32('solanadevnet', 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')).toBe(
      '0x06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9',
    );
    expect(() => recipientBytes32('solanadevnet', '0x474D721C3B6c555E6F188dCCE7f0b165F1CD8631')).toThrow();
    expect(() => recipientBytes32('sepolia', 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')).toThrow();
  });
});

describe('transfer history migration', () => {
  it('keeps old classic records, fills the v2 fields, drops junk', () => {
    const old = {
      id: '0xaaa',
      kind: 'fast',
      direction: 'deposit',
      from: 'arbitrumsepolia',
      to: 'gullychaintestnet',
      amount: '1000',
      sendSymbol: 'ETH',
      receiveSymbol: 'ETH',
      sender: '0x1',
      recipient: '0x1',
      originTx: '0xaaa',
      messageId: '0xbbb',
      createdAt: 5,
      updatedAt: 6,
      status: 'relaying',
      etaSeconds: 75,
    };
    const out = migrateTransfers([old, null, { id: 1 }, { ...old, id: 'x', originTx: 'x', from: 'mars' }, { ...old, id: '0xccc', originTx: '0xccc', createdAt: 9 }]);
    expect(out.map((t) => t.id)).toEqual(['0xccc', '0xaaa']);
    expect(out[1]).toMatchObject({ v: 2, decimals: 18, receiveDecimals: 18, status: 'relaying', messageId: '0xbbb' });
    expect(migrateTransfers('nope')).toEqual([]);
  });
});

describe('gas on arrival', () => {
  it('eligible = not dropped and today still covers one drop', () => {
    expect(dropEligible({ dropped: false, dropAmount: 10n, remainingToday: 10n })).toBe(true);
    expect(dropEligible({ dropped: true, dropAmount: 10n, remainingToday: 100n })).toBe(false);
    expect(dropEligible({ dropped: false, dropAmount: 10n, remainingToday: 9n })).toBe(false);
    expect(dropEligible({ dropped: false, dropAmount: 0n, remainingToday: 9n })).toBe(false);
  });
  it('applies to deposits of non-gas tokens only, and is off without a contract address', () => {
    expect(dropApplies({ direction: 'deposit', receive: { tokenType: 'collateral' } })).toBe(true);
    expect(dropApplies({ direction: 'deposit', receive: { tokenType: 'native' } })).toBe(false);
    expect(dropApplies({ direction: 'withdraw', receive: { tokenType: 'synthetic' } })).toBe(false);
    expect(gasDropEnabled('')).toBe(false);
    expect(gasDropEnabled('0x474D721C3B6c555E6F188dCCE7f0b165F1CD8631')).toBe(true);
  });
});
