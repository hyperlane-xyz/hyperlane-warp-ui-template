import type { NextPage } from 'next';
import { TipCard } from '../components/tip/TipCard';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const Home: NextPage = () => {
  return (
    <div className="relative flex w-100 flex-col gap-8 sm:w-[31rem] xl:block">
      <div className="xl:absolute xl:right-[calc(100%+1rem)] xl:top-14 xl:w-72">
        <TipCard />
      </div>
      <TransferTokenCard />
    </div>
  );
};

export default Home;
