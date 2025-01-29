import { DiscordIcon, HyperlaneLogo, TwitterIcon } from '@hyperlane-xyz/widgets';
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
  { title: 'Whitepaper', url: links.docs, external: true },
  { title: 'Twitter', url: links.twitter, external: true, icon: <TwitterIcon color="#fff" /> },
  { title: 'Discord', url: links.discord, external: true, icon: <DiscordIcon color="#fff" /> },
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
    <div className="flex items-center justify-center">
      <div className="ml-2 h-12 w-12 sm:h-14 sm:w-14">
        <HyperlaneLogo color={Color.white} />
      </div>
    </div>
  );
}

function FooterNav() {
  return (
    <nav className="text-md font-medium">
      <ul className="flex gap-x-6">
        {footerLinks.map((item) => (
          <li key={item.title}>
            <Link
              className="flex items-center capitalize underline-offset-2 hover:underline"
              target={item.external ? '_blank' : '_self'}
              href={item.url}
            >
              {item?.icon && <div className="mr-3 mt-1 w-4">{item?.icon}</div>}
              {!item?.icon && <div>{item.title}</div>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
