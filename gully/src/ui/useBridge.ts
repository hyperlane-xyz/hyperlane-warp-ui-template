// All bridge state for every design direction. The shells (A, B, C) only render it.
import { sendBlocker } from '../bridge/blocker';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { formatEther, isAddress, type Address } from 'viem';

import { CHAINS, CHILD, isEvm, PARENT, type ChainKey } from '../config/chains';
import { REMOTE_CHAINS } from '../config/multichain';
import { DEFAULT_FAST_ROUTE_ID, FAST_ROUTES, LEGACY_ROUTES, MIRROR_ROUTES, routeFor } from '../config/routes';
import { parseMirrorLink, pickMirrorRoute, type MirrorLink } from '../config/mirrors';
import { getBridgeClient, onBridgeClientChange, type Balances } from '../bridge/bridgeClient';
import { pub } from '../bridge/clients';
import { track } from '../analytics/umami';
import { parseAmount } from '../bridge/format';
import { dropApplies, dropEligible, gasDropEnabled, readGasDrop, type GasDropState } from '../bridge/gasDrop';
import { isOpen, loadTransfers, saveTransfers } from '../bridge/history';
import { endsOf, pickOption, tokenOptions } from '../bridge/lanes';
import { pickRoute } from '../bridge/selectRoute';
import type { ActivityItem, Direction, Quote, RouteKind, StepDef, StepUpdate, TransferRecord } from '../bridge/types';
import { walletStore } from '../bridge/wallet';
import { gullyIdConfig } from '../gully-id/gullyId';
import { useGullySession } from '../gully-id/useGullySession';
import { isSolanaAddress } from '../solana/base58';
import { startSolanaDiscovery, useSolanaWallet } from '../solana/wallet';
import { toast } from './common/toasts';

const REF = 'gully-bridge:ref';
const GULLY_ID = gullyIdConfig(import.meta.env);

export interface UrlOptions {
  ref?: Address;
  embed: boolean;
  direction?: Direction;
  route?: RouteKind;
  amount?: string;
  /** ?chain=<registry name>: the chain on the other side of GullyChain (sepolia, basesepolia, bsctestnet, solanadevnet) */
  chain?: ChainKey;
  /** ?token=USDC: preselect a token by symbol */
  token?: string;
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
    embed: q.has('embed') || (typeof location !== 'undefined' && /\/embed\/?$/.test(location.pathname)),
    direction: d === 'withdraw' || d === 'deposit' ? d : undefined,
    route: r === 'fast' || r === 'canonical' ? r : undefined,
    amount: q.get('amount') || undefined,
    chain: REMOTE_CHAINS.find((c) => c === q.get('chain')),
    token: q.get('token')?.toUpperCase() || undefined,
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
  const [heads, setHeads] = useState<Record<'arbitrumsepolia' | 'gullychaintestnet', { block?: bigint; history: number[]; ok: boolean }>>({
    arbitrumsepolia: { history: [], ok: true },
    gullychaintestnet: { history: [], ok: true },
  });
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const res = await Promise.all(
        (['arbitrumsepolia', 'gullychaintestnet'] as const).map((c) =>
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
  const sol = useSolanaWallet();
  const { session: gullySession } = useGullySession(GULLY_ID);
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
  const [remote, setRemoteState] = useState<ChainKey>(url.chain || PARENT);
  // ?token=USDC preselects a token by symbol; ?token=0x… is a mirror deep link (handled above)
  const [tokenId, setTokenId] = useState<string | undefined>(() => {
    if (!url.token || url.mirror || linked) return undefined;
    return tokenOptions(url.chain || PARENT, url.direction || 'deposit').find(
      (o) => o.send.symbol.toUpperCase() === url.token || o.receive.symbol.toUpperCase() === url.token,
    )?.id;
  });
  const [amountText, setAmountText] = useState(url.amount || '');
  const [recipientText, setRecipientText] = useState('');
  const [manualKind, setManualKind] = useState<RouteKind | undefined>(url.route);
  const [fastRouteId, setFastRouteId] = useState(linked?.id || DEFAULT_FAST_ROUTE_ID);
  const [balances, setBalances] = useState<Balances>({});
  const [laneBal, setLaneBal] = useState<bigint | undefined>();
  const [quotes, setQuotes] = useState<Partial<Record<RouteKind, Quote>>>({});
  const [quoteError, setQuoteError] = useState<string>();
  const [quoting, setQuoting] = useState(false);
  const [steps, setSteps] = useState<StepState>({});
  const [busy, setBusy] = useState(false);
  const [transfers, setTransfers] = useState<TransferRecord[]>(loadTransfers);
  const [activeId, setActiveId] = useState<string>();
  const [drop, setDrop] = useState<GasDropState | undefined>();

  // the token picker: classic native ETH (Arbitrum Sepolia) plus the multi-chain routes of the chosen chain
  const options = useMemo(() => tokenOptions(remote, direction), [remote, direction]);
  const option = pickOption(options, tokenId);
  const multichain = option?.source === 'multichain';
  // deposits always go through the default (native ETH) route; a retired route (gETH, hypETH) is only used to redeem
  const route = routeFor(direction, fastRouteId);
  const routeId = multichain ? option!.id : route.id;
  const { from, to } = endsOf(remote, direction);
  const sendDecimals = multichain ? option!.send.decimals : 18;
  const receiveDecimals = multichain ? option!.receive.decimals : 18;
  const amount = parseAmount(amountText, sendDecimals);
  /** the selected Gully Warp Mirror (classic pair only); undefined on the ETH and multi-chain routes */
  const mirror = multichain ? undefined : route.warp;
  // Cheapest (the canonical Arbitrum bridge) only exists for ETH with Arbitrum Sepolia; a mirror moves over its warp route
  const canonicalAvailable = option?.source === 'classic' && option.canonical && !mirror;

  // wallets: the origin chain decides which one signs; the destination decides the recipient format
  const originIsSolana = !isEvm(from);
  const destIsSolana = !isEvm(to);
  const senderAddr = originIsSolana ? sol.address : wallet.address;
  const needsRecipient = originIsSolana !== destIsSolana;
  const defaultRecipient = destIsSolana ? sol.address : originIsSolana ? wallet.address : wallet.address;
  const recipient = (recipientText.trim() || defaultRecipient || '').trim();
  const recipientValid = destIsSolana ? isSolanaAddress(recipient) : isAddress(recipient);
  useEffect(() => {
    if (!isEvm(remote)) startSolanaDiscovery();
  }, [remote]);

  // balances of the classic lanes
  useEffect(() => {
    if (!wallet.address) {
      setBalances({});
      return;
    }
    let stop = false;
    const tick = () =>
      getBridgeClient()
        .balances(wallet.address!, route.id)
        .then((b) => !stop && setBalances(b))
        .catch(() => undefined);
    tick();
    const id = setInterval(tick, 12000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [wallet.address, route.id]);

  // balance of what a multi-chain lane sends
  const sendToken = option?.send;
  useEffect(() => {
    setLaneBal(undefined);
    const c = getBridgeClient();
    if (!multichain || !sendToken || !senderAddr || !c.laneBalance) return;
    let stop = false;
    const tick = () =>
      c.laneBalance!(sendToken, senderAddr)
        .then((b) => !stop && setLaneBal(b))
        .catch(() => undefined);
    tick();
    const id = setInterval(tick, 12000);
    return () => {
      stop = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multichain, routeId, sendToken?.chain, senderAddr]);

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
  const kind: RouteKind = canonicalAvailable ? manualKind || pick.kind : 'fast';

  // quotes (both lanes on the classic pair, Fast only elsewhere), debounced
  const quoteRecipient = recipientValid ? recipient : undefined;
  useEffect(() => {
    let stop = false;
    if (!option) {
      setQuotes({});
      setQuoting(false);
      return;
    }
    // preview quote at 0.001 of the token when empty
    const amt = amount && amount > 0n ? amount : 10n ** BigInt(Math.max(0, sendDecimals - 3));
    setQuoting(true);
    const t = setTimeout(async () => {
      const c = getBridgeClient();
      const req = { direction, amount: amt, sender: senderAddr, recipient: quoteRecipient, ref: url.ref, fastRouteId: routeId, remote };
      const [f, k] = await Promise.allSettled([
        c.quote({ ...req, kind: 'fast' }),
        canonicalAvailable ? c.quote({ ...req, kind: 'canonical' }) : Promise.reject(new Error('no canonical lane')),
      ]);
      if (stop) return;
      setQuotes({
        fast: f.status === 'fulfilled' ? f.value : undefined,
        canonical: k.status === 'fulfilled' ? k.value : undefined,
      });
      setQuoteError(
        f.status === 'rejected' && (k.status === 'rejected' || !canonicalAvailable)
          ? 'Could not reach the chains for a quote. Check your connection and try again.'
          : undefined,
      );
      setQuoting(false);
    }, 250);
    return () => {
      stop = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, amount, senderAddr, quoteRecipient, url.ref, routeId, remote, canonicalAvailable, !!option]);

  const quote = quotes[kind];

  // gas on arrival: GullyGasDrop for a first non-ETH deposit; Gully ID passkey smart accounts use the paymaster
  const gullyIdSmart = gullySession?.user.wallets?.some(
    (w) => w.kind === 'kernel-v3.3' && w.address.toLowerCase() === recipient.toLowerCase(),
  );
  const dropCandidate = !!option && option.live && gasDropEnabled() && dropApplies(option) && isAddress(recipient);
  useEffect(() => {
    setDrop(undefined);
    if (!dropCandidate || gullyIdSmart) return;
    let stop = false;
    readGasDrop(recipient as Address)
      .then((d) => !stop && setDrop(d))
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [dropCandidate, gullyIdSmart, recipient]);
  const gasInfo: { kind: 'drop' | 'paymaster' | 'empty'; amount?: bigint } | undefined = !dropCandidate
    ? undefined
    : gullyIdSmart
      ? { kind: 'paymaster' }
      : drop && dropEligible(drop)
        ? { kind: 'drop', amount: drop.dropAmount }
        : drop && !drop.dropped
          ? { kind: 'empty' }
          : undefined;

  // tracking of open transfers (and of an expected gas drop for a while after delivery)
  useEffect(() => saveTransfers(transfers), [transfers]);
  useEffect(() => {
    const watchDrop = (t: TransferRecord) => t.gasDrop === 'expected' && Date.now() - t.createdAt < 30 * 60_000;
    const open = transfers.filter((t) => isOpen(t) || watchDrop(t));
    if (!open.length) return;
    const id = setInterval(async () => {
      for (const t of open) {
        try {
          let n = isOpen(t) ? await getBridgeClient().track(t) : t;
          if (n.status === 'delivered' && watchDrop(n) && isAddress(n.recipient)) {
            const d = await readGasDrop(n.recipient as Address).catch(() => undefined);
            if (d?.dropped) n = { ...n, gasDrop: 'received', updatedAt: Date.now() };
          }
          if (n.status !== t.status || n.gasDrop !== t.gasDrop || n.messageId !== t.messageId || n.destTx !== t.destTx) {
            setTransfers((all) => all.map((x) => (x.id === n.id ? n : x)));
            if (n.status === 'delivered' && t.status !== 'delivered')
              toast({ kind: 'success', title: 'Delivered', body: `${n.receiveSymbol} arrived on ${CHAINS[n.to].name}` });
            if (n.status === 'claimable' && t.status !== 'claimable')
              toast({ kind: 'info', title: 'Ready to claim', body: 'Your withdrawal passed the challenge period' });
            if (n.gasDrop === 'received' && t.gasDrop !== 'received')
              toast({ kind: 'success', title: 'Gas drop received', body: 'A little ETH for fees is in your GullyChain wallet' });
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

  const balanceFrom: bigint | undefined = multichain
    ? laneBal
    : direction === 'deposit'
      ? mirror
        ? balances.mirrorToken
        : balances.parentEth
      : kind === 'fast'
        ? balances.fastToken
        : balances.childEth;

  let blocker: string | undefined;
  if (!option) blocker = 'No route to this chain yet';
  else if (!option.live) blocker = 'Coming soon';
  else if (amount && amount > 0n && needsRecipient && !recipientValid)
    blocker = destIsSolana ? 'Enter a Solana address' : 'Enter a GullyChain address';
  else if (!multichain)
    blocker = sendBlocker({
      amount,
      quote,
      quoting,
      wallet: wallet.address,
      balanceFrom,
      paysValueFromBalance: direction === 'deposit' || (kind === 'fast' && route.tokens[CHILD].tokenType === 'native'),
    });
  else {
    blocker = sendBlocker({
      amount,
      quote,
      quoting,
      wallet: senderAddr,
      balanceFrom,
      paysValueFromBalance: option.send.tokenType === 'native',
    });
    if (blocker === 'Insufficient balance') blocker = 'Not enough for the amount plus fees';
  }

  const send = useCallback(async () => {
    if (!quote || !amount) return;
    setBusy(true);
    setSteps({});
    try {
      const q = { ...quote, req: { ...quote.req, amount, sender: senderAddr, recipient: recipient || senderAddr, ref: url.ref } };
      let rec = await getBridgeClient().execute(q, onStep);
      if (gasInfo?.kind === 'drop' && rec.status !== 'failed') rec = { ...rec, gasDrop: 'expected' };
      setTransfers((all) => [rec, ...all.filter((t) => t.id !== rec.id)]);
      setActiveId(rec.id);
      if (rec.status === 'failed') toast({ kind: 'error', title: 'Transaction failed', body: rec.error || 'Reverted' });
      else {
        track('bridge', { lane: quote.req.kind });
        toast({ kind: 'success', title: 'Sent', body: `${quote.req.kind === 'fast' ? 'Fast' : 'Cheapest'} transfer submitted` });
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
  }, [quote, amount, senderAddr, recipient, url.ref, onStep, gasInfo?.kind]);

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

  const setRemote = (c: ChainKey) => {
    // keep the same token when the new chain has it
    const sym = option?.send.symbol;
    const next = tokenOptions(c, direction);
    setRemoteState(c);
    setTokenId(next.find((o) => o.live && o.send.symbol === sym)?.id || next.find((o) => o.send.symbol === sym)?.id);
    setFastRouteId(DEFAULT_FAST_ROUTE_ID);
    setManualKind(undefined);
    setRecipientText('');
    setSteps({});
  };

  return {
    url,
    wallet,
    sol,
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
      setRecipientText('');
      setSteps({});
    },
    remote,
    setRemote,
    options,
    option,
    setTokenId: (id: string) => {
      setTokenId(id);
      // a multi-chain token leaves any mirror route; the classic ETH option is the default route
      setFastRouteId(DEFAULT_FAST_ROUTE_ID);
      setAmountText('');
      setSteps({});
    },
    multichain,
    canonicalAvailable,
    from,
    to,
    sendDecimals,
    receiveDecimals,
    amountText,
    setAmountText,
    amount,
    recipientText,
    setRecipientText,
    recipient,
    recipientValid,
    needsRecipient,
    originIsSolana,
    destIsSolana,
    senderAddr,
    gasInfo,
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
      // mirrors run on the classic pair: back to its chain and its ETH option
      setRemoteState(PARENT);
      setTokenId(undefined);
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
      setRemoteState(PARENT);
      setTokenId(undefined);
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
