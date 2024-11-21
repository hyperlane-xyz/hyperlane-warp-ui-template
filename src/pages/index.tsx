import type { NextPage } from 'next';
import { TipCard } from '../components/tip/TipCard';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';
import { WalletFloatingButtons } from '../features/wallet/WalletFloatingButtons';

const Home: NextPage = () => {
  return (
    <div className="space-y-3 pt-4">
      <TipCard />
      <div className="relative">
        <TransferTokenCard />
        <WalletFloatingButtons />
      </div>
    </div>
  );
};

export default Home;
