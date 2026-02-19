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
    <div className="footer-logo-wrap flex items-center justify-center">
      <HyperlaneGradientLogo className="footer-logo" width={219} height={18} />
    </div>
  );
}

function FooterNav() {
  return (
    <nav className="hidden text-md font-medium lg:block">
      <ul className="flex gap-9">
        {navLinks.map((item) => (
          <li key={item.title}>
            <NavItem item={item} className="footer-nav-item" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
