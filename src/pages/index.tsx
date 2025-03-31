import type { NextPage } from 'next';
import { FloatingButtonStrip } from '../components/nav/FloatingButtonStrip';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const Home: NextPage = () => {
  return (
    <div className="relative">
      <TransferTokenCard />
      <FloatingButtonStrip />
    </div>
  );
};

export default Home;
