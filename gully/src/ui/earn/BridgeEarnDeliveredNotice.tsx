// After a Fast-lane delivery on Gully Chain: the one next step into Bridge & Earn, carrying the Hyperlane message id so
// kre8.fun can match the position to this delivery. Rendered only while the program is live. Imports nothing from
// ui/common/parts (parts renders this inside MyTransfers), so there is no import cycle.
import { EARN_WARNINGS, earnDeepLink } from '../../earn/copy';
import { useLpRewardsStats } from '../../earn/lpRewards';
import { Icon } from '../common/icons';

export const EARN_DELIVERED_TEXT = 'Delivered. Deposit this ETH into a Gully Core pool and earn a share of fees for 30 days.';

/** Wired to the live store. */
export function BridgeEarnDelivered({ messageId }: { messageId?: string }) {
  const { live } = useLpRewardsStats();
  return <BridgeEarnDeliveredNotice messageId={messageId} live={live} />;
}

export function BridgeEarnDeliveredNotice({ messageId, live }: { messageId?: string; live: boolean }) {
  if (!live) return null;
  return (
    <div className="earn-delivered" role="status" data-testid="bridge-earn-delivered">
      <p>
        <Icon name="sparkles" size={16} />
        <span>{EARN_DELIVERED_TEXT}</span>
      </p>
      {/* kre8.fun is outside the gullychain.xyz family: a new tab, the transfer list stays on screen */}
      <a href={earnDeepLink(messageId)} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" data-testid="bridge-earn-delivered-link">
        <Icon name="sparkles" />
        <span>Earn with it on kre8.fun</span>
        <Icon name="arrowRight" className="btn-arrow" />
      </a>
      <small className="muted">{EARN_WARNINGS[0]}</small>
    </div>
  );
}
