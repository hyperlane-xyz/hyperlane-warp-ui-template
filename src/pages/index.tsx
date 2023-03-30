import type { NextPage } from 'next';

import { TipCard } from '../components/tip/TipCard';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const Home: NextPage = () => {
  return (
    <div className="space-y-2">
      <TipCard />
      <TransferTokenCard />
    </div>
  );
};

export default Home;
