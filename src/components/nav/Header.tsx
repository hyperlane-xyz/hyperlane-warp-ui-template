import Image from 'next/image';
import Link from 'next/link';
import { ConnectWalletButton } from '../../features/wallet/ConnectWalletButton';
import LogoGroup from '../../images/logos/logo-group.svg';

export function Header() {
  return (
    <header className="w-full backdrop-blur-md px-8 py-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex h-full items-center">
         <Image src={LogoGroup} alt='logo group' />
        </Link>
        <div className="flex flex-col items-end gap-2 md:flex-row-reverse md:items-start">
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  );
}
