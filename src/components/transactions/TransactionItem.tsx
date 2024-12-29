import { SpinnerIcon } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useMultiProvider } from '../../features/chains/hooks';
import { getChainDisplayName } from '../../features/chains/utils';
import { tryFindToken, useWarpCore } from '../../features/tokens/hooks';
import { TransferContext } from '../../features/transfer/types';
import InfoCircle from '../../images/icons/info-circle.svg';

export function TransactionItem({ transaction }: { transaction: TransferContext }) {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const {
    status,
    origin,
    destination,
    amount,
    sender,
    recipient,
    originTokenAddressOrDenom,
    originTxHash,
    msgId,
    timestamp,
  } = transaction || {};

  const token = tryFindToken(warpCore, origin, originTokenAddressOrDenom);
  return (
    <div>
      <Image src={InfoCircle} width={12} alt="" />
      <div>
        <h5>
          {amount} {token.symbol}
        </h5>
        <div>
          {getChainDisplayName(multiProvider, origin, true)} -arrow {getChainDisplayName(multiProvider, destination, true)}
        </div>
      </div>
      <SpinnerIcon />
    </div>
  );
}
