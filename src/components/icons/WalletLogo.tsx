import Image from 'next/image';

import { WalletDetails } from '../../features/wallet/hooks/types';
import Wallet from '../../images/icons/wallet.svg';
import WalletConnect from '../../images/logos/wallet-connect.svg';

export function WalletLogo({
  walletDetails,
  size,
}: {
  walletDetails: WalletDetails;
  size?: number;
}) {
  let src = walletDetails.logoUrl?.trim();
  if (!src && walletDetails.name?.toLowerCase() === 'walletconnect') {
    src = WalletConnect;
  }
  return (
    <Image
      src={src || Wallet}
      alt=""
      width={size}
      height={size}
      className={`p-0.5 ${src && 'rounded-full'}`}
    />
  );
}
