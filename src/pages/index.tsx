import type { NextPage } from 'next';

import { TipCard } from '../components/tip/TipCard';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const Home: NextPage = () => {
  return (
    <div className="pt-4 sm:pt-8 space-y-3">
      <TipCard />
      <TransferTokenCard />
    </div>
  );
};

export default Home;
