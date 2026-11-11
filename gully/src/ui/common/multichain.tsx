// Multi-chain parts of the bridge card: chain picker (official chain logos), token picker, Fast / Cheapest copy,
// recipient field for Solana <-> EVM, gas-on-arrival note, Solana wallet modal and the per-transfer status links.
// Beginner copy on the main path; "Hyperlane" only inside Details.
import { useEffect, useState } from 'react';

import { CHAINS, hyperlaneMessageUrl, LINKS, txUrl, type ChainKey } from '../../config/chains';
import { short } from '../../bridge/format';
import { arrivingSymbol } from '../../bridge/gasDrop';
import { chainStatus, pickerChains } from '../../bridge/lanes';
import { cheapestUnavailable, laneCopy } from '../../bridge/laneCopy';
import type { TransferRecord } from '../../bridge/types';
import { connectSolana, disconnectSolana, startSolanaDiscovery, useSolanaWallet, type SolWalletInfo } from '../../solana/wallet';
import type { BridgeState } from '../useBridge';
import { Icon } from './icons';
import { TokenAmount } from './money';
import { ChainMark, Ext } from './parts';

/** The non-Gully side of the card: a button that opens the chain list. */
export function ChainPicker({ b, label }: { b: BridgeState; label: 'From' | 'To' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="chain-btn" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${label} ${CHAINS[b.remote].name}. Change chain`}>
        <ChainMark chain={b.remote} size={22} />
        <span>
          {label} {CHAINS[b.remote].name}
        </span>
        <Icon name="chevron" size={14} className="chain-btn-chev" />
      </button>
      {open && <ChainModal b={b} onClose={() => setOpen(false)} />}
    </>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
}

function ChainModal({ b, onClose }: { b: BridgeState; onClose: () => void }) {
  useEscape(onClose);
  const chains = pickerChains();
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cm-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id="cm-title">{b.direction === 'deposit' ? 'Bridge from' : 'Bridge to'}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        <ul className="wallet-list chain-list">
          {chains.map((c) => {
            const st = chainStatus(c);
            return (
              <li key={c}>
                <button
                  onClick={() => {
                    b.setRemote(c);
                    onClose();
                  }}
                  aria-current={c === b.remote ? 'true' : undefined}
                  className={c === b.remote ? 'chain-on' : ''}
                >
                  <ChainMark chain={c} size={28} />
                  <span>{CHAINS[c].name}</span>
                  {st === 'soon' ? <em className="soon-tag">Coming soon</em> : c === b.remote ? <Icon name="check" size={16} /> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="fine">Every chain connects to GullyChain Testnet. Testnet tokens have no real value.</p>
      </div>
    </div>
  );
}

/** Tokens the chosen chain can send; planned ones are visible but cannot be picked ("Coming soon"). */
export function TokenPicker({ b }: { b: BridgeState }) {
  if (b.options.length < 2 && b.option?.live) return null;
  return (
    <div className="tokens" role="radiogroup" aria-label="Token">
      {b.options.map((o) => {
        const on = o.id === b.option?.id;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={on}
            aria-disabled={!o.live}
            disabled={!o.live && !on}
            className={`tok ${on ? 'tok-on' : ''} ${o.live ? '' : 'tok-soon'}`}
            onClick={() => o.live && b.setTokenId(o.id)}
            title={o.live ? `${o.send.symbol} → ${o.receive.symbol}` : 'Coming soon'}
          >
            {o.send.symbol}
            {!o.live && <small>soon</small>}
          </button>
        );
      })}
    </div>
  );
}

/** Fast / Cheapest, with time and fee in plain words. */
export function LaneChoice({ b }: { b: BridgeState }) {
  const remoteName = CHAINS[b.remote].name;
  const copy = laneCopy({ kind: b.kind, direction: b.direction, remoteName, withdrawSeconds: b.quotes.canonical?.etaSeconds });
  return (
    <div className="lane-choice">
      <div className="lane" role="radiogroup" aria-label="Speed">
        {(['fast', 'canonical'] as const).map((k) => {
          const disabled = k === 'canonical' && !b.canonicalAvailable;
          return (
            <button
              key={k}
              role="radio"
              aria-checked={b.kind === k}
              disabled={disabled}
              className={`lane-b ${b.kind === k ? 'lane-on' : ''}`}
              onClick={() => b.setKind(k === b.pick.kind ? undefined : k)}
            >
              <Icon name={k === 'fast' ? 'zap' : 'shield'} size={16} />
              {k === 'fast' ? 'Fast' : 'Cheapest'}
              {b.canonicalAvailable && b.pick.kind === k && <i className="lane-best" title={b.pick.reason} />}
            </button>
          );
        })}
      </div>
      <p className="lane-copy">{copy.line}</p>
      {!b.canonicalAvailable && b.option && (
        <p className="lane-copy muted">{cheapestUnavailable(remoteName, b.option.send.symbol, b.remote === 'arbitrumsepolia')}</p>
      )}
    </div>
  );
}

/** Solana <-> EVM: where the tokens arrive (prefilled with the connected wallet of that side). */
export function RecipientField({ b }: { b: BridgeState }) {
  const sol = useSolanaWallet();
  const [open, setOpen] = useState(false);
  if (!b.needsRecipient) return null;
  const toName = CHAINS[b.to].name;
  return (
    <div className="recipient">
      <label htmlFor="recipient">Receive on {toName}</label>
      <input
        id="recipient"
        autoComplete="off"
        spellCheck={false}
        placeholder={b.destIsSolana ? 'Solana address' : '0x… GullyChain address'}
        value={b.recipientText}
        onChange={(e) => b.setRecipientText(e.target.value.trim())}
        aria-invalid={b.recipient !== '' && !b.recipientValid}
      />
      <small className="muted">
        {b.recipientText
          ? b.recipientValid
            ? 'Address looks right.'
            : b.destIsSolana
              ? 'That is not a Solana address.'
              : 'That is not a GullyChain (0x…) address.'
          : b.recipient
            ? `Your connected wallet ${short(b.recipient)}`
            : b.destIsSolana
              ? 'Paste a Solana address, or connect a Solana wallet.'
              : 'Paste your GullyChain address, or connect your EVM wallet.'}
        {b.destIsSolana && !sol.address && (
          <>
            {' '}
            <button className="link-btn" onClick={() => setOpen(true)}>
              Connect Solana wallet
            </button>
          </>
        )}
      </small>
      {open && <SolanaWalletModal onClose={() => setOpen(false)} />}
    </div>
  );
}

/** Gas on arrival (GullyGasDrop) or the Gully ID paymaster: shown before sending. */
export function GasDropNote({ b }: { b: BridgeState }) {
  const g = b.gasInfo;
  if (!g || !b.option) return null;
  const sym = arrivingSymbol(b);
  return (
    <p className="note gas-note" role="status">
      <Icon name="droplet" size={16} />
      <span>
        {g.kind === 'drop' && (
          <>
            First bridge to GullyChain? You also get <TokenAmount v={g.amount ?? 0n} symbol="ETH" inline /> for gas, so you can use
            your {sym} right away.
          </>
        )}
        {g.kind === 'paymaster' && 'Your Gully ID passkey account needs no gas: the Gully paymaster pays its fees, so no ETH drop is sent.'}
        {g.kind === 'empty' && (
          <>
            Today&apos;s free gas drops are used up. You need a little ETH on GullyChain to move your {sym}
            {LINKS.faucet ? (
              <>
                :{' '}
                <Ext href={LINKS.faucet} newTab>
                  faucet
                </Ext>
              </>
            ) : null}
            .
          </>
        )}
      </span>
    </p>
  );
}

export function SolanaWalletModal({ onClose }: { onClose: () => void }) {
  const w = useSolanaWallet();
  useEscape(onClose);
  useEffect(() => startSolanaDiscovery(), []);
  const pick = async (x: SolWalletInfo) => {
    try {
      await connectSolana(x);
      onClose();
    } catch {
      /* error shown from store */
    }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="sw-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id="sw-title">Connect a Solana wallet</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        {w.wallets.length ? (
          <ul className="wallet-list">
            {w.wallets.map((x) => (
              <li key={x.name}>
                <button onClick={() => pick(x)} disabled={w.connecting}>
                  {x.icon ? <img src={x.icon} width={28} height={28} alt="" /> : <Icon name="wallet" size={28} />}
                  <span>{x.name}</span>
                  <Icon name="arrowRight" className="btn-arrow" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <Icon name="wallet" size={28} />
            <p>No Solana wallet found. Install Phantom or Solflare, switch it to Devnet, then reload.</p>
          </div>
        )}
        {w.error && <p className="err">{w.error}</p>}
        <p className="fine">Use Solana Devnet in your wallet settings. Devnet SOL is free from the Solana faucet.</p>
      </div>
    </div>
  );
}

/** Connected Solana wallet pill (shown next to the EVM wallet while a Solana route is open). */
export function SolanaWalletPill() {
  const w = useSolanaWallet();
  if (!w.address) return null;
  return (
    <button className="wallet-pill" onClick={() => disconnectSolana()} title="Disconnect Solana wallet">
      <ChainMark chain="solanadevnet" size={16} />
      {short(w.address, 4)}
    </button>
  );
}

/** Message id and links of one transfer: origin tx, delivery tx and, under Details, Hyperlane's explorer. */
export function TransferLinks({ t }: { t: TransferRecord }) {
  return (
    <div className="tx-links">
      <Ext href={txUrl(t.from, t.originTx)} newTab>
        Sent on {CHAINS[t.from].short} <Icon name="external" size={12} />
      </Ext>
      {t.destTx && (
        <Ext href={txUrl(t.to, t.destTx)} newTab>
          Delivered on {CHAINS[t.to].short} <Icon name="external" size={12} />
        </Ext>
      )}
      {t.gasDrop && (
        <span className={`gas-chip ${t.gasDrop === 'received' ? 'ok' : ''}`}>
          <Icon name="droplet" size={12} /> {t.gasDrop === 'received' ? 'Gas drop received' : 'Gas drop on the way'}
        </span>
      )}
      {t.messageId && (
        <details className="tx-details">
          <summary>Details</summary>
          <p>
            Message id <code className="mono">{short(t.messageId, 8)}</code>. Secured by Hyperlane: Gully validators sign the message, then
            it is delivered on {CHAINS[t.to].name}.{' '}
            <Ext href={hyperlaneMessageUrl(t.messageId)} newTab>
              Track on Hyperlane Explorer <Icon name="external" size={12} />
            </Ext>
          </p>
        </details>
      )}
    </div>
  );
}

export function chainLabel(c: ChainKey) {
  return CHAINS[c].name;
}
