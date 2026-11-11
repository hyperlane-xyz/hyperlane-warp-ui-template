// Bridge & Earn: shared UI copy and links (SPEC-bridge-and-earn, "UI copy", 2026-10-30). Keep in step with kre8.fun
// and the docs page; no projected APY anywhere, only measured numbers labelled testnet.
import type { IconName } from '../ui/common/icons';

export const EARN_TITLE = 'Bridge & Earn';

export const EARN_ONE_LINER =
  "Bridge ETH to Gully Chain, deposit it into a Gully Core pool and earn a share of the platform's launch and trading fees for 30 days.";

export const EARN_LINKS = {
  /** kre8.fun DeFi, the place to deposit, enrol and claim (external to the gullychain.xyz family: opens a new tab) */
  app: 'https://kre8.fun/me/wallet/defi?earn=bridge',
  docs: 'https://docs.gullychain.xyz/bridge-and-earn/',
  help: 'https://kre8.fun/help/bridge-and-earn',
} as const;

/** kre8.fun deep link after a bridge: carries the Hyperlane message id so the position can be matched to the delivery. */
export function earnDeepLink(messageId?: string | null): string {
  const id = (messageId || '').trim();
  return /^0x[0-9a-fA-F]{64}$/.test(id) ? `${EARN_LINKS.app}&msg=${id.toLowerCase()}` : EARN_LINKS.app;
}

export const EARN_STEPS: { label: string; hint: string; icon: IconName }[] = [
  { label: 'Bridge', hint: 'Gully Bridge fast lane', icon: 'bridge' },
  { label: 'Deposit', hint: 'into an allowlisted pool', icon: 'layers' },
  { label: 'Enrol', hint: 'the position, one signature', icon: 'key' },
  { label: 'Claim', hint: 'any time until the claim deadline', icon: 'wallet' },
];

/** Plain-words warnings, same wording everywhere. */
export const EARN_WARNINGS = [
  'Liquidity positions can lose value when prices move (impermanent loss).',
  'A position out of its price range earns no trading fees.',
  'Removing any liquidity ends your participation; what you earned stays claimable.',
  'Rewards are a share of real fees: they vary with trading activity and can be zero.',
  'Testnet tokens have no value.',
] as const;

export const EARN_NOT_LIVE = 'Bridge & Earn is not live on testnet yet.';
