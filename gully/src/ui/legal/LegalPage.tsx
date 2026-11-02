// /terms and /privacy for the Gully Bridge (Caddy serves index.html for every path; main.tsx renders this page there).
// The text reuses the Gully Labs Terms of Service and Privacy policy (gully-labs/website src/pages/legal/Terms.tsx and
// Privacy.tsx, versions 2026-10-20), cut down to what the bridge is and adapted to it. It adds no new legal promise.
// Every statement about what the bridge stores or sends was checked against this code on 2026-11-02: useBridge.ts
// (localStorage gully-bridge:transfers, sessionStorage ref), bridge/wallet.ts (last wallet used), analytics/umami.ts +
// index.html (cookieless Umami, Do Not Track, no address or email in events), bridge/usd.ts (price sources),
// config/rpc.ts (RPC lists), gully-id (optional Sign in with Gully ID). Change this page when one of those changes.
// DRAFT: not reviewed by counsel. GOVERNING_LAW stays null until the owner names a jurisdiction (never guess one).
import type { ReactNode } from 'react';

import { CANONICAL, CHAINS, IS_TESTNET, LINKS, PARENT } from '../../config/chains';
import { capLines } from '../../bridge/caps';
import { CAPS } from '../../config/network';
import { Footer } from '../common/parts';
import { Header } from '../common/shell';

export const LEGAL_VERSION = '2026-11-02';
export const DRAFT_LABEL = 'Draft – pending legal review';
export const GOVERNING_LAW: string | null = null;
export type LegalKind = 'terms' | 'privacy';

const GL_TERMS = 'https://gullylabs.xyz/legal/terms';
const GL_PRIVACY = 'https://gullylabs.xyz/legal/privacy';
const MAIL = 'team@gullylabs.xyz';

/** /terms -> 'terms', /privacy -> 'privacy' (trailing slash and index.html allowed), anything else null. */
export function legalKindOf(pathname: string): LegalKind | null {
  const p = pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '').toLowerCase();
  return p === '/terms' ? 'terms' : p === '/privacy' ? 'privacy' : null;
}

function S({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section id={`s${n}`} aria-labelledby={`s${n}-h`} className="legal-s">
      <h2 id={`s${n}-h`}>
        <span className="legal-n">{n}.</span> {title}
      </h2>
      {children}
    </section>
  );
}

const Mail = () => <a href={`mailto:${MAIL}`}>{MAIL}</a>;
const ExtA = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

function challengeDays() {
  const s = Number(CANONICAL.confirmPeriodBlocks) * CANONICAL.l1BlockSeconds;
  return s >= 86400 ? `about ${Math.round(s / 86400)} days` : `about ${Math.max(1, Math.round(s / 60))} minutes`;
}

function Terms() {
  const parent = CHAINS[PARENT].name;
  const child = CHAINS.gullychaintestnet.name;
  const caps = capLines(CAPS);
  return (
    <>
      <S n={1} title="These terms">
        <p>
          These terms are an agreement between Gully Labs (“<b>Gully Labs</b>”, “<b>we</b>”, “<b>us</b>”) and you, the person or
          business using the Gully Bridge. By using it or connecting a wallet to it, you accept these terms. If you don’t accept
          them, please don’t use the bridge.
        </p>
        <p>
          The <ExtA href={GL_TERMS}>Gully Labs Terms of Service</ExtA> cover our other services. How the bridge handles personal
          data is in its <a href={LINKS.privacy}>privacy policy</a>. If you use the bridge for a company, you accept these terms
          for it and confirm you may do so; “you” then means the company too.
        </p>
      </S>
      <S n={2} title="The bridge">
        <p>
          The Gully Bridge is a web page (and an embeddable widget) that helps you move ETH between {parent} and {child}. It
          builds transactions for two lanes, and your wallet signs and sends them:
        </p>
        <ul>
          <li>
            the <b>Fast lane</b>, through Hyperlane warp route contracts: a message is signed by validators and delivered by a
            relayer, and the destination contract pays out what it holds;
          </li>
          <li>
            the <b>Canonical lane</b>, through the Arbitrum Nitro rollup bridge contracts: deposits arrive after the chain reads
            them; withdrawals wait for the rollup’s challenge period ({challengeDays()} on this network) and then need a claim
            transaction that you sign.
          </li>
        </ul>
        <p>
          Some services are marked beta or testnet. They may change, break, lose data or stop without notice. We may add, change
          or end any part of the bridge.
        </p>
        {caps.length > 0 && (
          <p>
            <b>Phase 1 limits.</b> During the guarded launch the bridge shows and applies these limits, and does not offer a
            transfer above them: {caps.join('; ')}.
          </p>
        )}
      </S>
      <S n={3} title="Eligibility and sanctions">
        <ul>
          <li>You must be at least 18 and able to enter into a binding contract.</li>
          <li>
            You may not use the services if you, or anyone you act for, are the target of sanctions (including the lists kept by
            the US Treasury’s OFAC, the UN, the EU and the UK), or are in a country or region under comprehensive sanctions, such
            as Cuba, Iran, North Korea, Syria and the occupied regions of Ukraine.
          </li>
          <li>You must not use a VPN or anything else to get around a restriction based on where you are.</li>
          <li>You are responsible for following the laws that apply to you, including tax law, when you use the services.</li>
        </ul>
      </S>
      <S n={4} title="Your wallet">
        <p>
          You connect your own wallet, and every transfer is a transaction your wallet signs and sends. We never receive,
          generate or store your private keys or seed phrase. If you lose access to your wallet, we cannot restore it. Never
          share a seed phrase with anyone, including anyone claiming to be us. Check the address, the amount and the chain in
          your wallet before you sign: transactions on a blockchain are final.
        </p>
        <p>Sign in with Gully ID is optional on the bridge and is covered by Gully ID’s own terms.</p>
      </S>
      <S n={5} title="Quotes, timings and third-party protocols">
        <p>
          Quotes, fees, liquidity and arrival times shown by the bridge are estimates read from the chains. Delivery can be late,
          for example when a chain, a validator or the relayer is slow or stopped, and a withdrawal on the Canonical lane cannot
          be claimed before its challenge period ends. Gully Labs is not your broker or exchange. Hyperlane and Arbitrum Nitro
          are third-party software under their own licences.
        </p>
      </S>
      <S n={6} title="Information, not advice">
        <p>
          The figures, charts and status the bridge shows are <b>information only</b>. They are not investment, financial, legal
          or tax advice. Data comes from blockchains, public nodes and price feeds; it can be late, incomplete or wrong, and a
          source can stop answering. Crypto assets are risky and can lose all their value.
        </p>
      </S>
      <S n={7} title="Testnet">
        <p>
          The testnet bridge (testnet-bridge.gullychain.xyz) moves test ETH between Arbitrum Sepolia and GullyChain Testnet.
          Testnet chains, tokens and balances have <b>no monetary value</b>, can be reset, paused or removed at any time, and
          must not be sold or promised as having value.
          {IS_TESTNET ? ' This page belongs to the testnet bridge.' : ''}
        </p>
      </S>
      <S n={8} title="Acceptable use">
        <p>You will not, and will not help anyone else to:</p>
        <ul>
          <li>
            use the services for anything illegal, for fraud, market manipulation, phishing or scams, or to launder money or hide
            where funds come from;
          </li>
          <li>
            break, probe, overload or get around the security, rate limits, quotas or access controls of the services
            (responsible disclosure to <Mail /> is welcome);
          </li>
          <li>run automated traffic that degrades the services for others;</li>
          <li>harass, threaten or impersonate anyone, including Gully Labs or its team;</li>
          <li>use our names, logos or badges in a way that suggests we endorse you when we don’t.</li>
        </ul>
      </S>
      <S n={9} title="Third-party services">
        <p>
          The bridge depends on, links to or lets you use things run by others: blockchains and their nodes, wallets, explorers,
          price feeds, Hyperlane, Arbitrum and Cloudflare. We don’t control them and are not responsible for them; their own
          terms and policies apply when you use them.
        </p>
      </S>
      <S n={10} title="Disclaimers">
        <p>
          The services are provided “as is” and “as available”. We don’t promise they will always be available, secure, timely,
          accurate or free of errors, or that any data is complete or correct. Blockchains can fork, congest, reorganise or fail;
          tokens can be frozen or changed by their issuers; smart contracts can have bugs.{' '}
          <b>
            To the maximum extent the law allows, we disclaim all warranties and conditions, express or implied, including
            merchantability, fitness for a particular purpose, title and non-infringement.
          </b>
        </p>
      </S>
      <S n={11} title="Limitation of liability">
        <p>
          <b>11.1 Cap.</b> To the maximum extent the law allows, Gully Labs’ total liability for all claims arising out of or
          relating to the services or these terms is limited to the greater of the amount you paid Gully Labs for the service
          concerned in the 12 months before the claim, and 100 US dollars.
        </p>
        <p>
          <b>11.2 Excluded damages.</b> We are not liable for lost profits, revenue, data, goodwill or trading opportunities, or
          for indirect, consequential, special, exemplary or punitive damages, even if told they were possible. We are not liable
          for losses from your trading or investment decisions, from transactions you sign, from funds sent to a wrong address,
          from a third-party protocol, token or chain, or from lost wallet keys.
        </p>
        <p>
          <b>11.3 Where the law says otherwise.</b> Nothing in these terms limits liability that the law does not allow to be
          limited, such as for fraud, or rights you have as a consumer that cannot be waived.
        </p>
      </S>
      <S n={12} title="Indemnity">
        <p>
          You will defend and indemnify Gully Labs against claims by others, and the resulting losses, costs and reasonable legal
          fees, arising from your breach of these terms, your misuse of the services, or your violation of law or of someone
          else’s rights.
        </p>
      </S>
      <S n={13} title="Suspension and termination">
        <p>
          You may stop using the services at any time. We may suspend or end your access, with or without notice, if you breach
          these terms, if your use puts the services or others at risk, or if the law or a sanctions rule requires it. Sections
          6 and 10 to 14 survive the end of these terms.
        </p>
      </S>
      <S n={14} title="Changes, law and contact">
        <p>
          <b>Changes.</b> We may update these terms. The version date at the top changes, and for a material change we say so on
          the site before it takes effect. Using the services after that accepts the new version.
        </p>
        <p>
          <b>Governing law.</b>{' '}
          {GOVERNING_LAW
            ? `These terms are governed by the laws of ${GOVERNING_LAW}, and its courts have exclusive jurisdiction, except where consumer law gives you the right to bring a claim where you live.`
            : 'These terms are governed by the laws of the place where Gully Labs is established, and its courts have exclusive jurisdiction, except where consumer law gives you the right to bring a claim where you live.'}
        </p>
        <p>
          <b>Whole agreement.</b> These terms, with the policies they name, are the whole agreement between us about the bridge.
          If a part is invalid, the rest stays in force; not enforcing a part is not a waiver of it.
        </p>
        <p>
          <b>Contact.</b> Questions, notices and requests: <Mail />.
        </p>
      </S>
    </>
  );
}

function Privacy() {
  return (
    <>
      <S n={1} title="Who we are">
        <p>
          Gully Labs (“<b>we</b>”, “<b>us</b>”) builds and runs the Gully Bridge. We collect as little as we can, we don’t sell
          it, and we don’t use it for advertising. This page covers the bridge only; the{' '}
          <ExtA href={GL_PRIVACY}>Gully Labs privacy policy</ExtA> covers our other services. Using the bridge is also governed by
          its <a href={LINKS.terms}>terms</a>.
        </p>
      </S>
      <S n={2} title="What the bridge collects">
        <p>
          The bridge has no accounts and no server of its own that stores your data: the page runs in your browser and reads the
          chains directly. You connect a wallet to send a transfer; we don’t ask for a name, an email or a password.
        </p>
      </S>
      <S n={3} title="Analytics">
        <p>
          The bridge loads our self-hosted, open-source Umami analytics (analytics.gullychain.xyz). It sets no cookies and
          honours your browser’s Do Not Track setting. It records page views and, when you send a transfer, which lane you used.
          The bridge never sends it a wallet address or an email.
        </p>
      </S>
      <S n={4} title="Public chains">
        <p>
          Transfers happen on public blockchains. A transaction, the addresses in it and the amount are public and permanent, and
          nobody (us included) can change or delete them.
        </p>
      </S>
      <S n={5} title="Who else sees data">
        <ul>
          <li>
            <b>Cloudflare</b> carries all traffic to our sites, so it sees your IP address and requests.
          </li>
          <li>
            <b>Blockchain node providers</b> (public RPC endpoints, including Gully RPC): the bridge reads transactions and
            balances through them, which can include your address. Your wallet talks to its own nodes.
          </li>
          <li>
            <b>Price sources</b>: the ETH/USD price is read from gullychain.xyz and RedStone; nothing about you is sent with it.
          </li>
          <li>
            <b>Wallets you choose to use</b>, and <b>Gully ID</b> if you sign in with it (gullyid.xyz, under its own policy).
          </li>
        </ul>
        <p>
          We may disclose data when the law requires it, to protect our users or services from fraud or abuse, or to a buyer if
          Gully Labs is sold, under this policy.
        </p>
      </S>
      <S n={6} title="Browser storage">
        <p>
          Your browser keeps, on your device only: your last 50 transfers on this bridge (so their status shows after a reload),
          which wallet you used last, and for the tab only, an integrator reference from the link you opened. Clearing the site’s
          data deletes them. No advertising or cross-site tracking cookies.
        </p>
      </S>
      <S n={7} title="Changes and contact">
        <p>
          When this page changes, the version date at the top changes. Questions or requests: <Mail />.
        </p>
      </S>
    </>
  );
}

export function LegalPage({ kind }: { kind: LegalKind }) {
  const title = kind === 'terms' ? 'Terms of Service' : 'Privacy policy';
  return (
    <div className="a c legal-page">
      <Header />
      <main>
        <article className="legal" aria-labelledby="legal-h">
          <p className="legal-draft" role="note" data-testid="legal-draft">
            {DRAFT_LABEL}
          </p>
          <span className="label">Gully Bridge · Legal</span>
          <h1 id="legal-h">{title}</h1>
          <p className="legal-ver">Version {LEGAL_VERSION}</p>
          {kind === 'terms' ? <Terms /> : <Privacy />}
          <p className="legal-other">
            <a href={kind === 'terms' ? LINKS.privacy : LINKS.terms}>{kind === 'terms' ? 'Privacy policy' : 'Terms of Service'}</a>
            {' · '}
            <a href="/">Back to the bridge</a>
          </p>
        </article>
      </main>
      <Footer />
    </div>
  );
}
