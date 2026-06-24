import { CombinedTransferForm } from '../../features/combined/CombinedTransferForm';
import { useEngineBootstrap } from '../../features/swap/useEngineBootstrap';
import { TipCard } from '../tip/TipCard';

export function HomeView() {
  // Warms /readyz + /v1/tokens caches on mount.
  useEngineBootstrap();

  return (
    <div className="relative flex w-100 flex-col gap-8 sm:w-[31rem] xl:block">
      <div className="xl:absolute xl:right-[calc(100%+1rem)] xl:top-1 xl:w-72">
        <TipCard />
      </div>
      <div className="relative w-100 sm:w-[31rem]">
        <CombinedTransferForm />
      </div>
    </div>
  );
}
