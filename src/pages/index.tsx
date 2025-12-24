import type { NextPage } from 'next';
import { TipCard } from '../components/tip/TipCard';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const Home: NextPage = () => {
  return (
    <div className="space-y-3 pt-4">
      <TipCard />
      <div className="relative">
        <TransferTokenCard />
      </div>
    </div>
  );
};

export default Home;
