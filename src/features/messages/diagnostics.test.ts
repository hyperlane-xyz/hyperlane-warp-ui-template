import { describe, expect, it } from 'vitest';

import {
  DiagnosticConnection,
  ismProgress,
  IsmState,
  ismState,
  readDiagnostics,
  relayLabel,
  type IsmNode,
} from './diagnostics';

const id = `0x${'11'.repeat(32)}`;
const node: IsmNode = { node_id: 'root', ism: '0x123', discovered: true, children: [] };
const state = { phase: 'awaiting_signatures', tree_root: 'root', modules: [node] };
const row = (id: string, type: string, value: unknown, relayer = 'relayer-a') => ({
  id,
  relayer,
  observed_at: '2026-11-06 12:00:00',
  version: 1,
  activity: { type, state: value },
});
const envelope = (activities: unknown[]) => ({
  version: 1,
  message_id: id,
  partial: false,
  activities,
});

describe('message diagnostics', () => {
  it('applies each cumulative update to the anchor, including reverted and removed nodes', () => {
    const anchor = row('9007199254740992', 'snapshot', {
      ...state,
      modules: [node, { ...node, node_id: 'alternative' }],
    });
    const verified = row('9007199254740993', 'snapshot_update', {
      ...state,
      modules: [{ ...node, verification: 'succeeded' }],
      removed_modules: ['alternative'],
    });
    const retry = row('9007199254740994', 'snapshot_update', {
      ...state,
      phase: 'retrying',
      modules: [],
      removed_modules: [],
    });
    const result = readDiagnostics(envelope([retry, verified, anchor]), id).relayers[0].state;
    expect(result.phase).toBe('retrying');
    expect(result.modules).toEqual([node, { ...node, node_id: 'alternative' }]);
    expect(readDiagnostics(envelope([verified, anchor]), id).relayers[0].state.modules).toEqual([
      { ...node, verification: 'succeeded' },
    ]);
  });
  it('keeps duplicate ISM addresses in different branches and relayers independent', () => {
    const other = { ...node, node_id: 'root/1:0x123', verification: 'succeeded' };
    const result = readDiagnostics(
      envelope([
        row('1', 'snapshot', { ...state, modules: [node, other] }),
        row('2', 'snapshot', { ...state, phase: 'ready_to_submit' }, 'relayer-b'),
      ]),
      id,
    );
    expect(result.relayers).toHaveLength(2);
    expect(result.relayers[0].state.modules).toHaveLength(2);
    expect(result.relayers[1].state.modules).toEqual([node]);
  });
  it('does not reuse an old tree across complete message envelopes or terminal snapshots', () => {
    readDiagnostics(envelope([row('1', 'snapshot', state)]), id);
    expect(readDiagnostics(envelope([]), id).relayers).toEqual([]);
    const delivered = readDiagnostics(
      envelope([
        row('1', 'snapshot', state),
        row('2', 'snapshot', { phase: 'delivered', tree_root: null, modules: [] }),
      ]),
      id,
    );
    expect(delivered.relayers[0].state.modules).toEqual([]);
  });
  it('marks missing anchors and unsupported activity versions as partial', () => {
    const missing = readDiagnostics(envelope([row('2', 'snapshot_update', state)]), id);
    expect(missing).toEqual({ partial: true, relayers: [] });
    expect(
      readDiagnostics(envelope([{ ...row('1', 'snapshot', state), version: 2 }]), id).partial,
    ).toBe(true);
    expect(() => readDiagnostics({ ...envelope([]), message_id: 'other' }, id)).toThrow(
      'different message',
    );
  });
  it('never equates signatures or metadata readiness with verification', () => {
    expect(
      ismState({ ...node, metadata_status: 'ready', signatures: { collected: 2, threshold: 2 } }),
    ).toBe(IsmState.Ready);
    expect(ismState({ ...node, verification: 'succeeded' })).toBe(IsmState.Verified);
    expect(ismState({ ...node, verification: 'failed' })).toBe(IsmState.Failed);
    expect(ismState({ ...node, discovered: false })).toBe(IsmState.Unknown);
    expect(relayLabel({ ...state, phase: 'delivered' })).toBe('Relayer observed delivery');
    expect(relayLabel({ ...state, phase: 'submitting', submission: { stage: 'mempool' } })).toBe(
      'Transaction in mempool',
    );
  });
});

describe('ISM header progress', () => {
  const live = { connection: DiagnosticConnection.Live, delivered: false, confirmed: false };
  it('spins only while connecting or actively preparing/submitting', () => {
    expect(ismProgress({ ...live, connection: DiagnosticConnection.Connecting })).toEqual({
      label: 'Loading',
      busy: true,
    });
    expect(ismProgress({ ...live, state })).toEqual({ label: 'Signatures', busy: true });
    expect(ismProgress({ ...live, connection: DiagnosticConnection.Stale, state }).busy).not.toBe(
      true,
    );
    expect(ismProgress({ ...live, partial: true, state }).busy).not.toBe(true);
    expect(ismProgress({ ...live, state: { ...state, phase: 'retrying' } }).busy).not.toBe(true);
  });
  it('distinguishes metadata readiness, submission, and authoritative confirmation', () => {
    expect(ismProgress({ ...live, state: { ...state, phase: 'ready_to_submit' } }).label).toBe(
      'Ready',
    );
    expect(ismProgress({ ...live, state: { ...state, phase: 'submitting' } })).toEqual({
      label: 'Submitting',
      busy: true,
    });
    expect(
      ismProgress({
        ...live,
        state: { ...state, phase: 'submitting', submission: { stage: 'submitted' } },
      }).label,
    ).toBe('Submitted');
    expect(ismProgress({ ...live, state: { ...state, phase: 'delivered' } }).label).toBe(
      'Delivery observed',
    );
    expect(
      ismProgress({
        ...live,
        confirmed: true,
        delivered: true,
        connection: DiagnosticConnection.Stale,
      }),
    ).toEqual({ label: 'Confirmed', complete: true });
  });
});

it('keeps reporter order stable when their latest snapshot anchor IDs change', () => {
  const first = readDiagnostics(
    envelope([row('1', 'snapshot', state, 'relayer-a'), row('2', 'snapshot', state, 'relayer-b')]),
    id,
  );
  const next = readDiagnostics(
    envelope([row('2', 'snapshot', state, 'relayer-b'), row('3', 'snapshot', state, 'relayer-a')]),
    id,
  );
  expect(next.relayers.map((r) => r.relayer)).toEqual(first.relayers.map((r) => r.relayer));
});

it('shows CCTP metadata readiness without inventing per-module verification', () => {
  const cctp = {
    ...node,
    module_type: 'CcipRead',
    metadata_status: 'ready',
    offchain_read: { state: 'succeeded' },
  };
  expect(ismState(cctp)).toBe(IsmState.Ready);
  expect(ismState({ ...cctp, verification: 'succeeded' })).toBe(IsmState.Verified);
  expect(ismState({ ...cctp, verification: 'failed' })).toBe(IsmState.Failed);
});

it('marks the aggregation requirement met when enough checks have passed', () => {
  const aggregation = {
    ...node,
    module_type: 'Aggregation',
    threshold: 1,
    verified: 1,
    children: [
      { node_id: 'a', ism: '0x1' },
      { node_id: 'b', ism: '0x2' },
    ],
  };
  expect(ismState(aggregation)).toBe(IsmState.ThresholdMet);
  expect(ismState({ ...aggregation, threshold: 2 })).toBe(IsmState.Pending);
  expect(ismState({ ...aggregation, verification: 'failed' })).toBe(IsmState.Failed);
  expect(ismState({ ...aggregation, module_type: 'MessageIdMultisig' })).toBe(IsmState.Pending);
});

it('keeps unused alternatives neutral even if their earlier attempt failed', () => {
  expect(
    ismState({ ...node, verification: 'failed', metadata_error: 'missing_signatures' }, false),
  ).toBe(IsmState.Unused);
  expect(ismState({ ...node, verification: 'succeeded' }, false)).toBe(IsmState.Unused);
  expect(ismState({ ...node, discovered: false }, false)).toBe(IsmState.Unused);
  expect(ismState({ ...node, verification: 'failed' }, true)).toBe(IsmState.Failed);
});
