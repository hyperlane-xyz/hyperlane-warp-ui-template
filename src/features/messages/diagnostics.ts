import { z } from 'zod';

import { normalizeMessageId } from './messageStream';

const count = z.number().int().nonnegative();
const outcome = z.string().nullish();
const moduleSchema = z.object({
  node_id: z.string(),
  ism: z.string(),
  module_type: z.string().nullish(),
  discovered: z.boolean().optional(),
  children: z.array(z.object({ node_id: z.string(), ism: z.string() })).default([]),
  selected_children: z.array(z.string()).nullish(),
  verification: outcome,
  metadata_status: z.string().nullish(),
  metadata_error: z.string().nullish(),
  threshold: count.nullish(),
  validators: z.array(z.string()).nullish(),
  verified: count.nullish(),
  signatures: z
    .object({
      collected: count.nullish(),
      threshold: count.nullish(),
      index: count.nullish(),
      root: z.string().nullish(),
    })
    .nullish(),
  checks: z.record(z.string(), outcome).nullish(),
  offchain_read: z.object({ state: z.string() }).nullish(),
});
const stateSchema = z.object({
  phase: z.string(),
  tree_root: z.string().nullish(),
  modules: z.array(moduleSchema),
  removed_modules: z.array(z.string()).optional(),
  retry: z
    .object({
      reason: z.string(),
      count: count.optional(),
      next_attempt_at_millis: count.nullish(),
    })
    .nullish(),
  failure: z.object({ reason: z.string().optional(), stage: z.string().optional() }).nullish(),
  submission: z.object({ stage: z.string() }).nullish(),
});
const envelopeSchema = z.object({
  version: z.literal(1),
  message_id: z.string(),
  partial: z.boolean(),
  activities: z.array(
    z.object({
      id: z.string().regex(/^\d+$/),
      relayer: z.string(),
      observed_at: z.string(),
      version: z.number(),
      activity: z.object({ type: z.string(), state: z.unknown().optional() }),
    }),
  ),
});
export type IsmNode = z.infer<typeof moduleSchema>;
export type RelayState = z.infer<typeof stateSchema>;
export interface RelayObservation {
  activityId: string;
  relayer: string;
  observedAt: string;
  state: RelayState;
}
export interface MessageDiagnostics {
  partial: boolean;
  relayers: RelayObservation[];
}

/** Each envelope is self-contained: cumulative updates always apply to their anchor. */
export function readDiagnostics(value: unknown, messageId: string): MessageDiagnostics {
  const envelope = envelopeSchema.parse(value);
  if (normalizeMessageId(envelope.message_id) !== normalizeMessageId(messageId))
    throw new Error('Diagnostics received for a different message');
  const anchors = new Map<string, RelayState>();
  const relayers = new Map<string, RelayObservation>();
  let partial = envelope.partial;
  for (const row of [...envelope.activities].sort((a, b) =>
    BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0,
  )) {
    if (row.version !== 1) {
      partial = true;
      continue;
    }
    if (!['snapshot', 'snapshot_update'].includes(row.activity.type)) continue;
    let state = stateSchema.parse(row.activity.state);
    if (row.activity.type === 'snapshot') anchors.set(row.relayer, state);
    else {
      const anchor = anchors.get(row.relayer);
      if (!anchor) {
        partial = true;
        continue;
      }
      const modules = new Map(anchor.modules.map((node) => [node.node_id, node]));
      for (const id of state.removed_modules ?? []) modules.delete(id);
      for (const node of state.modules) modules.set(node.node_id, node);
      state = { ...state, modules: [...modules.values()] };
    }
    relayers.set(row.relayer, {
      activityId: row.id,
      relayer: row.relayer,
      observedAt: row.observed_at,
      state,
    });
  }
  return {
    partial,
    relayers: [...relayers.values()].sort((a, b) => a.relayer.localeCompare(b.relayer)),
  };
}

/** Preserve complete reporter observations across incomplete or older snapshots. */
export function reconcileDiagnostics(
  previous: MessageDiagnostics | undefined,
  next: MessageDiagnostics,
): MessageDiagnostics {
  if (!previous) return next;
  const relayers = new Map(next.relayers.map((relay) => [relay.relayer, relay]));
  let partial = next.partial;
  for (const relay of previous.relayers) {
    const incoming = relayers.get(relay.relayer);
    if (
      (!incoming && next.partial) ||
      (incoming && BigInt(incoming.activityId) < BigInt(relay.activityId))
    ) {
      relayers.set(relay.relayer, relay);
      partial = true;
    }
  }
  return {
    partial,
    relayers: [...relayers.values()].sort((a, b) => a.relayer.localeCompare(b.relayer)),
  };
}

export enum DiagnosticConnection {
  Connecting = 'connecting',
  Live = 'live',
  Stale = 'stale',
}

const phaseLabels: Record<string, string> = {
  preparing: 'Validating',
  awaiting_signatures: 'Validating · Collecting signatures',
  ready_to_submit: 'Validated · Preparing submission',
  retrying: 'Waiting for validation',
  submitting: 'Submitting transaction',
  confirming: 'Waiting for delivery',
  delivered: 'Relayer observed delivery',
  dropped: 'Waiting for delivery updates',
};
const submissionLabels: Record<string, string> = {
  submitting: 'Submitting transaction',
  submitted: 'Accepted by submitter',
  pending_inclusion: 'Waiting for inclusion',
  mempool: 'Transaction in mempool',
  included: 'Transaction included',
  finalized: 'Transaction finalized',
};
const submittedStages = ['submitted', 'pending_inclusion', 'mempool', 'included', 'finalized'];
// A reveal cannot simulate successfully until its commit is visible on-chain.
export function isWaitingForCommit(state?: RelayState): boolean {
  return (
    state?.phase === 'retrying' &&
    state.retry?.reason === 'AwaitingIcaReveal' &&
    (!state.failure ||
      (state.failure.stage === 'simulate' && state.failure.reason === 'contract_call_failed'))
  );
}
export function relayLabel(state: RelayState) {
  if (isWaitingForCommit(state)) return 'Waiting for commit confirmation';
  if (state.failure) return 'Waiting for relay update';
  if (['submitting', 'confirming'].includes(state.phase) && state.submission)
    return submissionLabels[state.submission.stage] ?? 'Submission update';
  return phaseLabels[state.phase] ?? 'Validating';
}

export enum IsmState {
  Verified = 'verified',
  ThresholdMet = 'threshold_met',
  Unused = 'unused',
  Ready = 'ready',
  Failed = 'failed',
  Waiting = 'waiting',
  Pending = 'pending',
  Unknown = 'unknown',
}
export function ismState(node: IsmNode, selected?: boolean, preparing = false): IsmState {
  // An unsuccessful alternative does not block the selected verification path.
  if (selected === false) return IsmState.Unused;
  if (node.verification === 'succeeded') return IsmState.Verified;
  // An undecided alternative's error is still visible in its details, but does not
  // make the preparing path look failed before another branch can satisfy it.
  const failure = preparing && selected === undefined ? IsmState.Waiting : IsmState.Failed;
  if (node.verification === 'failed') return failure;
  if (Object.values(node.checks ?? {}).includes('failed') || node.offchain_read?.state === 'failed')
    return failure;
  // The relayer also puts unmet prerequisites in metadata_error, before verification.
  const waitingForMetadata =
    node.metadata_error === 'Awaiting validator signatures' ||
    node.metadata_error === 'Could not fetch metadata' ||
    /^Aggregation threshold not met \(\d+\)$/.test(node.metadata_error ?? '');
  if (node.metadata_error && !waitingForMetadata) return failure;
  if (waitingForMetadata || node.metadata_status === 'blocked') return IsmState.Waiting;
  if (
    node.module_type === 'Aggregation' &&
    node.threshold != null &&
    node.threshold > 0 &&
    node.verified != null &&
    node.verified >= node.threshold
  )
    return IsmState.ThresholdMet;
  if (node.metadata_status === 'ready') return IsmState.Ready;
  return node.discovered ? IsmState.Pending : IsmState.Unknown;
}

/** Header progress is separate from each module's explicit verification result. */
export function ismProgress({
  state,
  connection,
  partial,
  delivered,
  confirmed,
}: {
  state?: RelayState;
  connection: DiagnosticConnection;
  partial?: boolean;
  delivered: boolean;
  confirmed: boolean;
}): { label: string; busy?: boolean; complete?: boolean } {
  if (confirmed) return { label: 'Confirmed', complete: true };
  if (delivered) return { label: 'Delivered', complete: true };
  if (connection === DiagnosticConnection.Stale) return { label: 'Unavailable' };
  if (connection === DiagnosticConnection.Connecting) return { label: 'Loading', busy: true };
  if (partial) return { label: 'Partial data' };
  if (!state) return { label: 'Waiting' };
  if (isWaitingForCommit(state)) return { label: 'Waiting for commit confirmation', busy: true };
  if (state.failure) return { label: 'Attempt failed' };
  switch (state.phase) {
    case 'ready_to_submit':
      return { label: 'Ready', complete: true };
    case 'submitting':
      return state.submission && submittedStages.includes(state.submission.stage)
        ? { label: 'Submitted', complete: true }
        : { label: 'Submitting', busy: true };
    case 'confirming':
      return { label: 'Submitted', complete: true };
    case 'delivered':
      return { label: 'Delivery observed', complete: true };
    case 'retrying':
      return { label: 'Waiting to retry' };
    case 'dropped':
      return { label: 'Stopped' };
    case 'awaiting_signatures':
      return { label: 'Signatures', busy: true };
    case 'preparing':
      return { label: 'Validating', busy: true };
    default:
      return { label: 'Waiting for update' };
  }
}
