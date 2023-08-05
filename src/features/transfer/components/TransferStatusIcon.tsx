import Image from 'next/image';

import { Spinner } from '../../../components/animation/Spinner';
import CheckmarkCircleIcon from '../../../images/icons/checkmark-circle.svg';
import EnvelopeHeartIcon from '../../../images/icons/envelope-heart.svg';
import ErrorCircleIcon from '../../../images/icons/error-circle.svg';
import { TransferStatus } from '../types';

export function TransferStatusIcon({ transferStatus }: { transferStatus: TransferStatus }) {
  let content;
  if (transferStatus === TransferStatus.Delivered) {
    content = (
      <Image
        src={CheckmarkCircleIcon}
        alt="Delivered"
        width={80}
        height={80}
        className="opacity-80"
      />
    );
  } else if (transferStatus === TransferStatus.ConfirmedTransfer) {
    content = (
      <Image
        src={EnvelopeHeartIcon}
        alt="Delivering"
        width={80}
        height={80}
        className="opacity-80"
      />
    );
  } else if (transferStatus === TransferStatus.Failed) {
    content = (
      <Image src={ErrorCircleIcon} alt="Failed" width={86} height={86} className="opacity-80" />
    );
  } else {
    content = <Spinner />;
  }
  return <div className="py-4 flex flex-col justify-center items-center">{content}</div>;
}
