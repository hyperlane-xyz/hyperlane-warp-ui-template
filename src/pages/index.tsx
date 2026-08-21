import type { NextPage } from 'next';
<<<<<<< HEAD
import { FloatingButtonStrip } from '../components/nav/FloatingButtonStrip';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const Home: NextPage = () => {
  return (
    <div className="relative">
      <TransferTokenCard />
      <FloatingButtonStrip />
    </div>
  );
=======

import { HomeView } from '../components/layout/HomeView';

const Home: NextPage = () => {
  return <HomeView />;
>>>>>>> origin/main
};

export default Home;
