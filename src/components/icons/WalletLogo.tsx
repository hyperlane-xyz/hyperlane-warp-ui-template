import Image from 'next/image';

import { WalletDetails } from '../../features/wallet/hooks/types';
import Wallet from '../../images/icons/wallet.svg';

export function WalletLogo({
  walletDetails,
  size,
}: {
  walletDetails: WalletDetails;
  size?: number;
}) {
  return (
    <Image
      src={walletDetails.logoUrl || Wallet}
      alt=""
      width={size}
      height={size}
      style={{ backgroundColor: !walletDetails.logoUrl ? walletDetails.logoAccent : undefined }}
      className="rounded-full p-0.5"
    />
  );
}
