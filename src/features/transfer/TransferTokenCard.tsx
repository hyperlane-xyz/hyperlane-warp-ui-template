// import { IconButton } from '../../components/buttons/IconButton';
import { Spinner } from '../../components/animation/Spinner';
import { HyperlaneWideChevron } from '../../components/icons/HyperlaneChevron';
import { Card } from '../../components/layout/Card';
import { useTokenRoutes } from '../tokens/routes';

// import GearIcon from '../../images/icons/gear.svg';
import { TransferTokenForm } from './TransferTokenForm';

export function TransferTokenCard() {
  const { tokenRoutes, isLoading, hasError } = useTokenRoutes();

  return (
    <Card classes="w-100 sm:w-[31rem] relative">
      <div className="absolute left-0 right-0 -top-32 xs:-top-24 flex justify-center overflow-hidden z-10">
        <HyperlaneWideChevron direction="s" height="100%" width="100" />
      </div>
      <div className="relative flex items-start justify-between z-20">
        <h2 className="pl-0.5 text-lg">Send Tokens</h2>
        {/* <IconButton
          imgSrc={GearIcon}
          width={20}
          height={20}
          title="Settings"
          classes="hover:rotate-90"
        /> */}
      </div>
      {tokenRoutes && <TransferTokenForm tokenRoutes={tokenRoutes} />}
      {isLoading && (
        <div className="my-24 flex flex-col items-center">
          <Spinner />
          <h3 className="mt-5 text-sm text-gray-500">Finding token routes</h3>
        </div>
      )}
      {hasError && (
        <div className="my-32 flex flex-col items-center">
          <h3 className="text-red-500">Error searching for token routes.</h3>
          <div className="mt-2 text-sm text-red-500">
            Please ensure synthetic token list is valid.
          </div>
        </div>
      )}
    </Card>
  );
}
