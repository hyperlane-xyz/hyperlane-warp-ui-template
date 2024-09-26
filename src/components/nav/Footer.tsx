import Link from 'next/link';

import { links } from '../../consts/links';
import { Color } from '../../styles/Color';
import { Discord } from '../icons/Discord';
import { Github } from '../icons/Github';
import { HyperlaneLogo } from '../icons/HyperlaneLogo';
import { Twitter } from '../icons/Twitter';

const footerLinks1 = [
  { title: 'Docs', url: links.docs, external: true },
  { title: 'Homepage', url: links.home, external: true },
  { title: 'Explorer', url: links.explorer, external: true },
];

const footerLinks3 = [
  { title: 'Twitter', url: links.twitter, external: true, icon: <Twitter fill="#fff" /> },
  { title: 'Discord', url: links.discord, external: true, icon: <Discord fill="#fff" /> },
  { title: 'Github', url: links.github, external: true, icon: <Github fill="#fff" /> },
];

export function Footer() {
  return (
    <footer className="text-white relative">
      <div className="relative z-10 px-8 pb-5 pt-2 sm:pt-0 bg-gradient-to-b from-transparent to-black/40">
        <div className="flex flex-col sm:flex-row gap-8 sm:gap-10 items-center justify-between">
          <FooterLogo />
          <FooterNav />
        </div>
      </div>
    </footer>
  );
}

function FooterLogo() {
  return (
    <div className="flex items-center justify-center">
      <div className="ml-2 w-12 sm:w-14 h-12 sm:h-14">
        <HyperlaneLogo fill={Color.white} />
      </div>
      <div className="text-lg sm:text-xl font-medium ml-6 space-y-1">
        <div>Go interchain</div>
        <div>with Hyperlane</div>
      </div>
    </div>
  );
}

function FooterNav() {
  return (
    <nav className="flex text-md font-medium">
      <ul className={`${styles.linkCol} mr-14`}>
        {footerLinks1.map((item) => (
          <li className="" key={item.title}>
            <Link
              className={styles.linkItem}
              target={item.external ? '_blank' : '_self'}
              href={item.url}
            >
              <div className="">{item.title}</div>
            </Link>
          </li>
        ))}
      </ul>
      <ul className={`${styles.linkCol}`}>
        {footerLinks3.map((item) => (
          <li key={item.title}>
            <Link
              className={styles.linkItem}
              target={item.external ? '_blank' : '_self'}
              href={item.url}
            >
              {item?.icon && <div className="mr-4 w-5">{item?.icon}</div>}
              <div className="">{item.title}</div>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const styles = {
  linkCol: 'flex flex-col gap-1.5',
  linkItem: 'flex items-center capitalize text-decoration-none hover:underline underline-offset-2',
};
