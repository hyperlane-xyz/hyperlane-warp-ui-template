import type { NextPage } from 'next';
import { useAccount } from 'wagmi';
import { TipCard } from '../components/tip/TipCard';
import { IcaPanel } from '../features/swap/components/IcaPanel';
import { SWAP_CHAIN_CONFIGS } from '../features/swap/swapConfig';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const swapChainNames = Object.keys(SWAP_CHAIN_CONFIGS);

const Home: NextPage = () => {
  const { address } = useAccount();

  return (
    <div className="relative flex w-100 flex-col gap-3 sm:w-[31rem] xl:block">
      <div className="xl:absolute xl:right-[calc(100%+1rem)] xl:top-0 xl:w-72">
        <TipCard />
      </div>
      <TransferTokenCard />
      {address && swapChainNames.length >= 2 && (
        <IcaPanel
          userAddress={address}
          originChainName={swapChainNames[0]}
          destinationChainName={swapChainNames[1]}
        />
      )}
    </div>
  );
};

export default Home;
