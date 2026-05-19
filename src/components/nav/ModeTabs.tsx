import { useRouter } from 'next/router';

export type AppMode = 'bridge' | 'swap';

interface Props {
  mode: AppMode;
}

// Segmented two-button tab strip above the card. Drives URL state
// (/bridge ↔ /swap) via router.push so deep links and back/forward work.
// / and /bridge both render the bridge tab; only /swap selects swap.
export function ModeTabs({ mode }: Props) {
  const router = useRouter();

  const go = (next: AppMode) => {
    if (next === mode) return;
    const path = next === 'swap' ? '/swap' : '/bridge';
    router.push(path, undefined, { shallow: true });
  };

  return (
    <div className="mode-tabs mb-3 inline-flex w-fit rounded-full border border-gray-300 bg-white p-1 shadow-sm dark:border-primary-300/35 dark:bg-background/65">
      <TabButton label="Bridge" active={mode === 'bridge'} onClick={() => go('bridge')} />
      <TabButton label="Swap" active={mode === 'swap'} onClick={() => go('swap')} />
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mode-tab rounded-full px-4 py-1 font-secondary text-sm transition-colors ${
        active
          ? 'bg-accent-500 text-white shadow-sm'
          : 'text-gray-600 hover:bg-gray-100 dark:text-foreground-secondary dark:hover:bg-primary-300/[0.12]'
      }`}
      data-active={active}
    >
      {label}
    </button>
  );
}
