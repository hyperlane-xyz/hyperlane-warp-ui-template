// import { IconButton } from '../../components/buttons/IconButton';
import { WideChevron } from '@hyperlane-xyz/widgets';

import { Spinner } from '../../components/animation/Spinner';
import { Card } from '../../components/layout/Card';
import { Color } from '../../styles/Color';
// import GearIcon from '../../images/icons/gear.svg';
import { useTokenRoutes } from '../tokens/routes/hooks';

import { TransferTokenForm } from './TransferTokenForm';

export function TransferTokenCard() {
  const { tokenRoutes, isLoading, error: routesError } = useTokenRoutes();

  return (
    <Card className="w-100 sm:w-[31rem]">
      <>
        <div className="absolute left-0 right-0 -top-36 xs:-top-[6.5rem] flex justify-center overflow-hidden z-10">
          <WideChevron
            direction="s"
            height="100%"
            width="100"
            rounded={true}
            color={Color.primaryMint}
          />
        </div>
        <div className="relative flex items-start justify-between z-20">
          {/* <h2 className="pl-0.5 text-lg">Send Tokens</h2> */}
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
        {routesError && (
          <div className="my-32 flex flex-col items-center text-center">
            <h3 className="text-red-500">Error searching for token routes.</h3>
            <div className="mt-3 text-sm text-red-500">
              Please ensure chain and token configs are valid.
            </div>
            <div className="mt-4 text-xs text-gray-500">{routesError.toString()}</div>
          </div>
        )}
      </>
    </Card>
  );
}
