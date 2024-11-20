import { DiscordIcon, GithubIcon, HyperlaneLogo, TwitterIcon } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import Link from 'next/link';
import { ReactNode } from 'react';
import { links } from '../../consts/links';
import { Color } from '../../styles/Color';

type FooterLink = {
  title: string;
  url: string;
  external: boolean;
  icon?: ReactNode;
};

const footerLinks: FooterLink[] = [
  { title: 'Homepage', url: links.home, external: true },
  { title: 'INJ Explorer', url: links.explorerInj, external: true },
  { title: 'inEVM Explorer', url: links.explorerInEvm, external: true },
  { title: 'Support', url: links.support, external: true },
  { title: 'About', url: links.about, external: true },
  { title: 'Docs', url: links.docs, external: true },
  { title: 'Twitter', url: links.twitter, external: true, icon: <TwitterIcon color="#fff" /> },
  { title: 'Discord', url: links.discord, external: true, icon: <DiscordIcon color="#fff" /> },
  { title: 'Github', url: links.github, external: true, icon: <GithubIcon color="#fff" /> },
];

export function Footer() {
  return (
    <footer className="relative text-white">
      <div className="relative bg-gradient-to-b from-transparent to-black/40 px-8 pb-5 pt-2 sm:pt-0">
        <div className="flex flex-col items-center justify-between gap-8 sm:flex-row sm:gap-10">
          <FooterLogo />
          <FooterNav />
        </div>
      </div>
    </footer>
  );
}

function FooterLogo() {
  return (
    <div className="flex items-center justify-center space-x-2 py-1">
      <div className="flex items-center space-x-1 font-medium">
        <span>Built with</span>
        <Link href={links.about} className="flex items-center space-x-1" target="_blank">
          <HyperlaneLogo color={Color.black} width={17} height={17} />
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
    <nav className="flex text-md font-medium">
      <ul className={`${styles.linkGrid}`}>
        {footerLinks.map((item) => (
          <li key={item.title}>
            <Link
              className={styles.linkItem}
              target={item.external ? '_blank' : '_self'}
              href={item.url}
            >
              {item?.icon && <div className="mr-3 mt-1 w-4">{item?.icon}</div>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const styles = {
  linkGrid: 'grid grid-cols-3 gap-x-6 gap-y-1.5',
  linkItem: 'flex items-center capitalize text-decoration-none hover:underline underline-offset-2',
};
