import Image from 'next/image';
import Link from 'next/link';

import { WalletControlBar } from '../../features/wallet/WalletControlBar';
import Logo from '../../images/logos/app-logo.svg';
import Name from '../../images/logos/app-name.svg';
import Title from '../../images/logos/app-title.svg';

export function Header() {
  return (
    <header className="px-2 sm:px-6 lg:px-12 pt-3 pb-2 w-full">
      <div className="flex items-start justify-between">
        <Link href="/" className="py-2 flex items-center">
          <Image src={Logo} width={24} alt="" />
          <Image src={Name} width={130} alt="" className="hidden sm:block mt-0.5 ml-2" />
          <Image src={Title} width={210} alt="" className="mt-0.5 ml-2 pb-px" />
        </Link>
        <div className="flex flex-col items-end md:flex-row-reverse md:items-start gap-2">
          <WalletControlBar />
        </div>
      </div>
    </header>
  );
}
