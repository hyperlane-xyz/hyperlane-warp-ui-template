import { describe, expect, it } from 'vitest';

import {
  DiagnosticConnection,
  ismProgress,
  IsmState,
  ismState,
  readDiagnostics,
  reconcileDiagnostics,
  relayLabel,
  selectRelayObservation,
  type IsmNode,
  type RelayObservation,
  type RelayState,
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
  it('retains omitted reporters only for partial snapshots, without mixing their trees', () => {
    const previous = readDiagnostics(
      envelope([row('10', 'snapshot', { ...state, phase: 'ready_to_submit' })]),
      id,
    );
    const partial = readDiagnostics(
      {
        ...envelope([row('11', 'snapshot', { phase: 'preparing', modules: [] }, 'relayer-b')]),
        partial: true,
      },
      id,
    );
    const retained = reconcileDiagnostics(previous, partial);
    expect(retained.partial).toBe(true);
    expect(retained.relayers.map((relay) => relay.relayer)).toEqual(['relayer-a', 'relayer-b']);
    expect(retained.relayers[0]).toBe(previous.relayers[0]);
    expect(retained.relayers[1].state.modules).toEqual([]);
    const missingAnchor = readDiagnostics(envelope([row('12', 'snapshot_update', state)]), id);
    expect(reconcileDiagnostics(previous, missingAnchor)).toEqual({ ...previous, partial: true });
    expect(reconcileDiagnostics(retained, readDiagnostics(envelope([]), id)).relayers).toEqual([]);
    const terminal = readDiagnostics(
      envelope([row('13', 'snapshot', { phase: 'delivered', modules: [] })]),
      id,
    );
    expect(reconcileDiagnostics(retained, terminal)).toEqual(terminal);
  });
  it('rejects older reporter snapshots but accepts a newer retry and equal-ID refresh', () => {
    const previous = readDiagnostics(
      envelope([row('9007199254740993', 'snapshot', { ...state, phase: 'ready_to_submit' })]),
      id,
    );
    const older = readDiagnostics(envelope([row('9007199254740992', 'snapshot', state)]), id);
    const retained = reconcileDiagnostics(previous, older);
    expect(retained).toEqual({ ...previous, partial: true });
    expect(reconcileDiagnostics(retained, previous)).toEqual(previous);
    const retry = readDiagnostics(
      envelope([
        row('9007199254740994', 'snapshot', {
          phase: 'retrying',
          modules: [],
          failure: { stage: 'simulate', reason: 'rpc_timeout' },
        }),
      ]),
      id,
    );
    expect(reconcileDiagnostics(retained, retry)).toEqual(retry);
  });
  it('never equates signatures or metadata readiness with verification', () => {
    expect(
      ismState({ ...node, metadata_status: 'ready', signatures: { collected: 2, threshold: 2 } }),
    ).toBe(IsmState.Ready);
    expect(ismState({ ...node, verification: 'succeeded' })).toBe(IsmState.Verified);
    expect(ismState({ ...node, verification: 'failed' })).toBe(IsmState.Failed);
    expect(ismState({ ...node, discovered: false })).toBe(IsmState.Unknown);
    expect(relayLabel({ ...state, phase: 'delivered' })).toBe('Relayer observed delivery');
    expect(relayLabel({ ...state, phase: 'preparing', failure: { reason: 'RPC failed' } })).toBe(
      'Waiting for relay update',
    );
    expect(relayLabel({ ...state, phase: 'submitting', submission: { stage: 'mempool' } })).toBe(
      'Transaction in mempool',
    );
  });
});

describe('relay observation selection', () => {
  const observation = (relayer: string, state: RelayState, activityId = '1'): RelayObservation => ({
    relayer,
    activityId,
    observedAt: '2026-11-06 12:00:00',
    state,
  });
  const preparing = observation('main', { phase: 'preparing', modules: [] }, '999999');

  it('follows the furthest current relayer phase instead of cross-relayer activity IDs', () => {
    const phases = ['preparing', 'ready_to_submit', 'submitting', 'confirming', 'delivered'];
    for (let index = 1; index < phases.length; index++) {
      const main = { ...preparing, state: { ...preparing.state, phase: phases[index - 1] } };
      const fast = observation('fast', { phase: phases[index], modules: [] });
      expect(selectRelayObservation([main, fast], main.relayer)).toBe(fast);
    }
  });

  it('keeps the preferred reporter on equal progress, including an expected commit wait', () => {
    const signatures = observation('signatures', { phase: 'awaiting_signatures', modules: [] });
    const waiting = observation('waiting', {
      phase: 'retrying',
      modules: [],
      retry: { reason: 'AwaitingIcaReveal', count: 0 },
      failure: { stage: 'simulate', reason: 'contract_call_failed' },
    });
    expect(selectRelayObservation([preparing, signatures], signatures.relayer)).toBe(signatures);
    expect(selectRelayObservation([signatures, preparing], signatures.relayer)).toBe(signatures);
    expect(selectRelayObservation([preparing, waiting], waiting.relayer)).toBe(waiting);
    expect(selectRelayObservation([waiting, preparing], preparing.relayer)).toBe(preparing);
  });

  it('demotes current retries and failures even with a stale accepted submission', () => {
    const retrying = observation('retrying', {
      phase: 'retrying',
      modules: [],
      retry: { reason: 'ErrorSubmitting' },
    });
    for (const state of [
      { phase: 'retrying', modules: [], retry: { reason: 'ErrorSubmitting' } },
      { phase: 'delivered', modules: [], failure: { stage: 'submit', reason: 'rpc_error' } },
      { phase: 'dropped', modules: [] },
      { phase: 'unknown', modules: [] },
    ]) {
      const retry = observation('fast', { ...state, submission: { stage: 'included' } }, '9999999');
      expect(selectRelayObservation([retry, preparing], retry.relayer)).toBe(preparing);
      if (state.phase !== 'retrying')
        expect(selectRelayObservation([retry, retrying], retry.relayer)).toBe(retrying);
    }
  });

  it('uses only the current snapshot when the leader retries, disappears, or all reporters leave', () => {
    const fast = observation('fast', { phase: 'ready_to_submit', modules: [] });
    expect(selectRelayObservation([preparing, fast])).toBe(fast);
    const retry = {
      ...fast,
      activityId: '2',
      state: { phase: 'retrying', modules: [], retry: { reason: 'ErrorSubmitting' } },
    };
    expect(selectRelayObservation([preparing, retry], fast.relayer)).toBe(preparing);
    expect(selectRelayObservation([retry], fast.relayer)).toBe(retry);
    expect(selectRelayObservation([preparing], fast.relayer)).toBe(preparing);
    expect(selectRelayObservation([], fast.relayer)).toBeUndefined();
    expect(selectRelayObservation(undefined, fast.relayer)).toBeUndefined();
  });
});

describe('ISM header progress', () => {
  const live = { connection: DiagnosticConnection.Live, delivered: false, confirmed: false };
  it('treats the known reveal commit dependency as a wait, preserving other failures', () => {
    const waiting: RelayState = {
      ...state,
      phase: 'retrying',
      retry: { reason: 'AwaitingIcaReveal', count: 0 },
      failure: { stage: 'simulate', reason: 'contract_call_failed' },
    };
    for (const failure of [undefined, waiting.failure]) {
      const pending = { ...waiting, failure };
      expect(relayLabel(pending)).toBe('Waiting for commit confirmation');
      expect(ismProgress({ ...live, state: pending })).toEqual({
        label: 'Waiting for commit confirmation',
        busy: true,
      });
    }
    for (const failed of [
      { ...waiting, phase: 'preparing' },
      { ...waiting, phase: 'dropped' },
      { ...waiting, retry: { reason: 'ErrorSubmitting' } },
      { ...waiting, failure: { stage: 'submit', reason: 'contract_call_failed' } },
      { ...waiting, failure: { stage: 'simulate', reason: 'rpc_error' } },
    ]) {
      expect(relayLabel(failed)).toBe('Waiting for relay update');
      expect(ismProgress({ ...live, state: failed })).toEqual({ label: 'Attempt failed' });
    }
    expect(ismProgress({ ...live, state: waiting, delivered: true })).toEqual({
      label: 'Delivered',
      complete: true,
    });
  });
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
  it('stops active or ready indicators on failure while keeping indexed delivery authoritative', () => {
    const failure = { stage: 'prepare', reason: 'contract_call_failed' };
    for (const phase of ['preparing', 'awaiting_signatures', 'ready_to_submit', 'submitting']) {
      const failed = { ...state, phase, failure };
      expect(ismProgress({ ...live, state: failed })).toEqual({ label: 'Attempt failed' });
      expect(ismProgress({ ...live, state: failed, delivered: true })).toEqual({
        label: 'Delivered',
        complete: true,
      });
    }
  });
  it('distinguishes metadata readiness, submission, delivery, and finality', () => {
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
    for (const confirmed of [false, true]) {
      expect(
        ismProgress({
          ...live,
          delivered: true,
          confirmed,
          connection: DiagnosticConnection.Stale,
        }),
      ).toEqual({ label: confirmed ? 'Confirmed' : 'Delivered', complete: true });
    }
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

it('keeps unmet proof prerequisites neutral, then updates when proof is ready', () => {
  expect(ismState(node)).toBe(IsmState.Pending);
  for (const metadata_error of [
    'Awaiting validator signatures',
    'Could not fetch metadata',
    'Aggregation threshold not met (2)',
    null,
  ]) {
    const waiting = { ...node, metadata_status: 'blocked', metadata_error };
    expect(ismState(waiting)).toBe(IsmState.Waiting);
    expect(ismState({ ...waiting, verification: 'failed' })).toBe(IsmState.Failed);
    expect(ismState({ ...waiting, checks: { merkle_leaf: 'failed' } })).toBe(IsmState.Failed);
    expect(ismState({ ...waiting, metadata_status: 'ready', metadata_error: null })).toBe(
      IsmState.Ready,
    );
  }
});

it('still reports explicit build, offchain read, and verification failures on a first attempt', () => {
  for (const metadata_error of ['Metadata build failed', 'Validator reported a reorg']) {
    expect(ismState({ ...node, metadata_status: 'blocked', metadata_error })).toBe(IsmState.Failed);
  }
  expect(ismState({ ...node, offchain_read: { state: 'failed' } })).toBe(IsmState.Failed);
  expect(ismState({ ...node, checks: { merkle_leaf: 'unavailable' } })).toBe(IsmState.Pending);
});

it('keeps undecided alternative failures neutral only while preparing the path', () => {
  const failed = { ...node, metadata_error: 'Metadata build failed' };
  expect(ismState(failed, undefined, true)).toBe(IsmState.Waiting);
  expect(ismState(failed, false, true)).toBe(IsmState.Unused);
  expect(ismState(failed, true, true)).toBe(IsmState.Failed);
  expect(ismState(failed, undefined, false)).toBe(IsmState.Failed);
});
