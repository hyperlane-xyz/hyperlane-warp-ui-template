import clsx from 'clsx';

import type { RouteNotice } from '../../api/types';

const severityClasses: Record<RouteNotice['severity'], string> = {
  error:
    'border-red-300 bg-red-50 text-red-800 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200',
  warning:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100',
  info: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-200',
};

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
            'rounded border font-secondary',
            compact ? 'px-2 py-1 text-xxs' : 'px-3 py-2 text-sm',
            severityClasses[notice.severity],
          )}
        >
          {notice.message}
        </div>
      ))}
    </div>
  );
}
