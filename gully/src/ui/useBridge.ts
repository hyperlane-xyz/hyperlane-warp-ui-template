// All bridge state for both design directions. The shells (A, B) only render it.
import { sendBlocker } from '../bridge/blocker';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { formatEther, isAddress, type Address } from 'viem';

import { CHAINS, CHILD, PARENT, type ChainKey } from '../config/chains';
import { DEFAULT_FAST_ROUTE_ID, FAST_ROUTES, LEGACY_ROUTES, MIRROR_ROUTES, routeFor } from '../config/routes';
import { parseMirrorLink, pickMirrorRoute, type MirrorLink } from '../config/mirrors';
import { getBridgeClient, onBridgeClientChange, type Balances } from '../bridge/bridgeClient';
import { pub } from '../bridge/clients';
import { track } from '../analytics/umami';
import { parseAmount } from '../bridge/format';
import { ends } from '../bridge/localClient';
import { pickRoute } from '../bridge/selectRoute';
import type { ActivityItem, Direction, Quote, RouteKind, StepDef, StepUpdate, TransferRecord } from '../bridge/types';
import { walletStore } from '../bridge/wallet';
import { toast } from './common/toasts';

const STORE = 'gully-bridge:transfers';
const REF = 'gully-bridge:ref';

function load<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

export interface UrlOptions {
  ref?: Address;
  embed: boolean;
  direction?: Direction;
  route?: RouteKind;
  amount?: string;
  preview: boolean;
  /** Gully Warp Mirror deep link `?token=<originToken>&to=<domain>` (kre8.fun Drop page "Bridge" button) */
  mirror?: MirrorLink;
}

export function readUrl(): UrlOptions {
  const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  let ref = q.get('ref') || undefined;
  if (ref && !isAddress(ref)) ref = undefined;
  if (ref) {
    try {
      sessionStorage.setItem(REF, ref);
    } catch {
      /* ignore */
    }
  } else {
    try {
      ref = sessionStorage.getItem(REF) || undefined;
    } catch {
      /* ignore */
    }
  }
  const d = q.get('direction') || q.get('d');
  const r = q.get('route');
  return {
    ref: ref as Address | undefined,
    embed: q.has('embed') || location.pathname.endsWith('/embed') || location.pathname.endsWith('/embed/'),
    direction: d === 'withdraw' || d === 'deposit' ? d : undefined,
    route: r === 'fast' || r === 'canonical' ? r : undefined,
    amount: q.get('amount') || undefined,
    preview: q.has('preview'),
    mirror: parseMirrorLink(q.toString()),
  };
}

export type StepState = Record<string, { state: 'idle' | 'active' | 'done' | 'error'; tx?: string; message?: string }>;

export function useWallet() {
  return useSyncExternalStore(walletStore.subscribe, walletStore.get, walletStore.get);
}

/** live block heights of both chains (polled), plus a short history for sparklines */
export function useHeads(intervalMs = 4000) {
  const [heads, setHeads] = useState<Record<ChainKey, { block?: bigint; history: number[]; ok: boolean }>>({
    arbitrumsepolia: { history: [], ok: true },
    gullychaintestnet: { history: [], ok: true },
  });
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const res = await Promise.all(
        ([PARENT, CHILD] as ChainKey[]).map((c) =>
          pub(c)
            .getBlockNumber({ cacheTime: 0 })
            .then((b) => [c, b] as const)
            .catch(() => [c, undefined] as const),
        ),
      );
      if (stop) return;
      setHeads((h) => {
        const n = { ...h };
        for (const [c, b] of res) {
          const prev = h[c];
          const delta = b !== undefined && prev.block !== undefined ? Number(b - prev.block) : 0;
          n[c] = { block: b ?? prev.block, ok: b !== undefined, history: [...prev.history, delta].slice(-24) };
        }
        return n;
      });
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [intervalMs]);
  return heads;
}

export function useActivity(intervalMs = 20000) {
  const [items, setItems] = useState<ActivityItem[] | undefined>();
  const [error, setError] = useState<string>();
  const seen = useRef(new Set<string>());
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const list = await getBridgeClient().recentActivity(30);
        if (stop) return;
        if (seen.current.size) {
          const fresh = list.filter((i) => !seen.current.has(i.key));
          if (fresh.length) toast({ kind: 'info', title: `${fresh.length} new transfer${fresh.length > 1 ? 's' : ''}`, body: 'Live from the chains' });
        }
        list.forEach((i) => seen.current.add(i.key));
        setItems(list);
        setError(undefined);
      } catch (e) {
        if (!stop) setError((e as Error).message);
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [intervalMs]);
  return { items, error };
}

export function useBridge(url: UrlOptions) {
  const wallet = useWallet();
  const [, force] = useState(0);
  useEffect(() => onBridgeClientChange(() => force((n) => n + 1)), []);
  // a mirror deep link preselects its route; direction Gully Chain -> destination until we see the wallet holds the
  // mirror, then "Bridge back" (destination -> Gully Chain) unless the link or the user chose a direction
  const linked = pickMirrorRoute(MIRROR_ROUTES, url.mirror);
  const [direction, setDirectionRaw] = useState<Direction>(url.direction || (linked ? 'withdraw' : 'deposit'));
  const directionChosen = useRef(!!url.direction);
  const setDirection = (d: Direction | ((p: Direction) => Direction)) => {
    directionChosen.current = true;
    setDirectionRaw(d);
  };
  const [amountText, setAmountText] = useState(url.amount || '');
  const [manualKind, setManualKind] = useState<RouteKind | undefined>(url.route);
  const [fastRouteId, setFastRouteId] = useState(linked?.id || DEFAULT_FAST_ROUTE_ID);
  const [balances, setBalances] = useState<Balances>({});
  const [quotes, setQuotes] = useState<Partial<Record<RouteKind, Quote>>>({});
  const [quoteError, setQuoteError] = useState<string>();
  const [quoting, setQuoting] = useState(false);
  const [steps, setSteps] = useState<StepState>({});
  const [busy, setBusy] = useState(false);
  const [transfers, setTransfers] = useState<TransferRecord[]>(() => load(STORE, []));
  const [activeId, setActiveId] = useState<string>();

  const amount = parseAmount(amountText);
  // deposits always go through the default (native ETH) route; a retired route (gETH, hypETH) is only used to redeem
  const route = routeFor(direction, fastRouteId);
  const routeId = route.id;
  const { from, to } = ends(direction);
  const mirror = route.warp;

  // balances
  useEffect(() => {
    if (!wallet.address) {
      setBalances({});
      return;
    }
    let stop = false;
    const tick = () =>
      getBridgeClient()
        .balances(wallet.address!, routeId)
        .then((b) => !stop && setBalances(b))
        .catch(() => undefined);
    tick();
    const id = setInterval(tick, 12000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [wallet.address, routeId]);

  // mirror holders default to "Bridge back" (once per route, only while nobody picked a direction)
  const autoBack = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!mirror || directionChosen.current || autoBack.current === route.id) return;
    if (balances.mirrorToken === undefined) return;
    autoBack.current = route.id;
    if (balances.mirrorToken > 0n) setDirectionRaw('deposit');
  }, [mirror, route.id, balances.mirrorToken]);

  // retired-route tokens the wallet still holds: the UI offers to redeem them for ETH on Arbitrum Sepolia
  const legacyHoldings = LEGACY_ROUTES.map((r) => ({
    routeId: r.id,
    symbol: r.tokens[CHILD].symbol,
    name: r.tokens[CHILD].name,
    balance: balances.legacy?.[r.id] ?? 0n,
  })).filter((h) => h.balance > 0n);
  // back to the default route once a redeem has emptied the retired token
  useEffect(() => {
    if (route.legacy && balances.legacy && (balances.legacy[route.id] ?? 0n) === 0n && !busy) setFastRouteId(DEFAULT_FAST_ROUTE_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id, route.legacy, balances.legacy]);

  const pick = useMemo(
    () =>
      pickRoute({
        direction,
        amount,
        fastAvailable: FAST_ROUTES.length > 0 && quotes.fast?.available !== false,
        fastTokenBalance: wallet.address ? balances.fastToken : undefined,
        childEthBalance: balances.childEth,
      }),
    [direction, amount, quotes.fast?.available, wallet.address, balances.fastToken, balances.childEth],
  );
  // a mirror only moves over its warp route: the canonical rollup bridge carries ETH only
  const kind: RouteKind = mirror ? 'fast' : manualKind || pick.kind;

  // quotes for both lanes, debounced
  useEffect(() => {
    const amt = amount && amount > 0n ? amount : 10n ** 15n; // preview quote at 0.001 when empty
    let stop = false;
    setQuoting(true);
    const t = setTimeout(async () => {
      const c = getBridgeClient();
      const req = { direction, amount: amt, sender: wallet.address, ref: url.ref, fastRouteId: routeId };
      const [f, k] = await Promise.allSettled([c.quote({ ...req, kind: 'fast' }), c.quote({ ...req, kind: 'canonical' })]);
      if (stop) return;
      setQuotes({
        fast: f.status === 'fulfilled' ? f.value : undefined,
        canonical: k.status === 'fulfilled' ? k.value : undefined,
      });
      setQuoteError(
        f.status === 'rejected' && k.status === 'rejected'
          ? 'Could not reach the chains for a quote. Check your connection and try again.'
          : undefined,
      );
      setQuoting(false);
    }, 250);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [direction, amount, wallet.address, url.ref, routeId]);

  const quote = quotes[kind];

  // tracking of open transfers
  useEffect(() => save(STORE, transfers.slice(0, 50)), [transfers]);
  useEffect(() => {
    const open = transfers.filter((t) => !['delivered', 'claimed', 'failed'].includes(t.status));
    if (!open.length) return;
    const id = setInterval(async () => {
      for (const t of open) {
        try {
          const n = await getBridgeClient().track(t);
          if (n.status !== t.status) {
            setTransfers((all) => all.map((x) => (x.id === n.id ? n : x)));
            if (n.status === 'delivered') toast({ kind: 'success', title: 'Delivered', body: `${n.receiveSymbol} arrived on ${n.to === CHILD ? CHAINS[CHILD].short : CHAINS[PARENT].name}` });
            if (n.status === 'claimable') toast({ kind: 'info', title: 'Ready to claim', body: 'Your withdrawal passed the challenge period' });
          }
        } catch {
          /* retry next tick */
        }
      }
    }, 5000);
    return () => clearInterval(id);
  }, [transfers]);

  // canonical withdrawals of the connected wallet, so pending claims show after a reload or on another device
  useEffect(() => {
    if (!wallet.address) return;
    getBridgeClient()
      .withdrawalsOf(wallet.address)
      .then((ws) =>
        setTransfers((all) => {
          const ids = new Set(all.map((t) => t.id));
          return [...all, ...ws.filter((w) => !ids.has(w.id))].sort((a, b) => b.createdAt - a.createdAt);
        }),
      )
      .catch(() => undefined);
  }, [wallet.address]);

  const onStep = useCallback((u: StepUpdate) => {
    setSteps((s) => ({ ...s, [u.step]: { state: u.state, tx: u.tx ?? s[u.step]?.tx, message: u.message } }));
  }, []);

  const balanceFrom: bigint | undefined =
    direction === 'deposit'
      ? mirror
        ? balances.mirrorToken
        : balances.parentEth
      : kind === 'fast'
        ? balances.fastToken
        : balances.childEth;

  const blocker = sendBlocker({
    amount,
    quote,
    quoting,
    wallet: wallet.address,
    balanceFrom,
    paysValueFromBalance: direction === 'deposit' || (kind === 'fast' && route.tokens[CHILD].tokenType === 'native'),
  });

  const send = useCallback(async () => {
    if (!quote || !amount) return;
    setBusy(true);
    setSteps({});
    try {
      const q = { ...quote, req: { ...quote.req, amount, sender: wallet.address, recipient: wallet.address, ref: url.ref } };
      const rec = await getBridgeClient().execute(q, onStep);
      setTransfers((all) => [rec, ...all.filter((t) => t.id !== rec.id)]);
      setActiveId(rec.id);
      if (rec.status === 'failed') toast({ kind: 'error', title: 'Transaction failed', body: rec.error || 'Reverted' });
      else {
        track('bridge', { lane: quote.req.kind });
        toast({ kind: 'success', title: 'Sent', body: `${quote.req.kind === 'fast' ? 'Fast' : 'Canonical'} transfer submitted` });
      }
      setAmountText('');
    } catch (e) {
      const msg = (e as { shortMessage?: string }).shortMessage || (e as Error).message || 'Something went wrong';
      setSteps((s) => {
        const active = Object.entries(s).find(([, v]) => v.state === 'active')?.[0] || 'send';
        return { ...s, [active]: { state: 'error', message: msg } };
      });
      toast({ kind: 'error', title: /reject|denied/i.test(msg) ? 'Request rejected' : 'Transfer not sent', body: msg.slice(0, 140) });
    } finally {
      setBusy(false);
    }
  }, [quote, amount, wallet.address, url.ref, onStep]);

  const claim = useCallback(
    async (rec: TransferRecord) => {
      setBusy(true);
      try {
        const n = await getBridgeClient().claim(rec, onStep);
        setTransfers((all) => all.map((x) => (x.id === n.id ? n : x)));
        toast({ kind: 'success', title: 'Claimed', body: `ETH released on ${CHAINS[PARENT].name}` });
      } catch (e) {
        toast({ kind: 'error', title: 'Claim failed', body: ((e as Error).message || '').slice(0, 140) });
      } finally {
        setBusy(false);
      }
    },
    [onStep],
  );

  const active = transfers.find((t) => t.id === activeId);
  const stepDefs: StepDef[] = quote?.steps || [];

  return {
    url,
    wallet,
    direction,
    setDirection: (d: Direction) => {
      setDirection(d);
      if (d === 'deposit' && !mirror) setFastRouteId(DEFAULT_FAST_ROUTE_ID);
      setSteps({});
    },
    flip: () => {
      setDirection((d) => (d === 'deposit' ? 'withdraw' : 'deposit'));
      // a mirror route works both ways; only the retired ETH routes fall back to the default on a flip
      if (!mirror) setFastRouteId(DEFAULT_FAST_ROUTE_ID);
      setSteps({});
    },
    from,
    to,
    amountText,
    setAmountText,
    amount,
    kind,
    pick,
    manualKind,
    setKind: (k: RouteKind | undefined) => setManualKind(k),
    route,
    routes: FAST_ROUTES,
    /** the selected Gully Warp Mirror (coin + destination), undefined on the ETH routes */
    mirror,
    mirrorRoutes: MIRROR_ROUTES,
    /** pick a mirror route (or the default ETH route with undefined) */
    selectMirror: (id?: string) => {
      setFastRouteId(id || DEFAULT_FAST_ROUTE_ID);
      setManualKind(undefined);
      if (id) {
        // start GullyChain -> destination; the holder check above flips to "Bridge back" if the wallet holds the mirror
        setDirectionRaw('withdraw');
        directionChosen.current = false;
        autoBack.current = undefined;
      }
      setSteps({});
    },
    fastRouteId: routeId,
    setFastRouteId,
    legacyHoldings,
    /** switch the card to redeeming a retired route's token (GullyChain -> Arbitrum Sepolia, Fast lane, full balance) */
    redeemLegacy: (id: string) => {
      const h = legacyHoldings.find((x) => x.routeId === id);
      if (!h) return;
      setDirection('withdraw');
      setFastRouteId(id);
      setManualKind('fast');
      setAmountText(formatEther(h.balance));
      setSteps({});
    },
    useDefaultRoute: () => {
      setFastRouteId(DEFAULT_FAST_ROUTE_ID);
      setSteps({});
    },
    quotes,
    quote,
    quoting,
    quoteError,
    balances,
    balanceFrom,
    blocker,
    busy,
    steps,
    stepDefs,
    send,
    claim,
    transfers,
    active,
    setActiveId,
  };
}

export type BridgeState = ReturnType<typeof useBridge>;
