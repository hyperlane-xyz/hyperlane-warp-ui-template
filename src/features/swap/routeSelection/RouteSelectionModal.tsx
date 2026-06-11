import { IToken } from '@hyperlane-xyz/sdk';
import { CopyButton, HyperlaneLogo, Modal } from '@hyperlane-xyz/widgets';
import { Fragment, useMemo, useState } from 'react';

import { ChainLogo } from '../../../components/icons/ChainLogo';
import { TokenIcon } from '../../../components/icons/TokenIcon';
import { HoverTooltip } from '../../../components/tooltip/HoverTooltip';
import type { QuoteBridgeStep, QuoteStep, QuoteSwapStep } from '../../api/types';
import { useMultiProvider } from '../../chains/hooks';
import { formatDisplayAmount, formatFeeAmount } from '../balances/utils';
import { getDexMeta } from '../dexMeta';
import { getTokenByKeyFromMap, useTokenByKeyMap } from '../tokens/hooks';
import type { UiToken } from '../tokens/types';
import type { AugmentedRoute } from '../types';
import { useRouteChainTokens } from './hooks';
import { buildFlowNodes, computeRate, formatStepAmount, formatWarpRouteId } from './utils';

interface Props {
  isOpen: boolean;
  close: () => void;
  routes: AugmentedRoute[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  dstToken?: UiToken | null;
}

type ViewMode = 'flow' | 'json';
const VIEW_MODES: ViewMode[] = ['flow', 'json'];

export function RouteSelectionModal({
  isOpen,
  close,
  routes,
  selectedIndex,
  onSelect,
  dstToken,
}: Props) {
  const [view, setView] = useState<ViewMode>('flow');

  const handleSelect = (i: number) => {
    onSelect(i);
    close();
  };

  return (
    <Modal
      isOpen={isOpen}
      close={close}
      panelClassname="route-selection-modal max-w-2xl overflow-hidden p-0 dark:border dark:border-primary-300/40 dark:bg-surface dark:text-foreground-primary dark:shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
    >
      <div className="flex w-full items-center justify-between bg-accent-gradient px-4 py-2.5 shadow-accent-glow">
        <span className="font-secondary text-base font-normal tracking-wider text-white">
          Available Routes
        </span>
        <div className="flex gap-1">
          {VIEW_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setView(m)}
              className={`rounded px-2.5 py-0.5 font-secondary text-xs capitalize text-white transition-colors ${
                view === m ? 'bg-white/25' : 'hover:bg-white/10'
              }`}
            >
              {m === 'flow' ? 'Flow' : 'JSON'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4">
        {view === 'flow' ? (
          routes.map((route, i) => (
            <RouteCard
              key={i}
              route={route}
              index={i}
              isSelected={i === selectedIndex}
              isBest={i === 0}
              onSelect={handleSelect}
              dstToken={dstToken}
            />
          ))
        ) : (
          <JsonView routes={routes} />
        )}
      </div>
    </Modal>
  );
}

interface RouteCardProps {
  route: AugmentedRoute;
  index: number;
  isSelected: boolean;
  isBest: boolean;
  onSelect: (i: number) => void;
  dstToken?: UiToken | null;
}

function RouteCard({ route, index, isSelected, isBest, onSelect, dstToken }: RouteCardProps) {
  const decimals = dstToken?.decimals ?? 18;
  const symbol = dstToken?.symbol ?? '';
  const outputFormatted = formatDisplayAmount(BigInt(route.raw.output), decimals);

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
        isSelected
          ? 'border-accent-500 bg-accent-500/5 dark:border-accent-500/70 dark:bg-accent-500/10'
          : 'border-gray-200 bg-white hover:border-gray-300 dark:border-primary-300/20 dark:bg-transparent dark:hover:border-primary-300/40'
      }`}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isBest && (
            <span className="rounded bg-accent-500 px-1.5 py-0.5 font-secondary text-xxs text-white">
              Best
            </span>
          )}
          <span className="font-secondary text-xs text-gray-500 dark:text-foreground-secondary">
            Route {index + 1}
          </span>
        </div>
        <span className="font-secondary text-sm font-medium dark:text-foreground-primary">
          {outputFormatted} {symbol}
        </span>
      </div>
      <RouteFlowDiagram steps={route.raw.steps} dstToken={dstToken} />
    </button>
  );
}

function RouteFlowDiagram({ steps, dstToken }: { steps: QuoteStep[]; dstToken?: UiToken | null }) {
  const tokenMap = useTokenByKeyMap();
  const multiProvider = useMultiProvider();
  // Ensure tokens for every chain that appears in these steps are loaded
  // into the tokenMap. Intermediate chains (e.g. Arbitrum when the user
  // picked Base→Viction) are never fetched by the token picker, so
  // tokens like WETH on Arb would otherwise stay unresolved.
  useRouteChainTokens(steps);
  const nodes = buildFlowNodes(steps);
  const lastIdx = nodes.length - 1;

  // Resolve all node tokens upfront so step edges can receive their tokenOut
  // directly rather than re-looking it up (avoids misses for dest-chain tokens).
  const resolvedTokens: (UiToken | null)[] = nodes.map((node, i) => {
    const found = getTokenByKeyFromMap(
      tokenMap,
      `${node.chainId}-${node.tokenAddress.toLowerCase()}`,
    );
    if (found) return found;
    if (i === lastIdx && dstToken) return dstToken;
    return null;
  });

  return (
    <div className="flex flex-wrap items-end gap-1.5">
      {nodes.map((node, i) => {
        const step = i < steps.length ? steps[i] : undefined;
        const token = resolvedTokens[i];
        const tokenOut = i + 1 <= lastIdx ? resolvedTokens[i + 1] : null;
        const chainName = multiProvider.tryGetChainName(node.chainId) ?? undefined;

        return (
          <Fragment key={i}>
            <TokenNode token={token} chainName={chainName} />
            {step && (
              <StepEdge
                step={step}
                tokenMap={tokenMap}
                tokenOut={tokenOut}
                stepIndex={i}
                steps={steps}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ── JSON view with copy button ─────────────────────────────────────────

function JsonView({ routes }: { routes: AugmentedRoute[] }) {
  const json = useMemo(
    () =>
      JSON.stringify(
        routes.map((r) => r.raw),
        null,
        2,
      ),
    [routes],
  );

  return (
    <div className="relative">
      <CopyButton copyValue={json} width={14} height={14} className="absolute right-2 top-2 z-10" />
      <pre className="font-mono overflow-x-auto whitespace-pre-wrap break-all rounded bg-gray-50 p-3 pt-8 text-xs dark:bg-white/5 dark:text-foreground-primary">
        {json}
      </pre>
    </div>
  );
}

const CHAIN_BADGE_SIZE = 13;
const CHAIN_BADGE_CONTAINER = CHAIN_BADGE_SIZE + 2;

function TokenNode({ token, chainName }: { token: UiToken | null; chainName?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: 26, height: 26 }}>
        <TokenIcon token={token as unknown as IToken} size={26} />
        {chainName && (
          <div
            className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border border-white bg-white dark:border-white/[0.22] dark:bg-surface"
            style={{ width: CHAIN_BADGE_CONTAINER, height: CHAIN_BADGE_CONTAINER }}
          >
            <ChainLogo chainName={chainName} size={CHAIN_BADGE_SIZE} />
          </div>
        )}
      </div>
      <span className="mt-1 max-w-[3.5rem] truncate font-secondary text-xxs text-gray-500 dark:text-foreground-secondary">
        {token?.symbol ?? '?'}
      </span>
    </div>
  );
}

function StepEdge({
  step,
  tokenMap,
  tokenOut,
  stepIndex,
  steps,
}: {
  step: QuoteStep;
  tokenMap: Map<string, UiToken>;
  tokenOut: UiToken | null;
  stepIndex: number;
  steps: QuoteStep[];
}) {
  if (step.type === 'swap')
    return <SwapEdge step={step} tokenMap={tokenMap} resolvedTokenOut={tokenOut} />;
  return <BridgeEdge step={step} tokenMap={tokenMap} stepIndex={stepIndex} steps={steps} />;
}

// ── Swap edge ──────────────────────────────────────────────────────────

function SwapEdge({
  step,
  tokenMap,
  resolvedTokenOut,
}: {
  step: QuoteSwapStep;
  tokenMap: Map<string, UiToken>;
  resolvedTokenOut: UiToken | null;
}) {
  const meta = getDexMeta(step.dex);
  const tokenIn = getTokenByKeyFromMap(tokenMap, `${step.chain}-${step.tokenIn.toLowerCase()}`);
  // Use the pre-resolved output token (which already has dstToken applied as fallback).
  const tokenOut =
    getTokenByKeyFromMap(tokenMap, `${step.chain}-${step.tokenOut.toLowerCase()}`) ??
    resolvedTokenOut;

  const decimalsIn = tokenIn?.decimals ?? 18;
  const decimalsOut = tokenOut?.decimals ?? 18;
  const amountIn = formatStepAmount(step.amountIn, decimalsIn);
  const amountOut = formatStepAmount(step.amountOut, decimalsOut);

  // Human-readable exchange rate: how many tokenOut per 1 tokenIn.
  const rate = computeRate(step.amountIn, decimalsIn, step.amountOut, decimalsOut);

  const tooltip = (
    <div className="flex flex-col gap-1.5">
      <div className="font-medium dark:text-foreground-primary">{meta?.name ?? step.dex}</div>
      {/* Amounts */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-400 dark:text-foreground-secondary">Amount in</span>
          <span className="dark:text-foreground-primary">
            {amountIn} <span className="text-gray-400">{tokenIn?.symbol ?? '?'}</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-400 dark:text-foreground-secondary">Amount out</span>
          <span className="dark:text-foreground-primary">
            {amountOut} <span className="text-gray-400">{tokenOut?.symbol ?? '?'}</span>
          </span>
        </div>
        {rate && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-400 dark:text-foreground-secondary">Rate</span>
            <span className="dark:text-foreground-primary">
              1 {tokenIn?.symbol ?? '?'} = {rate} {tokenOut?.symbol ?? '?'}
            </span>
          </div>
        )}
      </div>
      {/* Pool info — only shown when there's something non-trivial to display */}
      {(step.path.length > 2 || step.minPoolTvlUsd != null) && (
        <div className="space-y-0.5 border-t border-gray-100 pt-1 dark:border-white/10">
          {step.path.length > 2 && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-400 dark:text-foreground-secondary">Hops</span>
              <span className="dark:text-foreground-primary">{step.path.length - 1}</span>
            </div>
          )}
          {step.minPoolTvlUsd != null && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-400 dark:text-foreground-secondary">Min pool TVL</span>
              <span className="dark:text-foreground-primary">
                ${step.minPoolTvlUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex items-center gap-1 pb-4">
      <span className="text-sm text-gray-400">→</span>
      <HoverTooltip tooltip={tooltip}>
        <div className="flex items-center gap-1 rounded border border-purple-200 bg-purple-50 px-1.5 py-0.5 dark:border-purple-800/30 dark:bg-purple-900/15">
          <DexLogo meta={meta} dexKey={step.dex} size={13} />
          <span className="font-secondary text-xxs text-purple-700 dark:text-purple-300">
            {meta?.name ?? step.dex}
          </span>
        </div>
      </HoverTooltip>
      <span className="text-sm text-gray-400">→</span>
    </div>
  );
}

// ── Bridge edge ────────────────────────────────────────────────────────

function BridgeEdge({
  step,
  tokenMap,
  stepIndex,
  steps,
}: {
  step: QuoteBridgeStep;
  tokenMap: Map<string, UiToken>;
  stepIndex: number;
  steps: QuoteStep[];
}) {
  const asset = getTokenByKeyFromMap(tokenMap, `${step.chain}-${step.asset.toLowerCase()}`);
  const igpToken = getTokenByKeyFromMap(
    tokenMap,
    `${step.chain}-${step.fee.igpToken.toLowerCase()}`,
  );

  // Use next swap step's tokenIn decimals for amountOut if available (dest-chain address).
  const nextStep = steps[stepIndex + 1];
  const destAsset =
    nextStep?.type === 'swap'
      ? getTokenByKeyFromMap(tokenMap, `${step.destChain}-${nextStep.tokenIn.toLowerCase()}`)
      : nextStep?.type === 'bridge'
        ? getTokenByKeyFromMap(tokenMap, `${step.destChain}-${nextStep.asset.toLowerCase()}`)
        : asset;

  const amountIn = formatStepAmount(step.amountIn, asset?.decimals ?? 18);
  const amountOut = formatStepAmount(step.amountOut, destAsset?.decimals ?? asset?.decimals ?? 18);
  const tokenFee = BigInt(step.fee.tokenFee);
  const igpAmount = BigInt(step.fee.igpAmount);

  const symbol = asset?.symbol ?? step.bridgeSymbol ?? '?';
  const routeLabel = step.warpRouteId
    ? formatWarpRouteId(step.warpRouteId)
    : (step.bridgeSymbol ?? 'Bridge');

  const tooltip = (
    <div className="flex flex-col gap-1.5">
      <div className="font-medium dark:text-foreground-primary">Hyperlane Bridge</div>
      {step.warpRouteId && (
        <div className="font-mono break-all text-gray-400 dark:text-foreground-secondary">
          {step.warpRouteId}
        </div>
      )}
      {/* Amounts */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-400 dark:text-foreground-secondary">Amount in</span>
          <span className="dark:text-foreground-primary">
            {amountIn} <span className="text-gray-400">{symbol}</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-400 dark:text-foreground-secondary">Amount out</span>
          <span className="dark:text-foreground-primary">
            {amountOut} <span className="text-gray-400">{symbol}</span>
          </span>
        </div>
      </div>
      {/* Fees */}
      {(tokenFee > 0n || igpAmount > 0n) && (
        <div className="border-t border-gray-100 pt-1 dark:border-white/10">
          {tokenFee > 0n && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-400 dark:text-foreground-secondary">Bridge fee</span>
              <span className="dark:text-foreground-primary">
                {formatFeeAmount(tokenFee, asset?.decimals ?? 18)}{' '}
                <span className="text-gray-400">{symbol}</span>
              </span>
            </div>
          )}
          {igpAmount > 0n && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-400 dark:text-foreground-secondary">IGP</span>
              <span className="dark:text-foreground-primary">
                {formatFeeAmount(igpAmount, igpToken?.decimals ?? 18)}{' '}
                <span className="text-gray-400">{igpToken?.symbol ?? '?'}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex items-center gap-1 pb-4">
      <span className="text-sm text-gray-400">→</span>
      <HoverTooltip tooltip={tooltip}>
        <div className="flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 dark:border-blue-800/30 dark:bg-blue-900/15">
          <HyperlaneLogo width={13} height={13} color="currentColor" />
          <span className="max-w-[7rem] truncate font-secondary text-xxs text-blue-700 dark:text-blue-300">
            {routeLabel}
          </span>
        </div>
      </HoverTooltip>
      <span className="text-sm text-gray-400">→</span>
    </div>
  );
}

// ── Visual primitives ──────────────────────────────────────────────────

function DexLogo({
  meta,
  dexKey,
  size,
}: {
  meta: { name: string; logoUri: string } | undefined;
  dexKey: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (meta?.name ?? dexKey).charAt(0).toUpperCase();

  if (meta?.logoUri && !failed) {
    return (
      <img
        src={meta.logoUri}
        alt={meta.name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-purple-200 font-secondary font-bold text-purple-800 dark:bg-purple-800/40 dark:text-purple-200"
      style={{ width: size, height: size, fontSize: Math.floor(size * 0.6) }}
    >
      {initial}
    </span>
  );
}
