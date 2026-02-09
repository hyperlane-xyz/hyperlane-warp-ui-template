import type { NextPage } from 'next';
import { TipCard } from '../components/tip/TipCard';
import { SwapTokenForm } from '../features/swap/SwapTokenForm';
import { WarpContextInitGate } from '../features/WarpContextInitGate';

const SwapPage: NextPage = () => {
  return (
    <WarpContextInitGate>
      <div className="relative flex w-100 flex-col gap-3 sm:w-[31rem] xl:block">
        <div className="xl:absolute xl:right-[calc(100%+1rem)] xl:top-0 xl:w-72">
          <TipCard />
        </div>
        <SwapTokenForm />
      </div>
    </WarpContextInitGate>
  );
};

export default SwapPage;
