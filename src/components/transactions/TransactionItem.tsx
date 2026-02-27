import { SpinnerIcon } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useState } from 'react';
import { useMultiProvider } from '../../features/chains/hooks';
import { getChainDisplayName } from '../../features/chains/utils';
import { tryFindToken, useWarpCore } from '../../features/tokens/hooks';
import { TransfersDetailsModal } from '../../features/transfer/TransfersDetailsModal';
import { TransferContext } from '../../features/transfer/types';
import ArrowRightIcon from '../../images/icons/arrow-right.svg';
import { TokenIcon } from '../icons/TokenIcon';

export function TransactionItem({ transaction }: { transaction: TransferContext }) {
  const [showDetails, setShowDetails] = useState(false);
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const {
    origin,
    destination,
    amount,
    originTokenAddressOrDenom,
  } = transaction || {};

  const token = tryFindToken(warpCore, origin, originTokenAddressOrDenom);

  return (
    <div className="flex items-center gap-2 p-1 rounded w-full hover:bg-gray-200 cursor-pointer" onClick={() => setShowDetails(true)}>
      <TokenIcon token={token} size={30} />
      <div>
        <h5 className="text-sm font-normal">
          {amount} {token.symbol}
        </h5>
        <div className='flex items-center gap-2 text-xs text-gray-600'>
          <span>
            {getChainDisplayName(multiProvider, origin, true)}
          </span>
          <Image src={ArrowRightIcon} width={12} height={12} alt="arrow" />
          <span>
            {getChainDisplayName(multiProvider, destination, true)}
          </span>
        </div>
      </div>
      <div className='ml-auto'>
        <SpinnerIcon width={30} height={30} />
      </div>
      {showDetails && (
        <TransfersDetailsModal
          isOpen={showDetails}
          onClose={() => {
            setShowDetails(false);
          }}
          transfer={transaction}
        />
      )}
    </div>
  );
}
