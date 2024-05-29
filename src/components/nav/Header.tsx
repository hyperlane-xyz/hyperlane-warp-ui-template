import Image from 'next/image';
import Link from 'next/link';

import { WalletControlBar } from '../../features/wallet/WalletControlBar';
import Logo from '../../images/logos/app-logo.svg';
import Name from '../../images/logos/hyperlane-white.svg';

export function Header() {
  return (
    <header className="px-2 sm:px-6 lg:px-12 pt-3 pb-2 w-full">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <Link href="/" className="flex items-center">
            <Image src={Logo} width={24} alt="" />
            <Image src={Name} width={130} alt="" className="hidden sm:block mt-0.5 ml-2" />
            <h1 className="ml-2 pt-0.5 text-2xl text-white font-bold uppercase tracking-wide">
              Nexus
            </h1>
          </Link>
          <h2 className="flex text-white text-sm md:text-lg font-bold">
            Powered by Mitosis and Neutron{' '}
            <Image
              src="/logos/neutron.svg"
              alt=""
              width={18}
              height={18}
              className="hidden sm:block ml-1.5 invert"
            ></Image>
          </h2>
        </div>
        <div className="flex flex-col items-end md:flex-row-reverse md:items-start gap-2">
          <WalletControlBar />
        </div>
      </div>
    </header>
  );
}
