import { DropdownMenu } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import Link from 'next/link';

import { useTheme } from '../../features/theme/ThemeContext';
import { ConnectWalletButton } from '../../features/wallet/ConnectWalletButton';
import Logo from '../../images/logos/app-logo.svg';
import Name from '../../images/logos/app-name.svg';
import Title from '../../images/logos/app-title.svg';
import { HamburgerIcon } from '../icons/HamburgerIcon';
import { NavItem, navLinks } from './Nav';

export function Header() {
  const { themeMode, toggleThemeMode } = useTheme();
  const nextThemeMode = themeMode === 'dark' ? 'light' : 'dark';
  const nextThemeLabel = nextThemeMode === 'dark' ? 'Lights out' : 'Lights on';

  return (
    <header className="dark:bg-background/88 relative flex w-full items-center justify-between bg-primary-25 px-4 py-3 shadow-[0px_4px_7px_rgba(0,0,0,0.05)] lg:justify-center lg:bg-transparent lg:px-6 lg:pb-2 lg:pt-3 lg:shadow-none dark:border-b dark:border-primary-300/25 dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)] lg:dark:border-b-0 lg:dark:bg-transparent lg:dark:shadow-none">
      {/* Mobile/Tablet: Logo + Hamburger Menu */}
      <div className="flex items-center gap-3 lg:hidden">
        <Link href="/" aria-label="Homepage">
          <Image src={Logo} width={36} alt="" className="h-auto" />
        </Link>
        <DropdownMenu
          button={<HamburgerIcon width={20} height={19} />}
          buttonClassname="rounded p-2 text-primary-500 data-[open]:bg-primary-25 data-[open]:shadow-[inset_4px_4px_4px_rgba(154,13,255,0.1)] data-[open]:text-white dark:bg-surface/30 dark:text-text-primary dark:data-[open]:bg-primary-300/25 dark:data-[open]:ring-1 dark:data-[open]:ring-primary-300/45 dark:data-[open]:text-white"
          menuClassname="py-4 dark:border dark:border-primary-300/35 dark:bg-surface dark:shadow-[0_16px_36px_rgba(0,0,0,0.45)]"
          menuItems={navLinks.map((item) => (
            <NavItem
              key={item.title}
              item={item}
              className="w-full gap-3 px-6 py-2 hover:bg-primary-50 hover:bg-opacity-30 dark:text-text-primary dark:hover:bg-primary-300/15 dark:[&_path]:fill-current dark:[&_path]:stroke-current"
            />
          ))}
        />
      </div>

      {/* Desktop: Centered Logo */}
      <Link href="/" aria-label="Homepage" className="hidden flex-col py-2 lg:flex">
        <div className="flex items-end">
          <Image src={Logo} width={46} alt="" className="h-auto" />
          <Image src={Name} width={150} alt="" className="ml-1.5" />
        </div>
        <Image src={Title} width={43} alt="" className="self-end" />
      </Link>

      <div className="flex items-center gap-2 lg:absolute lg:right-12">
        <button
          type="button"
          className={`${styles.themeToggle} theme-toggle`}
          onClick={toggleThemeMode}
          aria-label={`Switch to ${nextThemeMode} mode`}
          title={`Switch to ${nextThemeMode} mode`}
        >
          {nextThemeLabel}
        </button>
        <ConnectWalletButton />
      </div>
    </header>
  );
}

const styles = {
  themeToggle:
    'rounded-md border border-primary-500/35 bg-white/85 px-2.5 py-1 text-xs font-medium capitalize text-primary-900 transition-[background-color,border-color,color,box-shadow] duration-200 hover:border-primary-300/70 hover:bg-gray-950/90 hover:text-primary-25 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(154,13,255,0.25)] dark:border-primary-300/45 dark:bg-background/75 dark:text-text-primary dark:hover:border-primary-500/55 dark:hover:bg-surface dark:hover:text-text-primary dark:focus-visible:shadow-[0_0_0_2px_rgba(185,89,255,0.35)]',
};
