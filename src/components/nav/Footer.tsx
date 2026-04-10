import { HyperlaneGradientLogo } from '../icons/HyperlaneGradientLogo';
import { NavItem, navLinks } from './Nav';

export function Footer() {
  return (
    <footer className="footer-root relative text-white">
      <div className="footer-inner relative px-8 pb-5 pt-2 sm:pt-0">
        <div className="flex flex-col items-center justify-between gap-4">
          <FooterLogo />
          <FooterNav />
        </div>
      </div>
    </footer>
  );
}

function FooterLogo() {
  return (
<<<<<<< HEAD
    <div className="footer-logo-wrap flex items-center justify-center">
      <HyperlaneGradientLogo className="footer-logo" width={219} height={18} />
=======
    <div className="flex items-center justify-center rounded-full border border-transparent bg-transparent px-[0.8rem] py-[0.35rem] dark:border-primary-300/40 dark:bg-white/[0.08] dark:shadow-[0_0_22px_rgba(154,13,255,0.24)]">
      <HyperlaneGradientLogo
        className="dark:[filter:saturate(1.2)_brightness(1.2)_drop-shadow(0_0_10px_rgba(185,89,255,0.45))]"
        width={219}
        height={18}
      />
>>>>>>> origin/main
    </div>
  );
}

function FooterNav() {
  return (
    <nav className="hidden text-md font-medium lg:block">
      <ul className="flex gap-9">
        {navLinks.map((item) => (
          <li key={item.title}>
<<<<<<< HEAD
            <NavItem item={item} className="footer-nav-item" />
=======
            <NavItem item={item} className="dark:text-primary-50 dark:hover:text-white" />
>>>>>>> origin/main
          </li>
        ))}
      </ul>
    </nav>
  );
}
