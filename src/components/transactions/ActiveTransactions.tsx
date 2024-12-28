import { SpinnerIcon } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { config } from '../../consts/config';
import { useMultiProvider } from '../../features/chains/hooks';
import { useStore } from '../../features/store';
import InfoCircle from '../../images/icons/info-circle.svg';
import { Card } from '../layout/Card';

export function ActiveTransactions() {
  const [show, setShow] = useState(config.showTipBox);
  const multiProvider = useMultiProvider();
  const { transfers, transferLoading } = useStore((s) => ({
    transfers: s.transfers,
    transferLoading: s.transferLoading,
  }));

  const transfersList = useMemo(() => transfers.filter(t => t.status === "signing-transfer"), [transfers]);

  console.log(transfers, transferLoading)
  // const {
  //   status,
  //   origin,
  //   destination,
  //   amount,
  //   sender,
  //   recipient,
  //   originTokenAddressOrDenom,
  //   originTxHash,
  //   msgId,
  //   timestamp,
  // } = transfer || {};
  if (!show) return null;
  return (
    <Card className="w-100 p-2 sm:w-[31rem]">
      <h2 className="text-primary-500">Active Transactions</h2>
      <div className="flex items-end justify-between">
        {transfersList.map((item) => (
          <div>
            <Image src={InfoCircle} width={12} alt="" />
            <div>
              <h5>
                12312 ammount
              </h5>
              <div>
              {/* {getChainDisplayName(multiProvider, origin, true)} -arrow {getChainDisplayName(multiProvider, destination, true)} */}
              </div>
            </div>  
            <SpinnerIcon />
          </div>
        ))}
      </div>
    </Card>
  );
}
