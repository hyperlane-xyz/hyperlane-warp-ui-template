import type { NextPage } from 'next';
import { TipCard } from '../components/tip/TipCard';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const Home: NextPage = () => {
  return (
    <div className="relative flex flex-col items-center pt-4">
      <div className="mb-3 w-100 sm:w-[31rem] xl:absolute xl:right-[calc(50%+340px)] xl:top-6 xl:mb-0 xl:w-56 xl:max-w-sm">
        <TipCard />
      </div>
      <div className="relative">
        <TransferTokenCard />
      </div>
    </div>
  );
};

export default Home;
