import { ErrorIcon, WarningIcon } from '@hyperlane-xyz/widgets';
import clsx from 'clsx';

import { InfoCircleIcon } from '../../../components/icons/InfoCircleIcon';
import type { RouteNotice } from '../../api/types';

const severityClasses: Record<RouteNotice['severity'], string> = {
  error: 'bg-red-400 text-white dark:bg-red-500',
  warning: 'bg-orange-400 text-gray-950 dark:bg-orange-500',
  info: 'bg-blue-500 text-white dark:bg-blue-600',
};

function NoticeIcon({ severity, size }: { severity: RouteNotice['severity']; size: number }) {
  const props = { 'aria-hidden': true, color: 'currentColor', height: size, width: size };
  if (severity === 'error') return <ErrorIcon {...props} />;
  if (severity === 'warning') return <WarningIcon {...props} />;
  return <InfoCircleIcon {...props} />;
}

export function RouteNotices({
  notices,
  compact = false,
}: {
  notices: RouteNotice[] | undefined;
  compact?: boolean;
}) {
  if (!notices?.length) return null;

  return (
    <div className="space-y-1.5" aria-live="polite">
      {notices.map((notice, index) => (
        <div
          key={`${notice.severity}-${notice.message}-${index}`}
          role={notice.blocksTransfer ? 'alert' : 'status'}
          data-testid={`route-notice-${notice.severity}`}
          className={clsx(
            'flex items-start gap-2 rounded font-secondary leading-snug shadow-card',
            compact ? 'px-2 py-1.5 text-xxs' : 'px-4 py-2 text-sm',
            severityClasses[notice.severity],
          )}
        >
          <span className="mt-px shrink-0">
            <NoticeIcon severity={notice.severity} size={compact ? 14 : 18} />
          </span>
          <span>{notice.message}</span>
        </div>
      ))}
    </div>
  );
}
