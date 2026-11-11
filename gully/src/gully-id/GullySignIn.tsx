// "Sign in with Gully ID" for the bridge: the official button, drawn by the Gully ID SDK (renderButton, brand kit v1,
// dark on the night header). On by default; VITE_GULLY_ID_SIGNIN=off hides it. place="header" sits next to Connect on
// wide screens, place="menu" in the mobile menu (with the passkey option) so the label is never clipped.
// Identity only: it shows who you are and, when the profile has one, your Gully wallet address. It never connects
// that wallet; transfers use the Connect button as before.
import { useEffect, useRef } from 'react';

import { short } from '../bridge/format';
import { gullyIdConfig, markGullyId, profileWallet, walletKindLabel, type GullyIdConfig } from './gullyId';
import { useGullySession } from './useGullySession';
import './gully-id.css';

const CONFIG = gullyIdConfig(import.meta.env);

type Place = 'header' | 'menu';

export function GullySignIn({ place = 'header', config = CONFIG }: { place?: Place; config?: GullyIdConfig | null }) {
  useEffect(() => markGullyId(config), [config]);
  if (!config) return null;
  return <GullySignInInner place={place} config={config} />;
}

function GullySignInInner({ place, config }: { place: Place; config: GullyIdConfig }) {
  const { client, session } = useGullySession(config);
  const el = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!client || !el.current) return;
    try {
      return client.renderButton(el.current, {
        theme: 'dark',
        size: 's',
        passkey: place === 'menu',
        onError: (e) => console.warn('[gully-id] sign-in failed', e),
      });
    } catch (e) {
      console.warn('[gully-id] renderButton failed', e);
    }
  }, [client, place]);

  const w = profileWallet(session?.user);
  return (
    <span className={`gully-id gully-id-${place}`} hidden={!client}>
      {w && (
        <span className="gully-id-wallet mono" title={`Your Gully ID ${walletKindLabel(w.kind).toLowerCase()}: ${w.address}. Not connected; use Connect to bridge with any wallet.`}>
          {walletKindLabel(w.kind)} {short(w.address)}
        </span>
      )}
      <span className="gully-id-btn" ref={el} />
    </span>
  );
}
