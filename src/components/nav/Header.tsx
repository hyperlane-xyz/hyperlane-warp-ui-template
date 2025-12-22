import Image from 'next/image';
import Link from 'next/link';
import { ConnectWalletButton } from '../../features/wallet/ConnectWalletButton';
import Logo from '../../images/logos/app-logo.svg';
import Name from '../../images/logos/app-name.svg';
import Title from '../../images/logos/app-title.svg';

function HamburgerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6H21M3 12H21" stroke="#9A0DFF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Header() {
  return (
    <>
      {/* Desktop Header */}
      <header className="hidden w-full px-6 pb-2 pt-3 sm:block lg:px-12">
        <div className="relative flex items-center justify-center">
          {/* Centered Logo */}
          <Link href="/" className="flex flex-col py-2">
            {/* Logo + Hyperlane on same line, bottom-aligned */}
            <div className="flex items-end">
              <Image src={Logo} width={46} alt="" className="h-auto" />
              <Image src={Name} width={150} alt="" className="ml-1.5" />
            </div>
            {/* NEXUS below, right-aligned */}
            <Image src={Title} width={43} alt="" className="self-end" />
          </Link>
          {/* Right-aligned Connect Button */}
          <div className="absolute right-0">
            <ConnectWalletButton />
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="flex w-full items-center justify-between bg-primary-50 px-4 py-3 shadow-[0px_4px_7px_rgba(0,0,0,0.05)] sm:hidden">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Image src={Logo} width={36} alt="" className="h-auto" />
          </Link>
          <button type="button" aria-label="Menu">
            <HamburgerIcon />
          </button>
        </div>
        <ConnectWalletButton />
      </header>
    </>
  );
}
