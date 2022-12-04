import Image from 'next/image';
import Link from 'next/link';
import useDropdownMenu from 'react-accessible-dropdown-menu-hook';

import { links } from '../../consts/links';
import BookIcon from '../../images/icons/book.svg';
import HamburgerIcon from '../../images/icons/hamburger.svg';
import HouseIcon from '../../images/icons/house.svg';
import InfoIcon from '../../images/icons/info-circle.svg';
import SearchIcon from '../../images/icons/search.svg';
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
          </div>
        </Link>
        <nav className="hidden sm:flex sm:space-x-8 sm:items-center">
          <Link href="/" className={styles.navLink}>
            Home
          </Link>
          <a
            className={styles.navLink}
            target="_blank"
            href={links.explorer}
            rel="noopener noreferrer"
          >
            Explorer
          </a>
          <a className={styles.navLink} target="_blank" href={links.home} rel="noopener noreferrer">
            About
          </a>
          <a className={styles.navLink} target="_blank" href={links.docs} rel="noopener noreferrer">
            Docs
          </a>
        </nav>
        <div className="relative flex item-center sm:hidden mr-2">
          <button className="hover:opacity-70 transition-all" {...buttonProps}>
            <Image src={HamburgerIcon} width={22} height={22} alt="..." />
          </button>
        </div>
      </div>
      {/* Dropdown menu, used on mobile */}
      <nav className={`${styles.dropdownContainer} ${!isOpen && 'hidden'} right-0`} role="menu">
        <Link href="/" {...itemProps[0]} className={styles.dropdownOption} onClick={closeDropdown}>
          <DropdownItemContent icon={HouseIcon} text="Home" />
        </Link>
        <a
          {...itemProps[1]}
          onClick={closeDropdown}
          className={styles.dropdownOption}
          target="_blank"
          href={links.explorer}
          rel="noopener noreferrer"
        >
          <DropdownItemContent icon={SearchIcon} text="Explorer" />
        </a>
        <a
          {...itemProps[2]}
          onClick={closeDropdown}
          className={styles.dropdownOption}
          target="_blank"
          href={links.docs}
          rel="noopener noreferrer"
        >
          <DropdownItemContent icon={BookIcon} text="Docs" />
        </a>
        <a
          {...itemProps[3]}
          onClick={closeDropdown}
          className={styles.dropdownOption}
          target="_blank"
          href={links.home}
          rel="noopener noreferrer"
        >
          <DropdownItemContent icon={InfoIcon} text="About" />
        </a>
      </nav>
    </header>
  );
}

function DropdownItemContent({ icon, text }: { icon: any; text: string }) {
  return (
    <>
      <Image src={icon} width={18} height={18} className="opacity-70 mr-2.5" alt="" />
      <span>{text}</span>
    </>
  );
}

const styles = {
  navLink:
    'pt-px flex items-center tracking-wide text-gray-600 text-[0.95rem] hover:underline hover:opacity-80 active:opacity-70 decoration-2 underline-offset-[6px] transition-all',
  dropdownContainer: 'dropdown-menu w-[7.5rem] mt-1 mr-px bg-gray-50 shadow-md',
  dropdownOption:
    'flex items-center cursor-pointer p-2 mt-1 rounded text-gray-600 hover:underline decoration-2 underline-offset-4 transition-all',
  activeEnv: 'font-medium cursor-default hover:no-underline',
};
