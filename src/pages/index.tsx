import type { NextPage } from 'next';
import { useAccount } from 'wagmi';
import { TipCard } from '../components/tip/TipCard';
import { IcaPanel } from '../features/swap/components/IcaPanel';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const Home: NextPage = () => {
  const { address } = useAccount();

  return (
    <div className="relative flex w-100 flex-col gap-3 sm:w-[31rem] xl:block">
      <div className="xl:absolute xl:right-[calc(100%+1rem)] xl:top-0 xl:w-72">
        <TipCard />
      </div>
      <TransferTokenCard />
      {address && <IcaPanel userAddress={address} />}
    </div>
  );
};

export default Home;
