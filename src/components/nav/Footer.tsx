import Image from 'next/image';
import Link from 'next/link';

import { links } from '../../consts/links';
import HyperlaneLogo from '../../images/logos/hyperlane-symbol-black-pink.svg';
import { Discord } from '../icons/Discord';
import { Github } from '../icons/Github';
import { Twitter } from '../icons/Twitter';

const footerLinks1 = [
  { title: 'Homepage', url: links.home, external: true },
  { title: 'INJ Explorer', url: links.explorerInj, external: true },
  { title: 'inEVM Explorer', url: links.explorerInEvm, external: true },
];

const footerLinks2 = [
  { title: 'Support', url: links.support, external: true },
  { title: 'About', url: links.about, external: true },
  { title: 'Docs', url: links.docs, external: true },
];

const footerLinks3 = [
  { title: 'Twitter', url: links.twitter, external: true, icon: <Twitter fill="#111" /> },
  { title: 'Discord', url: links.discord, external: true, icon: <Discord fill="#111" /> },
  { title: 'Github', url: links.github, external: true, icon: <Github fill="#111" /> },
];

export function Footer() {
  return (
    <footer className="text-gray-800 opacity-90 relative">
      <div className="relative z-10 px-8 pb-3 pt-2 sm:pt-0">
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 items-center sm:items-end justify-between">
          <FooterLogo />
          <FooterNav />
        </div>
      </div>
    </footer>
  );
}

function FooterLogo() {
  return (
    <div className="py-1 flex items-center justify-center space-x-2">
      <div className="flex items-center font-medium space-x-1">
        <span>Built with</span>
        <Link href={links.about} className="flex items-center space-x-1" target="_blank">
          <Image src={HyperlaneLogo} alt="" width={17} height={17} />
          <span>Hyperlane</span>
        </Link>
        <span>and</span>
        <Link href={links.caldera} className="flex items-center space-x-1" target="_blank">
          <Image src="/logos/caldera.png" alt="" width={24} height={18} />
          <span>Caldera</span>
        </Link>
      </div>
    </div>
  );
}

function FooterNav() {
  return (
    <nav className="flex text-md font-medium space-x-10">
      <ul className={`${styles.linkCol}`}>
        {footerLinks1.map((item) => (
          <li className="" key={item.title}>
            <Link
              className={styles.linkItem}
              target={item.external ? '_blank' : '_self'}
              href={item.url}
            >
              <div className="text-sm">{item.title}</div>
            </Link>
          </li>
        ))}
      </ul>
      <ul className={`${styles.linkCol}`}>
        {footerLinks2.map((item) => (
          <li className="" key={item.title}>
            <Link
              className={styles.linkItem}
              target={item.external ? '_blank' : '_self'}
              href={item.url}
            >
              <div className="text-sm">{item.title}</div>
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
              {item?.icon && <div className="mt-1 mr-3 w-4">{item?.icon}</div>}
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
