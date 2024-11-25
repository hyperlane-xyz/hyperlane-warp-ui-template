import Image from 'next/image';
import Link from 'next/link';
import { ConnectWalletButton } from '../../features/wallet/ConnectWalletButton';
import Logo from '../../images/logos/app-logo.svg';
import Name from '../../images/logos/app-name.svg';

export function Header() {
  return (
    <header className="w-full px-2 pb-2 pt-3 sm:px-6 lg:px-12">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <Link href="/" className="flex items-center">
            <Image src={Logo} width={24} alt="" />
            <Image src={Name} width={122} alt="" className="ml-2 mt-0.5 hidden sm:block" />
            <h1 className="ml-2 pt-px text-2xl font-bold uppercase tracking-wide text-white">
              Nexus
            </h1>
          </Link>
        </div>
        <div className="flex flex-col items-end gap-2 md:flex-row-reverse md:items-start">
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  );
}
