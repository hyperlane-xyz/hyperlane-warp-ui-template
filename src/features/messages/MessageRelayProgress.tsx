import { convertToProtocolAddress } from '@hyperlane-xyz/utils';
import { CopyButton, SpinnerIcon } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { useMultiProvider } from '../chains/hooks';
import {
  DiagnosticConnection,
  IsmState,
  ismState,
  ismProgress,
  type IsmNode,
  type RelayObservation,
  type RelayState,
} from './diagnostics';
import { ProgressState } from './progress';
import { parseTimestamp } from './queries/encoding';
import type { DiagnosticsState } from './useMessageDiagnostics';

const stages = [
  { label: 'Dispatched', pending: 'Dispatching' },
  { label: 'Origin confirmed', pending: 'Confirming origin' },
  { label: 'Proof ready', pending: 'Proving' },
  { label: 'Delivered', pending: 'Delivering' },
  { label: 'Confirmed', pending: 'Confirming' },
];
const phaseStage: Record<string, number> = {
  preparing: 1,
  awaiting_signatures: 1,
  retrying: 1,
  ready_to_submit: 2,
  submitting: 2,
  confirming: 2,
  delivered: 2,
};
const shortAddress = (address: string) => `${address.slice(0, 8)}…${address.slice(-6)}`;
const humanize = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');

interface MessageLifecycleProps {
  state?: RelayState;
  delivered: boolean;
  confirmed: boolean;
  confirming: boolean;
  originState: ProgressState;
  paused: boolean;
}

function MessageLifecycleStages({
  state,
  delivered,
  confirmed,
  confirming,
  originState,
  paused,
}: MessageLifecycleProps) {
  // Wait for origin finality even if a relayer observes the message earlier.
  // Delivery and destination finality still require indexed/on-chain evidence.
  const stage = confirmed
    ? 4
    : delivered
      ? 3
      : originState === ProgressState.Pending || originState === ProgressState.Failed
        ? 0
        : state
          ? (phaseStage[state.phase] ?? 1)
          : 1;
  // Pending stages keep animating between observations.
  const currentStage =
    confirmed || paused || (!delivered && (state?.failure || state?.phase === 'dropped'))
      ? -1
      : delivered
        ? confirming
          ? 4
          : -1
        : stage + 1;
  const broadcasting =
    state?.phase === 'submitting' && (!state.submission || state.submission.stage === 'submitting');
  return (
    <ol className="relay-stages mt-3 grid grid-cols-5 gap-1" aria-label="Message lifecycle stages">
      {stages.map(({ label, pending }, index) => (
        <li
          key={label}
          aria-label={label}
          title={
            index === 1 && originState === ProgressState.Unavailable
              ? 'Origin confirmation tracking unavailable'
              : undefined
          }
          data-reached={index === 1 ? originState === ProgressState.Confirmed : index <= stage}
          data-current={index === currentStage}
          aria-current={index === currentStage ? 'step' : undefined}
        >
          <span className="relay-stage-track" aria-hidden="true" />
          <span className="mt-1.5 block min-h-6 text-xxs leading-tight">
            {index === currentStage
              ? index === 2 && !state
                ? 'Waiting for relayer'
                : index === 3 && broadcasting
                  ? 'Broadcasting'
                  : pending
              : index === 1 && originState === ProgressState.Unavailable
                ? 'Not tracked'
                : label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function MessageRelayProgress({
  diagnostics,
  destination,
  observation,
  lifecycle,
  status,
  confirmationSummary,
  selectedRelayer,
  onSelectRelayer,
  onAdvancedToggle,
  children,
}: {
  diagnostics: DiagnosticsState;
  destination: string | undefined;
  observation?: RelayObservation;
  lifecycle: MessageLifecycleProps;
  status: string;
  confirmationSummary?: string;
  selectedRelayer: string;
  onSelectRelayer: (relayer: string) => void;
  onAdvancedToggle: (open: boolean) => void;
  children?: ReactNode;
}) {
  const { connection, data } = diagnostics;
  const { state, delivered, confirmed, paused } = lifecycle;
  const stale = connection === DiagnosticConnection.Stale;
  const active =
    connection === DiagnosticConnection.Live &&
    !!state &&
    !data?.partial &&
    !delivered &&
    !paused &&
    !state.failure &&
    state.phase in phaseStage &&
    !['delivered', 'retrying'].includes(state.phase);
  const modules = new Map(state?.modules.map((node) => [node.node_id, node]));
  const root = state?.tree_root ? modules.get(state.tree_root) : undefined;
  const treeProgress = ismProgress({
    state,
    connection,
    partial: data?.partial,
    delivered,
    confirmed,
  });
  const updatedAt = observation ? parseTimestamp(observation.observedAt) : undefined;
  return (
    <section className="relay-panel" aria-label="Message lifecycle">
      <div className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <output className="block text-sm font-medium" aria-live="polite">
          <span className="relay-status-text">{status}</span>
        </output>
        <span
          className="relay-live-status flex items-center gap-1.5 text-xxs text-foreground-muted"
          data-live={connection === DiagnosticConnection.Live}
        >
          <span className="relay-live-dot" aria-hidden="true" />
          {stale
            ? 'Updates unavailable'
            : connection === DiagnosticConnection.Connecting
              ? 'Connecting…'
              : 'Live relay'}
        </span>
      </div>
      <MessageLifecycleStages {...lifecycle} />
      {confirmationSummary && (
        <p className="mt-4 text-xxs tabular-nums text-foreground-muted" aria-live="polite">
          {confirmationSummary}
        </p>
      )}
      <details
        className="ism-disclosure mt-3 border-t border-gray-400/25 pt-3"
        onToggle={(event) => onAdvancedToggle(event.currentTarget.open)}
      >
        <summary className="flex cursor-pointer list-none items-center gap-1 text-xxs text-foreground-muted [&::-webkit-details-marker]:hidden">
          <span className="ism-chevron" aria-hidden="true">
            ›
          </span>
          Advanced
        </summary>
        {children}
        {stale && (
          <p className="mt-3 text-xxs text-foreground-muted">
            Showing the last observation. Delivery tracking continues.
          </p>
        )}
        {data?.partial && (
          <p className="mt-3 text-xxs text-foreground-muted">
            Some relay observations are unavailable. The tree may be incomplete.
          </p>
        )}
        {state?.retry && (
          <p className="mt-3 text-xxs text-foreground-muted">
            {humanize(state.retry.reason)}
            {state.retry.next_attempt_at_millis != null &&
              ` · Next attempt ${new Date(state.retry.next_attempt_at_millis).toLocaleTimeString()}`}
          </p>
        )}
        {state?.failure?.reason && (
          <p className="mt-2 text-xxs text-foreground-muted">{humanize(state.failure.reason)}</p>
        )}
        {((data?.relayers.length ?? 0) > 1 || (selectedRelayer && !observation)) && (
          <label className="mt-3 flex items-center justify-between gap-2 text-xxs text-foreground-muted">
            Reporting relayer
            <select
              aria-label="Reporting relayer"
              value={selectedRelayer}
              onChange={(event) => onSelectRelayer(event.target.value)}
              className="text-foreground rounded border border-gray-400/30 bg-surface p-1"
            >
              {selectedRelayer && !observation && (
                <option value={selectedRelayer}>
                  {shortAddress(selectedRelayer)} · Unavailable
                </option>
              )}
              {data?.relayers.map((relayer) => (
                <option key={relayer.relayer} value={relayer.relayer}>
                  {shortAddress(relayer.relayer)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-3 flex items-center gap-2 border-t border-gray-400/25 pt-3 text-xxs text-foreground-muted">
          <span>Verification path</span>
          <span className="ml-auto flex items-center gap-1.5" aria-live="polite">
            <span
              className="flex h-3 w-3 shrink-0 items-center justify-center text-primary-500"
              aria-hidden="true"
            >
              {treeProgress.busy && !paused ? (
                <SpinnerIcon
                  width={12}
                  height={12}
                  color="currentColor"
                  className="message-status-spinner"
                />
              ) : treeProgress.complete ? (
                '✓'
              ) : null}
            </span>
            {treeProgress.label}
          </span>
        </div>
        {root && (
          <div className="mt-2 text-xxs text-foreground-muted">
            <p>Enough checks must pass. Unused alternatives don’t block delivery.</p>
            <div
              className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1"
              aria-label="Verification status legend"
            >
              <span>
                <span className="text-green-600 dark:text-green-50" aria-hidden="true">
                  ✓
                </span>{' '}
                Step complete
              </span>
              <span>
                <span className="text-primary-500" aria-hidden="true">
                  ◷
                </span>{' '}
                Checking
              </span>
              <span>
                <span aria-hidden="true">−</span> Unused
              </span>
            </div>
          </div>
        )}
        {root ? (
          <ul className="ism-tree mt-2" aria-label="ISM verification tree">
            <IsmBranch
              key={`${observation?.relayer}:${root.node_id}`}
              node={root}
              destination={destination}
              modules={modules}
              active={active}
              selected={true}
              preparing={
                !!state &&
                !state.failure &&
                ['preparing', 'awaiting_signatures'].includes(state.phase)
              }
              ancestors={[]}
            />
          </ul>
        ) : (
          <div className="mt-2 text-xxs text-foreground-muted">
            {delivered
              ? 'No submitted verification tree was reported.'
              : selectedRelayer && !observation
                ? 'No current observations from the selected relayer.'
                : 'Waiting for security module observations…'}
          </div>
        )}

        {observation && (
          <p className="mt-3 text-xxs text-foreground-muted">
            Observed by <span title={observation.relayer}>{shortAddress(observation.relayer)}</span>
            {updatedAt != null &&
              Number.isFinite(updatedAt) &&
              ` · ${new Date(updatedAt).toLocaleTimeString()}`}
          </p>
        )}
      </details>
    </section>
  );
}

function IsmBranch({
  node,
  destination,
  modules,
  selected,
  active,
  preparing,
  ancestors,
}: {
  node: IsmNode;
  destination: string | undefined;
  modules: Map<string, IsmNode>;
  selected?: boolean;
  active: boolean;
  preparing: boolean;
  ancestors: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (ancestors.includes(node.node_id))
    return <li className="text-xxs text-foreground-muted">Invalid circular module reference</li>;
  const status = ismState(node, selected, preparing);
  const working = active && selected !== false && status === IsmState.Pending;
  const moduleLabel = node.module_type
    ? humanize(node.module_type).replace('Message Id', 'Message ID').replace('Ccip', 'CCIP')
    : 'Unexplored module';
  const signatureThreshold = node.signatures?.threshold ?? node.threshold;
  const memberCount = node.validators?.length ?? node.children.length;
  const aggregation =
    node.module_type === 'Aggregation' && node.threshold != null && node.children.length > 0;
  const label = aggregation
    ? node.threshold === node.children.length
      ? `All ${node.children.length} checks`
      : `Any ${node.threshold} of ${node.children.length} checks`
    : node.module_type
      ? moduleLabel
      : 'Alternative';
  const statusLabel = {
    [IsmState.Verified]: 'Passed',
    [IsmState.ThresholdMet]: 'Threshold met',
    [IsmState.Ready]: 'Proof ready',
    [IsmState.Unused]: 'Unused',
    [IsmState.Failed]: 'Attempt failed',
    [IsmState.Waiting]: 'Waiting',
    [IsmState.Pending]: working ? 'Checking' : 'Waiting',
    [IsmState.Unknown]: 'Not explored',
  }[status];
  const complete = [IsmState.Verified, IsmState.ThresholdMet, IsmState.Ready].includes(status);
  return (
    <li
      className="ism-branch"
      data-selected={selected}
      data-complete={complete}
      data-working={working}
    >
      <details
        className="ism-node"
        data-state={status}
        data-complete={complete}
        data-working={working}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary
          className="flex cursor-pointer list-none items-center gap-1.5 rounded px-2 py-1.5 text-xxs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 [&::-webkit-details-marker]:hidden"
          title={`${label} · ${statusLabel}`}
        >
          <span className="ism-state-icon shrink-0" aria-hidden="true" key={status}>
            {complete ? (
              '✓'
            ) : status === IsmState.Failed ? (
              '×'
            ) : selected === false || status === IsmState.Unknown ? (
              '−'
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M5 2v3l2 1"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-xxs font-medium">{label}</span>
          {!aggregation && node.threshold != null && memberCount > 0 && (
            <span className="shrink-0 text-xxs tabular-nums text-foreground-muted">
              {node.threshold}/{memberCount}
            </span>
          )}
          <span className="ism-status-label shrink-0 text-[0.6rem] text-foreground-muted">
            {statusLabel}
          </span>
          <span className="ism-chevron text-foreground-muted" aria-hidden="true">
            ›
          </span>
        </summary>
        <div className="space-y-1 px-3 pb-2.5 text-xxs text-foreground-muted">
          <p>{moduleLabel}</p>
          {selected === false && (
            <p>Not selected for this attempt. This branch does not block the selected path.</p>
          )}
          <p>
            Verification:{' '}
            {node.verification ? humanize(node.verification) : 'Not separately reported'}
          </p>
          {node.metadata_status && <p>Proof data: {humanize(node.metadata_status)}</p>}
          {status === IsmState.Ready && (
            <p>Proof data is prepared; a separate verification result is not available.</p>
          )}
          {status === IsmState.Unknown && <p>The relayer has not explored this module yet.</p>}
          {node.verified != null && node.threshold != null && (
            <p>
              {node.verified} passed · {node.threshold} required
              {status === IsmState.ThresholdMet ? ' — requirement met' : ''}
            </p>
          )}
          {expanded && <IsmAddress address={node.ism} destination={destination} />}
          {node.signatures?.collected != null && (
            <div>
              <p className="tabular-nums">
                {node.signatures.collected}
                {signatureThreshold != null ? `/${signatureThreshold}` : ''} signatures collected
              </p>
              {signatureThreshold != null && signatureThreshold > 0 && (
                <div className="ism-quorum-track mt-1.5" aria-hidden="true">
                  <span
                    style={{
                      width: `${Math.min(100, (node.signatures.collected / signatureThreshold) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}
          {node.threshold != null && <p>Threshold: {node.threshold}</p>}
          {node.signatures?.index != null && (
            <p>Checkpoint index: {node.signatures.index.toLocaleString()}</p>
          )}
          {Object.entries(node.checks ?? {}).map(([check, outcome]) =>
            outcome == null ? null : (
              <p key={check}>
                {humanize(check)}: {humanize(outcome)}
              </p>
            ),
          )}
          {node.offchain_read && <p>Offchain data: {humanize(node.offchain_read.state)}</p>}
          {node.metadata_error && <p>{humanize(node.metadata_error)}</p>}
        </div>
      </details>
      {node.children.length > 0 && (
        <ul className="ism-children">
          {node.children.map((child) => (
            <IsmBranch
              key={child.node_id}
              node={modules.get(child.node_id) ?? { ...child, discovered: false, children: [] }}
              modules={modules}
              destination={destination}
              ancestors={[...ancestors, node.node_id]}
              active={active}
              preparing={preparing}
              selected={
                selected === false || node.selected_children?.includes(child.node_id) === false
                  ? false
                  : node.selected_children ||
                      (aggregation && node.threshold === node.children.length)
                    ? selected
                    : undefined
              }
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Resolve explorer links from destination metadata; this does not query an RPC. */
function IsmAddress({
  address,
  destination,
}: {
  address: string;
  destination: string | undefined;
}) {
  const multiProvider = useMultiProvider();
  const metadata = destination ? multiProvider.tryGetChainMetadata(destination) : undefined;
  const { data, isError } = useQuery({
    queryKey: ['ismExplorerAddress', destination, address, metadata],
    queryFn: async () => {
      const nativeAddress = metadata
        ? convertToProtocolAddress(address, metadata.protocol, metadata.bech32Prefix)
        : address;
      const url = destination
        ? await multiProvider.tryGetExplorerAddressUrl(destination, nativeAddress)
        : null;
      return { address: nativeAddress, url };
    },
    staleTime: Infinity,
    retry: false,
  });
  const displayAddress = data?.address ?? address;
  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      {data?.url ? (
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
          title={displayAddress}
          aria-label="View ISM on destination explorer (opens in new tab)"
        >
          {shortAddress(displayAddress)} <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <span title={displayAddress}>{shortAddress(displayAddress)}</span>
      )}
      <CopyButton
        copyValue={displayAddress}
        width={12}
        height={12}
        aria-label="Copy ISM address"
        className="rounded p-1.5 text-foreground-muted hover:bg-primary-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 [&_path]:fill-current [&_rect]:stroke-current"
      />
      {(isError || (data && !data.url)) && <span>Explorer unavailable</span>}
    </div>
  );
}
