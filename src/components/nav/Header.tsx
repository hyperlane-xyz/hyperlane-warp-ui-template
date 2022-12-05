import Image from 'next/image';
import Link from 'next/link';
import useDropdownMenu from 'react-accessible-dropdown-menu-hook';

import { WalletControlBar } from '../../features/wallet/WalletControlBar';
import Bridge from '../../images/logos/hyperlane-bridge.png';
import Logo from '../../images/logos/hyperlane-logo.svg';
import Name from '../../images/logos/hyperlane-name.svg';

export function Header() {
  const { buttonProps, itemProps, isOpen, setIsOpen } = useDropdownMenu(4);
  const closeDropdown = () => {
    setIsOpen(false);
  };

  return (
    <header className="pt-4 pb-3 sm:pt-5 sm:pb-3 w-full">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <div className="flex items-center scale-90 sm:scale-100">
            <Image src={Logo} width={22} alt="" />
            <Image src={Name} width={110} alt="Hyperlane" className="mt-0.5 ml-2" />
            <Image src={Bridge} width={104} alt="Bridge" className="mt-0.5 ml-2" />
          </div>
        </Link>
        <WalletControlBar />
      </div>
    </header>
  );
}
