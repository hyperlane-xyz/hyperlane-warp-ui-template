import { useEngineBootstrap } from '../../features/swap/useEngineBootstrap';
import { UnifiedTokenCard } from '../../features/unified/UnifiedTokenCard';
import type { AppMode } from '../nav/ModeTabs';
import { TipCard } from '../tip/TipCard';

interface Props {
  mode: AppMode;
}

export function HomeView({ mode: _mode }: Props) {
  // Non-blocking engine prefetch — warms /readyz + /v1/tokens caches.
  // Both bridge and swap tabs benefit on first /swap click.
  useEngineBootstrap();

  return (
    <div className="relative flex w-100 flex-col gap-8 sm:w-[31rem] xl:block">
      <div className="xl:absolute xl:right-[calc(100%+1rem)] xl:top-1 xl:w-72">
        <TipCard />
      </div>
      <div>
        <UnifiedTokenCard />
      </div>
    </div>
  );
}
