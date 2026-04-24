import type { NextPage } from 'next';
<<<<<<< HEAD
import { FloatingButtonStrip } from '../components/nav/FloatingButtonStrip';
=======

import { TipCard } from '../components/tip/TipCard';
>>>>>>> origin/main
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const Home: NextPage = () => {
  return (
<<<<<<< HEAD
    <div className="relative">
      <TransferTokenCard />
      <FloatingButtonStrip />
=======
    <div className="relative flex w-100 flex-col gap-8 sm:w-[31rem] xl:block">
      <div className="xl:absolute xl:right-[calc(100%+1rem)] xl:top-1 xl:w-72">
        <TipCard />
      </div>
      <TransferTokenCard />
>>>>>>> origin/main
    </div>
  );
};

export default Home;
