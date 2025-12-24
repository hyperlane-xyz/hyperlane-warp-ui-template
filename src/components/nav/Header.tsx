import { DropdownMenu } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import Link from 'next/link';
import { ConnectWalletButton } from '../../features/wallet/ConnectWalletButton';
import Logo from '../../images/logos/app-logo.svg';
import Name from '../../images/logos/app-name.svg';
import Title from '../../images/logos/app-title.svg';
import { HamburgerIcon } from '../icons/HamburgerIcon';
import { NavItem, navLinks } from './Nav';

export function Header() {
  return (
    <header className="flex w-full items-center justify-between bg-primary-50 px-4 py-3 shadow-[0px_4px_7px_rgba(0,0,0,0.05)] sm:justify-center sm:bg-transparent sm:px-6 sm:pb-2 sm:pt-3 sm:shadow-none lg:px-12">
      {/* Mobile: Logo + Hamburger Menu */}
      <div className="flex items-center gap-3 sm:hidden">
        <Link href="/">
          <Image src={Logo} width={36} alt="" className="h-auto" />
        </Link>
        <DropdownMenu
          button={<HamburgerIcon width={20} height={19} />}
          buttonClassname="rounded p-2 text-primary-500 data-[open]:bg-[#E2C4FC] data-[open]:shadow-[inset_4px_4px_4px_rgba(154,13,255,0.1)] data-[open]:text-white"
          menuClassname="py-4"
          menuItems={navLinks.map((item) => (
            <NavItem
              key={item.title}
              item={item}
              className="w-full gap-3 px-6 py-2 hover:bg-primary-50 hover:bg-opacity-30"
            />
          ))}
        />
      </div>

      {/* Desktop: Centered Logo */}
      <Link href="/" className="hidden flex-col py-2 sm:flex">
        <div className="flex items-end">
          <Image src={Logo} width={46} alt="" className="h-auto" />
          <Image src={Name} width={150} alt="" className="ml-1.5" />
        </div>
        <Image src={Title} width={43} alt="" className="self-end" />
      </Link>

      <div className="sm:absolute sm:right-6 lg:right-12">
        <ConnectWalletButton />
      </div>
    </header>
  );
}
