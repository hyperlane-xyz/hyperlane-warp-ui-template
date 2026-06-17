import { SwapTokenCard } from '../../features/transfer/engine/SwapTokenCard';
import { useEngineBootstrap } from '../../features/transfer/engine/useEngineBootstrap';
import { TipCard } from '../tip/TipCard';

export function HomeView() {
  // Non-blocking engine prefetch — warms /readyz + /v1/tokens caches.
  useEngineBootstrap();

  return (
    <div className="relative flex w-100 flex-col gap-8 sm:w-[31rem] xl:block">
      <div className="xl:absolute xl:right-[calc(100%+1rem)] xl:top-1 xl:w-72">
        <TipCard />
      </div>
      <div>
        <SwapTokenCard />
      </div>
    </div>
  );
}
