import { DropdownMenu } from '@hyperlane-xyz/widgets';
import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ConnectWalletButton } from '../../features/wallet/ConnectWalletButton';
import Logo from '../../images/logos/app-logo.svg';
import Name from '../../images/logos/app-name.svg';
import Title from '../../images/logos/app-title.svg';
import { HamburgerIcon } from '../icons/HamburgerIcon';
import { NavItem, navLinks } from './Nav';

const appLinks = [
  { title: 'Transfer', href: '/' },
  { title: 'Swap', href: '/swap' },
];

export function Header() {
  const { pathname } = useRouter();

  return (
    <header className="flex w-full items-center justify-between bg-primary-25 px-4 py-3 shadow-[0px_4px_7px_rgba(0,0,0,0.05)] sm:justify-center sm:bg-transparent sm:px-6 sm:pb-2 sm:pt-3 sm:shadow-none lg:px-12">
      {/* Mobile: Logo + Hamburger Menu */}
      <div className="flex items-center gap-3 sm:hidden">
        <Link href="/">
          <Image src={Logo} width={36} alt="" className="h-auto" />
        </Link>
        <DropdownMenu
          button={<HamburgerIcon width={20} height={19} />}
          buttonClassname="rounded p-2 text-primary-500 data-[open]:bg-primary-25 data-[open]:shadow-[inset_4px_4px_4px_rgba(154,13,255,0.1)] data-[open]:text-white"
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

      <nav className="hidden items-center gap-4 sm:absolute sm:left-6 sm:flex lg:left-12">
        {appLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.title}
              href={link.href}
              className={clsx(
                'text-sm text-primary-500 decoration-primary-500 underline-offset-2 transition-colors hover:underline',
                isActive && 'font-medium underline',
              )}
            >
              {link.title}
            </Link>
          );
        })}
      </nav>

      <div className="sm:absolute sm:right-6 lg:right-12">
        <ConnectWalletButton />
      </div>
    </header>
  );
}
