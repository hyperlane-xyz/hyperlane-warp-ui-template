import type { NextPage } from 'next';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';
import { WalletFloatingButtons } from '../features/wallet/WalletFloatingButtons';

const Home: NextPage = () => {
  return (
    <div className="space-y-3 pt-4">
      <div className="relative">
        <TransferTokenCard />
        <WalletFloatingButtons />
      </div>
    </div>
  );
};

export default Home;
