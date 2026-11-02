// Money on the bridge: USD first (compact, "$50K"), the ETH amount as the secondary line. Every amount the bridge
// moves is ETH-backed (ETH, gETH, hypETH), so one ETH/USD price covers them. With no price, ETH only.
import { asEth, ethN, fmtUsd, toUsd, useEthUsd, usdTitle, USD_NOTE } from '../../bridge/usd';
import { IS_TESTNET } from '../../config/network';

/**
 * - stack (lists, cards): "$12.40" over "0.0034 ETH".
 * - inline (tape, quote rows): "$12.40 · 0.0034 ETH".
 */
export function Money({ v, symbol = 'ETH', inline = false, className = '' }: { v: bigint | number; symbol?: string; inline?: boolean; className?: string }) {
  const p = useEthUsd();
  const e = asEth(v);
  const usd = toUsd(e, p);
  if (usd === null)
    return (
      <span className={`money ${className}`.trim()}>
        <b className="num">
          {ethN(e)} {symbol}
        </b>
      </span>
    );
  return (
    <span className={`money ${inline ? 'money-in' : ''} ${className}`.trim()} title={usdTitle(p)}>
      <b className="num">{fmtUsd(usd)}</b>
      <small className="money-eth">
        {inline ? '· ' : ''}
        {ethN(e)} {symbol}
      </small>
    </span>
  );
}

/** "≈ $12.40" under an amount the user types or receives; nothing while there is no price or no amount. */
export function UsdLine({ v, className = '' }: { v?: bigint | number | null; className?: string }) {
  const p = useEthUsd();
  if (v === undefined || v === null) return null;
  const usd = toUsd(asEth(v), p);
  if (usd === null) return null;
  return (
    <span className={`usd-line ${className}`.trim()} title={usdTitle(p)}>
      ≈ {fmtUsd(usd)}
    </span>
  );
}

/** The required note, shown once near the amounts. */
export function UsdNote() {
  const p = useEthUsd();
  return (
    <p className="usd-note" role="note" title={usdTitle(p)}>
      {p ? `${USD_NOTE}.` : `Amounts show in ETH: no ETH/USD price right now.${IS_TESTNET ? ' Testnet tokens have no real value.' : ''}`}
    </p>
  );
}
