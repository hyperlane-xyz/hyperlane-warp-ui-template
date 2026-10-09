import { DropdownMenu } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import Link from 'next/link';

<<<<<<< HEAD
=======
import { useTheme } from '../../features/theme/ThemeContext';
>>>>>>> origin/main
import { ConnectWalletButton } from '../../features/wallet/ConnectWalletButton';
import Name from '../../images/logos/app-name.svg';
<<<<<<< HEAD
=======
import Title from '../../images/logos/app-title.svg';
import { HamburgerIcon } from '../icons/HamburgerIcon';
import { NavItem, navLinks } from './Nav';
>>>>>>> origin/main

export function Header() {
  const { themeMode, toggleThemeMode } = useTheme();
  const nextThemeMode = themeMode === 'dark' ? 'light' : 'dark';
  const nextThemeLabel = nextThemeMode === 'dark' ? 'Lights out' : 'Lights on';

  return (
<<<<<<< HEAD
    <header className="w-full px-2 pb-2 pt-3 sm:px-6 lg:px-12">
      <div className="flex items-start justify-between">
        <Link href="/" className="flex items-center py-2">
          <Image src={Name} width={170} alt="" className="mt-0.5" />
=======
    <header className="relative flex w-full items-center justify-between bg-primary-25 px-4 py-3 shadow-app-header lg:justify-center lg:bg-transparent lg:px-6 lg:pb-2 lg:pt-3 lg:shadow-none dark:border-b dark:border-primary-300/[0.24] dark:bg-background/[0.88] dark:shadow-app-header-dark lg:dark:border-b-0 lg:dark:bg-transparent lg:dark:shadow-none">
      {/* Mobile/Tablet: Logo + Hamburger Menu */}
      <div className="flex items-center gap-3 lg:hidden">
        <Link href="/" aria-label="Homepage">
          <Image src={Logo} width={36} alt="" className="h-auto" />
>>>>>>> origin/main
        </Link>
        <DropdownMenu
          button={<HamburgerIcon width={20} height={19} />}
          buttonClassname="rounded p-2 text-primary-500 data-[open]:bg-primary-25 data-[open]:shadow-[inset_4px_4px_4px_rgba(154,13,255,0.1)] data-[open]:text-white dark:bg-white/[0.08] dark:text-foreground-primary dark:data-[open]:bg-primary-300/25 dark:data-[open]:ring-1 dark:data-[open]:ring-primary-300/45 dark:data-[open]:text-white"
          menuClassname="py-4 dark:border dark:border-primary-300/35 dark:bg-surface dark:shadow-menu-dark"
          menuItems={navLinks.map((item) => (
            <NavItem
              key={item.title}
              item={item}
              className="w-full gap-3 px-6 py-2 hover:bg-primary-50/30 dark:text-foreground-primary dark:hover:bg-primary-300/[0.16] dark:[&_path]:fill-current dark:[&_path]:stroke-current"
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
    'rounded-md border border-primary-500/35 bg-white/85 px-2.5 py-1 text-xs font-medium capitalize text-primary-900 transition-[background-color,border-color,color,box-shadow] duration-200 hover:border-primary-300/70 hover:bg-gray-950/90 hover:text-primary-25 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(154,13,255,0.25)] dark:border-primary-300/45 dark:bg-black/75 dark:text-primary-50 dark:hover:border-primary-500/55 dark:hover:bg-white/95 dark:hover:text-primary-900 dark:focus-visible:shadow-[0_0_0_2px_rgba(185,89,255,0.35)]',
};
